/**
 * EVENT SERVICE
 * Handles event CRUD, registration (with wallet deduction for paid events),
 * likes, and the archive query.
 */

import { db }          from "@/lib/db/client";
import {
  events, eventRegistrations, eventLikes, users, wallets,
} from "@/lib/db/schema";
import { eq, and, desc, lt, gte, isNull, count, sql } from "drizzle-orm";
import { debitWallet }                from "./wallet.service";
import { writeAuditLog, AUDIT_ACTIONS } from "./audit.service";
import {
  notifyEventRegistration,
} from "./notification.service";
import {
  sendEventRegistrationEmail,
} from "@/lib/email";
import { nanoid } from "nanoid";

// ─────────────────────────────────────────────────────────────
// QUERIES
// ─────────────────────────────────────────────────────────────

export async function getEvents(filters: {
  type?:       "free" | "paid_mb";
  upcoming?:   boolean;
  archived?:   boolean;
  limit?:      number;
  offset?:     number;
  userId?:     string;  // For liked/registered status
}) {
  const { limit = 20, offset = 0 } = filters;
  const now = new Date();

  const rows = await db
    .select({
      id:                   events.id,
      title:                events.title,
      shortDescription:     events.shortDescription,
      description:          events.description,
      eventDate:            events.eventDate,
      registrationDeadline: events.registrationDeadline,
      type:                 events.type,
      priceMb:              events.priceMb,
      maxParticipants:      events.maxParticipants,
      imageUrl:             events.imageUrl,
      venue:                events.venue,
      tags:                 events.tags,
      createdAt:            events.createdAt,
      createdBy:            events.createdBy,
      creatorName:          users.name,
      registrationCount:    sql<number>`(
        SELECT COUNT(*) FROM event_registrations
        WHERE event_id = ${events.id} AND status = 'confirmed'
      )`,
      likeCount: sql<number>`(
        SELECT COUNT(*) FROM event_likes WHERE event_id = ${events.id}
      )`,
    })
    .from(events)
    .leftJoin(users, eq(events.createdBy, users.id))
    .where(
      and(
        eq(events.isDeleted, false),
        eq(events.isPublished, true),
        filters.archived
          ? lt(events.eventDate, now)
          : gte(events.eventDate, now),
        filters.type ? eq(events.type, filters.type) : undefined,
      )
    )
    .orderBy(filters.archived ? desc(events.eventDate) : events.eventDate)
    .limit(limit)
    .offset(offset);

  return rows;
}

export async function getEventById(id: string, userId?: string) {
  const [event] = await db
    .select({
      id:                   events.id,
      title:                events.title,
      description:          events.description,
      shortDescription:     events.shortDescription,
      eventDate:            events.eventDate,
      registrationDeadline: events.registrationDeadline,
      type:                 events.type,
      priceMb:              events.priceMb,
      maxParticipants:      events.maxParticipants,
      imageUrl:             events.imageUrl,
      venue:                events.venue,
      tags:                 events.tags,
      autoApproveComments:  events.autoApproveComments,
      createdAt:            events.createdAt,
      createdBy:            events.createdBy,
      updatedBy:            events.updatedBy,
      creatorName:          users.name,
      isDeleted:            events.isDeleted,
      registrationCount: sql<number>`(
        SELECT COUNT(*) FROM event_registrations
        WHERE event_id = ${events.id} AND status = 'confirmed'
      )`,
      likeCount: sql<number>`(
        SELECT COUNT(*) FROM event_likes WHERE event_id = ${events.id}
      )`,
    })
    .from(events)
    .leftJoin(users, eq(events.createdBy, users.id))
    .where(eq(events.id, id))
    .limit(1);

  if (!event || event.isDeleted) return null;

  // Add user-specific data if userId provided
  let isRegistered = false;
  let isLiked = false;

  if (userId) {
    const [reg] = await db
      .select({ id: eventRegistrations.id })
      .from(eventRegistrations)
      .where(and(eq(eventRegistrations.eventId, id), eq(eventRegistrations.userId, userId)))
      .limit(1);
    isRegistered = !!reg;

    const [like] = await db
      .select({ id: eventLikes.id })
      .from(eventLikes)
      .where(and(eq(eventLikes.eventId, id), eq(eventLikes.userId, userId)))
      .limit(1);
    isLiked = !!like;
  }

  return { ...event, isRegistered, isLiked };
}

// ─────────────────────────────────────────────────────────────
// CREATE / EDIT / DELETE
// ─────────────────────────────────────────────────────────────

export async function createEvent(
  data: {
    title:                string;
    description:          string;
    shortDescription?:    string;
    eventDate:            Date;
    registrationDeadline: Date;
    type:                 "free" | "paid_mb";
    priceMb?:             number;
    maxParticipants?:     number;
    imageUrl?:            string;
    venue?:               string;
    tags?:                string[];
  },
  createdBy: string,
  ipAddress?: string
) {
  const [event] = await db
    .insert(events)
    .values({ ...data, createdBy })
    .returning();

  await writeAuditLog({
    actorId:    createdBy,
    action:     AUDIT_ACTIONS.EVENT_CREATED,
    entityType: "event",
    entityId:   event.id,
    newValue:   { title: data.title, type: data.type },
    ipAddress,
  });

  return event;
}

export async function updateEvent(
  id:        string,
  data:      Partial<{
    title:                string;
    description:          string;
    shortDescription:     string;
    eventDate:            Date;
    registrationDeadline: Date;
    type:                 "free" | "paid_mb";
    priceMb:              number;
    maxParticipants:      number;
    imageUrl:             string;
    venue:                string;
    tags:                 string[];
    isPublished:          boolean;
    autoApproveComments:  boolean;
  }>,
  updatedBy: string,
  ipAddress?: string
) {
  const [existing] = await db.select().from(events).where(eq(events.id, id)).limit(1);
  if (!existing || existing.isDeleted) return null;

  const [updated] = await db
    .update(events)
    .set({ ...data, updatedBy, updatedAt: new Date() })
    .where(eq(events.id, id))
    .returning();

  await writeAuditLog({
    actorId:    updatedBy,
    action:     AUDIT_ACTIONS.EVENT_UPDATED,
    entityType: "event",
    entityId:   id,
    oldValue:   existing as Record<string, unknown>,
    newValue:   data as Record<string, unknown>,
    ipAddress,
  });

  return updated;
}

export async function deleteEvent(id: string, deletedBy: string, ipAddress?: string) {
  await db.update(events).set({ isDeleted: true, updatedBy: deletedBy }).where(eq(events.id, id));

  await writeAuditLog({
    actorId:    deletedBy,
    action:     AUDIT_ACTIONS.EVENT_DELETED,
    entityType: "event",
    entityId:   id,
    ipAddress,
  });
}

// ─────────────────────────────────────────────────────────────
// REGISTRATION
// ─────────────────────────────────────────────────────────────

export interface RegisterForEventResult {
  success:   boolean;
  error?:    string;
}

export async function registerForEvent(
  eventId:   string,
  userId:    string,
  ipAddress?: string
): Promise<RegisterForEventResult> {
  // Load event
  const [event] = await db
    .select()
    .from(events)
    .where(eq(events.id, eventId))
    .limit(1);

  if (!event || event.isDeleted || !event.isPublished) {
    return { success: false, error: "Event not found" };
  }

  const now = new Date();
  if (event.registrationDeadline < now) {
    return { success: false, error: "Registration deadline has passed" };
  }

  // Check capacity
  if (event.maxParticipants) {
    const [{ cnt }] = await db
      .select({ cnt: count() })
      .from(eventRegistrations)
      .where(and(eq(eventRegistrations.eventId, eventId), eq(eventRegistrations.status, "confirmed")));
    if (cnt >= event.maxParticipants) {
      return { success: false, error: "This event is at full capacity" };
    }
  }

  // Idempotency key prevents duplicate registrations
  const idempotencyKey = `reg:${eventId}:${userId}`;

  // Check for existing registration
  const [existing] = await db
    .select()
    .from(eventRegistrations)
    .where(and(eq(eventRegistrations.eventId, eventId), eq(eventRegistrations.userId, userId)))
    .limit(1);

  if (existing) {
    if (existing.status === "confirmed") {
      return { success: false, error: "You are already registered for this event" };
    }
  }

  // Handle paid event — debit wallet
  let paymentStatus: "completed" | "pending" = "completed";
  if (event.type === "paid_mb" && event.priceMb) {
    const debitResult = await debitWallet({
      userId,
      amountMb:       event.priceMb,
      source:         "event_registration",
      description:    `Event registration: ${event.title}`,
      referenceId:    eventId,
      idempotencyKey: `event_reg_debit:${eventId}:${userId}`,
      ipAddress,
    });

    if (!debitResult.success) {
      return { success: false, error: debitResult.error };
    }
  }

  // Insert registration
  await db
    .insert(eventRegistrations)
    .values({
      eventId,
      userId,
      status:          "confirmed",
      paymentStatus,
      amountPaidMb:    event.priceMb ?? 0,
      idempotencyKey,
    })
    .onConflictDoUpdate({
      target: [eventRegistrations.eventId, eventRegistrations.userId],
      set:    { status: "confirmed", paymentStatus },
    });

  // Load user for email
  const [user] = await db
    .select({ email: users.email, name: users.name })
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);

  // Notify + email
  notifyEventRegistration({ userId, eventTitle: event.title, eventId }).catch(() => {});
  if (user) {
    sendEventRegistrationEmail({
      to:         user.email,
      name:       user.name ?? "there",
      eventTitle: event.title,
      eventDate:  event.eventDate,
      eventId,
      isPaid:     event.type === "paid_mb",
      amountPaid: event.priceMb ?? undefined,
    }).catch(() => {});
  }

  await writeAuditLog({
    actorId:    userId,
    action:     AUDIT_ACTIONS.EVENT_REGISTRATION,
    entityType: "event_registration",
    entityId:   eventId,
    newValue:   { userId, eventId, type: event.type },
    ipAddress,
  });

  return { success: true };
}

// ─────────────────────────────────────────────────────────────
// LIKES (toggle)
// ─────────────────────────────────────────────────────────────

export async function toggleLike(eventId: string, userId: string): Promise<{ liked: boolean }> {
  const [existing] = await db
    .select()
    .from(eventLikes)
    .where(and(eq(eventLikes.eventId, eventId), eq(eventLikes.userId, userId)))
    .limit(1);

  if (existing) {
    await db
      .delete(eventLikes)
      .where(and(eq(eventLikes.eventId, eventId), eq(eventLikes.userId, userId)));
    return { liked: false };
  }

  await db.insert(eventLikes).values({ eventId, userId });
  return { liked: true };
}

// ─────────────────────────────────────────────────────────────
// USER'S REGISTERED EVENTS
// ─────────────────────────────────────────────────────────────

export async function getUserRegistrations(userId: string) {
  return db
    .select({
      registrationId: eventRegistrations.id,
      status:         eventRegistrations.status,
      registeredAt:   eventRegistrations.registeredAt,
      amountPaidMb:   eventRegistrations.amountPaidMb,
      eventId:        events.id,
      title:          events.title,
      eventDate:      events.eventDate,
      imageUrl:       events.imageUrl,
      type:           events.type,
    })
    .from(eventRegistrations)
    .innerJoin(events, eq(eventRegistrations.eventId, events.id))
    .where(and(eq(eventRegistrations.userId, userId), eq(events.isDeleted, false)))
    .orderBy(desc(events.eventDate));
}
