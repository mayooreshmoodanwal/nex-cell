/**
 * COMMENT SERVICE
 * Soft-delete only. Status-based moderation. Report system.
 */

import { db }          from "@/lib/db/client";
import { comments, commentReports, events, users } from "@/lib/db/schema";
import { eq, and, isNull, desc } from "drizzle-orm";
import { writeAuditLog, AUDIT_ACTIONS } from "./audit.service";
import { notifyCommentApproved, notifyCommentRejected } from "./notification.service";

export async function postComment(data: {
  eventId: string; userId: string; body: string;
}) {
  // Check if the event has auto-approve enabled
  const [event] = await db.select({ autoApproveComments: events.autoApproveComments })
    .from(events).where(eq(events.id, data.eventId)).limit(1);

  const status = event?.autoApproveComments ? "approved" : "pending";

  const [comment] = await db.insert(comments).values({
    eventId: data.eventId,
    userId:  data.userId,
    body:    data.body.trim(),
    status:  status as any,
  }).returning();

  return { comment, status };
}

export async function getApprovedComments(eventId: string) {
  return db.select({
    id: comments.id, body: comments.body, createdAt: comments.createdAt,
    userId: comments.userId, userName: users.name,
  })
  .from(comments)
  .leftJoin(users, eq(comments.userId, users.id))
  .where(and(eq(comments.eventId, eventId), eq(comments.status, "approved" as any), isNull(comments.deletedAt)))
  .orderBy(desc(comments.createdAt));
}

export async function getPendingComments() {
  return db.select({
    id: comments.id, body: comments.body, createdAt: comments.createdAt,
    userId: comments.userId, userName: users.name,
    eventId: comments.eventId, eventTitle: events.title,
  })
  .from(comments)
  .leftJoin(users, eq(comments.userId, users.id))
  .leftJoin(events, eq(comments.eventId, events.id))
  .where(and(eq(comments.status, "pending" as any), isNull(comments.deletedAt)))
  .orderBy(comments.createdAt);
}

export async function moderateComment(
  commentId: string, moderatorId: string,
  action: "approve" | "reject", reason?: string
) {
  const [comment] = await db.select().from(comments).where(eq(comments.id, commentId)).limit(1);
  if (!comment) return { success: false, error: "Comment not found" };

  const status = action === "approve" ? "approved" : "rejected";
  await db.update(comments).set({
    status: status as any, moderatedBy: moderatorId,
    moderatedAt: new Date(), rejectionReason: reason ?? null, updatedAt: new Date(),
  }).where(eq(comments.id, commentId));

  // Load event title for notification
  const [event] = await db.select({ title: events.title }).from(events)
    .where(eq(events.id, comment.eventId)).limit(1);

  if (action === "approve") {
    notifyCommentApproved({ userId: comment.userId, eventId: comment.eventId, eventTitle: event?.title ?? "an event" }).catch(() => {});
  } else {
    notifyCommentRejected({ userId: comment.userId, reason }).catch(() => {});
  }

  await writeAuditLog({
    actorId: moderatorId,
    action: action === "approve" ? AUDIT_ACTIONS.COMMENT_APPROVED : AUDIT_ACTIONS.COMMENT_REJECTED,
    entityType: "comment", entityId: commentId,
    oldValue: { status: comment.status }, newValue: { status },
  });

  return { success: true };
}

export async function softDeleteComment(commentId: string, deletedBy: string) {
  await db.update(comments).set({ deletedAt: new Date(), deletedBy }).where(eq(comments.id, commentId));
  await writeAuditLog({
    actorId: deletedBy, action: AUDIT_ACTIONS.COMMENT_DELETED,
    entityType: "comment", entityId: commentId,
  });
}

export async function reportComment(commentId: string, reportedBy: string, reason: string) {
  await db.insert(commentReports).values({ commentId, reportedBy, reason })
    .onConflictDoNothing();
  return { success: true };
}
