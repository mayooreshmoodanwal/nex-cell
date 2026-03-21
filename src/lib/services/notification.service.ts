/**
 * NOTIFICATION SERVICE
 * Creates in-app notifications. Called by every other service
 * after state changes. Client polls /api/notifications every 30s.
 *
 * Same rule as audit: never throws. A failed notification
 * should never roll back a successful wallet credit.
 */

import { db } from "@/lib/db/client";
import { notifications, users } from "@/lib/db/schema";
import { eq, and, desc, count } from "drizzle-orm";
import type { NotificationTypeEnum } from "@/lib/db/schema";

// Re-export the enum type for use in other services
type NotificationType =
  | "event_registration"
  | "wallet_credit"
  | "wallet_debit"
  | "payment_approved"
  | "payment_rejected"
  | "comment_approved"
  | "comment_rejected"
  | "expense_approved"
  | "expense_rejected"
  | "expense_repaid"
  | "role_changed"
  | "general";

export interface CreateNotificationParams {
  userId: string;
  type:   NotificationType;
  title:  string;
  body:   string;
  link?:  string;
}

// ─────────────────────────────────────────────────────────────
// CREATE
// ─────────────────────────────────────────────────────────────

/**
 * Creates a single notification for a user.
 * Never throws.
 */
export async function createNotification(params: CreateNotificationParams): Promise<void> {
  try {
    await db.insert(notifications).values({
      userId: params.userId,
      type:   params.type as any,
      title:  params.title,
      body:   params.body,
      link:   params.link ?? null,
    });
  } catch (err) {
    console.error("[NotificationService] Failed to create notification:", err);
  }
}

/**
 * Creates notifications for multiple users at once.
 * Used for broadcast notifications (e.g. new event published).
 * Never throws.
 */
export async function createBulkNotifications(
  userIds: string[],
  params: Omit<CreateNotificationParams, "userId">
): Promise<void> {
  if (userIds.length === 0) return;
  try {
    await db.insert(notifications).values(
      userIds.map((userId) => ({
        userId,
        type:  params.type as any,
        title: params.title,
        body:  params.body,
        link:  params.link ?? null,
      }))
    );
  } catch (err) {
    console.error("[NotificationService] Failed to create bulk notifications:", err);
  }
}

// ─────────────────────────────────────────────────────────────
// PRE-BUILT NOTIFICATION HELPERS
// Call these from other services — don't construct params manually.
// ─────────────────────────────────────────────────────────────

export async function notifyWalletCredit(params: {
  userId:      string;
  amountMb:    number;
  description: string;
}) {
  await createNotification({
    userId: params.userId,
    type:   "wallet_credit",
    title:  `₥${params.amountMb.toLocaleString()} credited to your wallet`,
    body:   params.description,
    link:   "/wallet",
  });
}

export async function notifyWalletDebit(params: {
  userId:      string;
  amountMb:    number;
  description: string;
}) {
  await createNotification({
    userId: params.userId,
    type:   "wallet_debit",
    title:  `₥${params.amountMb.toLocaleString()} debited from your wallet`,
    body:   params.description,
    link:   "/wallet",
  });
}

export async function notifyPaymentApproved(params: {
  userId:    string;
  amountInr: number;
  amountMb:  number;
}) {
  await createNotification({
    userId: params.userId,
    type:   "payment_approved",
    title:  "Payment request approved",
    body:   `Your payment of ₹${params.amountInr} has been verified. ₥${params.amountMb.toLocaleString()} has been added to your wallet.`,
    link:   "/wallet",
  });
}

export async function notifyPaymentRejected(params: {
  userId:    string;
  amountInr: number;
  reason?:   string;
}) {
  await createNotification({
    userId: params.userId,
    type:   "payment_rejected",
    title:  "Payment request not approved",
    body:   params.reason
      ? `Your payment of ₹${params.amountInr} was rejected. Reason: ${params.reason}`
      : `Your payment of ₹${params.amountInr} could not be verified. Please contact a treasurer.`,
    link:   "/dashboard",
  });
}

export async function notifyEventRegistration(params: {
  userId:     string;
  eventTitle: string;
  eventId:    string;
}) {
  await createNotification({
    userId: params.userId,
    type:   "event_registration",
    title:  "Registration confirmed",
    body:   `You're registered for "${params.eventTitle}". See you there!`,
    link:   `/events/${params.eventId}`,
  });
}

export async function notifyCommentApproved(params: {
  userId:  string;
  eventId: string;
  eventTitle: string;
}) {
  await createNotification({
    userId: params.userId,
    type:   "comment_approved",
    title:  "Your comment was approved",
    body:   `Your comment on "${params.eventTitle}" is now visible.`,
    link:   `/events/${params.eventId}`,
  });
}

export async function notifyCommentRejected(params: {
  userId: string;
  reason?: string;
}) {
  await createNotification({
    userId: params.userId,
    type:   "comment_rejected",
    title:  "Your comment was not approved",
    body:   params.reason ?? "Your comment did not meet our community guidelines.",
    link:   "/dashboard",
  });
}

export async function notifyRoleChanged(params: {
  userId:  string;
  newRole: string;
}) {
  await createNotification({
    userId: params.userId,
    type:   "role_changed",
    title:  "Your role has been updated",
    body:   `You have been assigned the "${params.newRole}" role on NexCell.`,
    link:   "/dashboard",
  });
}

export async function notifyExpenseApproved(params: {
  userId:    string;
  amountInr: number;
}) {
  await createNotification({
    userId: params.userId,
    type:   "expense_approved",
    title:  "Expense request approved",
    body:   `Your expense of ₹${params.amountInr} has been approved. The treasurer will repay you shortly.`,
    link:   "/dashboard",
  });
}

export async function notifyExpenseRepaid(params: {
  userId:    string;
  amountInr: number;
}) {
  await createNotification({
    userId: params.userId,
    type:   "expense_repaid",
    title:  "Expense repaid",
    body:   `Your expense of ₹${params.amountInr} has been marked as repaid.`,
    link:   "/dashboard",
  });
}

// ─────────────────────────────────────────────────────────────
// QUERIES
// ─────────────────────────────────────────────────────────────

/**
 * Gets unread notification count for a user.
 * Used for the notification badge in the navbar.
 */
export async function getUnreadCount(userId: string): Promise<number> {
  const [result] = await db
    .select({ count: count() })
    .from(notifications)
    .where(and(eq(notifications.userId, userId), eq(notifications.isRead, false)));

  return result?.count ?? 0;
}

/**
 * Gets paginated notifications for a user.
 */
export async function getUserNotifications(
  userId: string,
  limit  = 20,
  offset = 0
) {
  return db
    .select()
    .from(notifications)
    .where(eq(notifications.userId, userId))
    .orderBy(desc(notifications.createdAt))
    .limit(limit)
    .offset(offset);
}

/**
 * Marks specific notifications as read.
 */
export async function markAsRead(userId: string, notificationIds: string[]): Promise<void> {
  if (notificationIds.length === 0) return;

  // Only mark notifications belonging to this user (security check)
  for (const id of notificationIds) {
    await db
      .update(notifications)
      .set({ isRead: true })
      .where(and(eq(notifications.id, id), eq(notifications.userId, userId)));
  }
}

/**
 * Marks ALL notifications as read for a user.
 */
export async function markAllAsRead(userId: string): Promise<void> {
  await db
    .update(notifications)
    .set({ isRead: true })
    .where(and(eq(notifications.userId, userId), eq(notifications.isRead, false)));
}
