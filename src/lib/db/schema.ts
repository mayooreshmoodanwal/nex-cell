/**
 * NEX-CELL DATABASE SCHEMA
 * Built with Drizzle ORM for Neon (serverless PostgreSQL)
 *
 * Tables:
 *  Auth:        users, user_roles, predefined_roles, otp_codes, refresh_tokens
 *  Events:      events, event_registrations, event_likes, comments, comment_reports
 *  Financial:   wallets, wallet_transactions, payment_requests, budgets, expenses
 *  System:      notifications, audit_logs, app_config
 */

import {
  pgTable,
  pgEnum,
  uuid,
  text,
  integer,
  boolean,
  timestamp,
  numeric,
  jsonb,
  uniqueIndex,
  index,
} from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";

// ─────────────────────────────────────────────────────────────
// ENUMS
// ─────────────────────────────────────────────────────────────

export const roleEnum = pgEnum("role", [
  "participant", // Default role on first login
  "member",      // Club member — can create events, submit expenses
  "treasurer",   // Can approve payments, manage expenses
  "admin",       // Full access
]);

export const eventTypeEnum = pgEnum("event_type", [
  "free",    // No cost to register
  "paid_mb", // Costs Mirai Bucks to register
]);

export const eventRegistrationStatusEnum = pgEnum("event_registration_status", [
  "confirmed",
  "cancelled",
  "waitlisted",
]);

export const paymentStatusEnum = pgEnum("payment_status", [
  "pending",
  "completed",
  "failed",
  "refunded",
]);

export const commentStatusEnum = pgEnum("comment_status", [
  "pending",  // Awaiting admin approval
  "approved", // Visible to all
  "rejected", // Hidden, reason stored
]);

export const walletTransactionTypeEnum = pgEnum("wallet_transaction_type", [
  "credit",  // Money coming in
  "debit",   // Money going out
]);

export const walletTransactionSourceEnum = pgEnum("wallet_transaction_source", [
  "payment_request", // INR converted to MB by treasurer
  "event_reward",    // Reward for winning/participating in event
  "event_registration", // Deducted when registering for paid event
  "admin_adjustment",   // Manual admin credit/debit with reason
  "refund",             // Refund from cancelled registration
]);

export const paymentRequestStatusEnum = pgEnum("payment_request_status", [
  "pending",
  "approved",
  "rejected",
]);

export const expenseStatusEnum = pgEnum("expense_status", [
  "pending",
  "approved",
  "rejected",
  "repaid", // Treasurer has paid the member offline
]);

export const notificationTypeEnum = pgEnum("notification_type", [
  "event_registration",   // User registered for an event
  "wallet_credit",        // Wallet was credited
  "wallet_debit",         // Wallet was debited
  "payment_approved",     // Payment request approved
  "payment_rejected",     // Payment request rejected
  "comment_approved",     // User's comment was approved
  "comment_rejected",     // User's comment was rejected
  "expense_approved",     // Expense request approved
  "expense_rejected",     // Expense request rejected
  "expense_repaid",       // Expense has been repaid
  "role_changed",         // User's role was changed
  "general",              // Generic notification
]);

// ─────────────────────────────────────────────────────────────
// TABLE 1: users
// Core identity table. Minimal data — privacy first.
// ─────────────────────────────────────────────────────────────
export const users = pgTable("users", {
  id:          uuid("id").primaryKey().defaultRandom(),
  email:       text("email").notNull().unique(),
  name:        text("name"),
  avatarUrl:   text("avatar_url"),
  isDeleted:   boolean("is_deleted").notNull().default(false),
  // Soft delete: data is anonymised, not removed.
  // When deleted: name → "Deleted User", email stays (for FK integrity)
  deletedAt:   timestamp("deleted_at", { withTimezone: true }),
  createdAt:   timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  lastLoginAt: timestamp("last_login_at", { withTimezone: true }),
});

// ─────────────────────────────────────────────────────────────
// TABLE 2: user_roles
// Junction table — a user can have multiple roles simultaneously.
// e.g. someone can be both Member + Treasurer.
// Role history is preserved (revoked_at is set, not deleted).
// ─────────────────────────────────────────────────────────────
export const userRoles = pgTable(
  "user_roles",
  {
    id:         uuid("id").primaryKey().defaultRandom(),
    userId:     uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
    role:       roleEnum("role").notNull(),
    assignedBy: uuid("assigned_by").references(() => users.id, { onDelete: "set null" }),
    assignedAt: timestamp("assigned_at", { withTimezone: true }).notNull().defaultNow(),
    revokedAt:  timestamp("revoked_at", { withTimezone: true }),
    // NULL revokedAt = active role. Set revokedAt = now() to revoke.
  },
  (table) => ({
    // A user cannot have the same role twice (active at the same time)
    uniqueActiveRole: uniqueIndex("unique_active_role").on(table.userId, table.role),
    userIdIdx: index("user_roles_user_id_idx").on(table.userId),
  })
);

// ─────────────────────────────────────────────────────────────
// TABLE 3: predefined_roles
// Emails in this table are auto-assigned their role on first login.
// Managed from the Admin UI — no code changes needed.
// ─────────────────────────────────────────────────────────────
export const predefinedRoles = pgTable("predefined_roles", {
  id:        uuid("id").primaryKey().defaultRandom(),
  email:     text("email").notNull().unique(),
  role:      roleEnum("role").notNull(),
  note:      text("note"), // e.g. "Club President 2024"
  addedBy:   uuid("added_by").references(() => users.id, { onDelete: "set null" }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

// ─────────────────────────────────────────────────────────────
// TABLE 4: otp_codes
// Time-limited, attempt-limited OTP storage.
// The actual code is HASHED (SHA-256) — never stored in plain text.
// ─────────────────────────────────────────────────────────────
export const otpCodes = pgTable(
  "otp_codes",
  {
    id:        uuid("id").primaryKey().defaultRandom(),
    email:     text("email").notNull(),
    codeHash:  text("code_hash").notNull(), // SHA-256 hash of the 6-digit OTP
    attempts:  integer("attempts").notNull().default(0), // Max 3 attempts
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(), // 5 min TTL
    usedAt:    timestamp("used_at", { withTimezone: true }), // Set when consumed
    ipAddress: text("ip_address"), // For audit/abuse detection
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    emailIdx:    index("otp_codes_email_idx").on(table.email),
    expiresIdx:  index("otp_codes_expires_idx").on(table.expiresAt),
  })
);

// ─────────────────────────────────────────────────────────────
// TABLE 5: refresh_tokens
// Long-lived tokens stored in DB for rotation + revocation.
// Token VALUE is hashed — the cookie holds the raw token.
// ─────────────────────────────────────────────────────────────
export const refreshTokens = pgTable(
  "refresh_tokens",
  {
    id:          uuid("id").primaryKey().defaultRandom(),
    userId:      uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
    tokenHash:   text("token_hash").notNull().unique(), // SHA-256 of the raw token
    expiresAt:   timestamp("expires_at", { withTimezone: true }).notNull(),
    revokedAt:   timestamp("revoked_at", { withTimezone: true }),
    deviceHint:  text("device_hint"), // e.g. "Chrome on Windows" — for display only
    ipAddress:   text("ip_address"),
    createdAt:   timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    userIdIdx: index("refresh_tokens_user_id_idx").on(table.userId),
  })
);

// ─────────────────────────────────────────────────────────────
// TABLE 6: events
// ─────────────────────────────────────────────────────────────
export const events = pgTable(
  "events",
  {
    id:                   uuid("id").primaryKey().defaultRandom(),
    title:                text("title").notNull(),
    description:          text("description").notNull(),
    shortDescription:     text("short_description"), // For cards/previews
    eventDate:            timestamp("event_date", { withTimezone: true }).notNull(),
    registrationDeadline: timestamp("registration_deadline", { withTimezone: true }).notNull(),
    type:                 eventTypeEnum("type").notNull().default("free"),
    priceMb:              integer("price_mb"), // NULL for free events
    maxParticipants:      integer("max_participants"), // NULL = unlimited
    imageUrl:             text("image_url"), // Cloudinary URL
    venue:                text("venue"),
    tags:                 text("tags").array(), // e.g. ["workshop", "hackathon"]
    autoApproveComments:  boolean("auto_approve_comments").notNull().default(false),
    isPublished:          boolean("is_published").notNull().default(true),
    isDeleted:            boolean("is_deleted").notNull().default(false),
    createdBy:            uuid("created_by").notNull().references(() => users.id, { onDelete: "restrict" }),
    updatedBy:            uuid("updated_by").references(() => users.id, { onDelete: "set null" }),
    createdAt:            timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt:            timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    eventDateIdx:  index("events_event_date_idx").on(table.eventDate),
    createdByIdx:  index("events_created_by_idx").on(table.createdBy),
  })
);

// ─────────────────────────────────────────────────────────────
// TABLE 7: event_registrations
// ─────────────────────────────────────────────────────────────
export const eventRegistrations = pgTable(
  "event_registrations",
  {
    id:              uuid("id").primaryKey().defaultRandom(),
    eventId:         uuid("event_id").notNull().references(() => events.id, { onDelete: "cascade" }),
    userId:          uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
    status:          eventRegistrationStatusEnum("status").notNull().default("confirmed"),
    paymentStatus:   paymentStatusEnum("payment_status").notNull().default("pending"),
    amountPaidMb:    integer("amount_paid_mb").notNull().default(0),
    idempotencyKey:  text("idempotency_key").notNull().unique(),
    // Key = "reg:{eventId}:{userId}" — prevents double registration
    registeredAt:    timestamp("registered_at", { withTimezone: true }).notNull().defaultNow(),
    cancelledAt:     timestamp("cancelled_at", { withTimezone: true }),
  },
  (table) => ({
    // One registration per user per event
    uniqueRegistration: uniqueIndex("unique_event_registration").on(table.eventId, table.userId),
    eventIdIdx:  index("event_registrations_event_id_idx").on(table.eventId),
    userIdIdx:   index("event_registrations_user_id_idx").on(table.userId),
  })
);

// ─────────────────────────────────────────────────────────────
// TABLE 8: event_likes
// ─────────────────────────────────────────────────────────────
export const eventLikes = pgTable(
  "event_likes",
  {
    id:        uuid("id").primaryKey().defaultRandom(),
    eventId:   uuid("event_id").notNull().references(() => events.id, { onDelete: "cascade" }),
    userId:    uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    uniqueLike: uniqueIndex("unique_event_like").on(table.eventId, table.userId),
  })
);

// ─────────────────────────────────────────────────────────────
// TABLE 9: comments
// ─────────────────────────────────────────────────────────────
export const comments = pgTable(
  "comments",
  {
    id:           uuid("id").primaryKey().defaultRandom(),
    eventId:      uuid("event_id").notNull().references(() => events.id, { onDelete: "cascade" }),
    userId:       uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
    body:         text("body").notNull(),
    status:       commentStatusEnum("status").notNull().default("pending"),
    moderatedBy:  uuid("moderated_by").references(() => users.id, { onDelete: "set null" }),
    moderatedAt:  timestamp("moderated_at", { withTimezone: true }),
    rejectionReason: text("rejection_reason"),
    // Soft delete — never hard delete a comment
    deletedAt:    timestamp("deleted_at", { withTimezone: true }),
    deletedBy:    uuid("deleted_by").references(() => users.id, { onDelete: "set null" }),
    createdAt:    timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt:    timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    eventIdIdx: index("comments_event_id_idx").on(table.eventId),
    statusIdx:  index("comments_status_idx").on(table.status),
  })
);

// ─────────────────────────────────────────────────────────────
// TABLE 10: comment_reports
// ─────────────────────────────────────────────────────────────
export const commentReports = pgTable(
  "comment_reports",
  {
    id:          uuid("id").primaryKey().defaultRandom(),
    commentId:   uuid("comment_id").notNull().references(() => comments.id, { onDelete: "cascade" }),
    reportedBy:  uuid("reported_by").notNull().references(() => users.id, { onDelete: "cascade" }),
    reason:      text("reason").notNull(),
    createdAt:   timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    uniqueReport: uniqueIndex("unique_comment_report").on(table.commentId, table.reportedBy),
  })
);

// ─────────────────────────────────────────────────────────────
// TABLE 11: wallets
// One wallet per user. Balance is maintained here AND verified
// against the ledger sum on every write (inside a DB transaction).
// ─────────────────────────────────────────────────────────────
export const wallets = pgTable("wallets", {
  id:          uuid("id").primaryKey().defaultRandom(),
  userId:      uuid("user_id").notNull().unique().references(() => users.id, { onDelete: "cascade" }),
  balanceMb:   integer("balance_mb").notNull().default(0),
  // CONSTRAINT: balance_mb >= 0 — enforced at DB level
  updatedAt:   timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

// ─────────────────────────────────────────────────────────────
// TABLE 12: wallet_transactions
// The immutable ledger. Never update, never delete.
// Balance = SUM of all amount_mb for a wallet_id.
// ─────────────────────────────────────────────────────────────
export const walletTransactions = pgTable(
  "wallet_transactions",
  {
    id:              uuid("id").primaryKey().defaultRandom(),
    walletId:        uuid("wallet_id").notNull().references(() => wallets.id, { onDelete: "restrict" }),
    amountMb:        integer("amount_mb").notNull(), // Positive = credit, Negative = debit
    type:            walletTransactionTypeEnum("type").notNull(),
    source:          walletTransactionSourceEnum("source").notNull(),
    description:     text("description").notNull(), // Human-readable: "Event registration: Hackathon 2024"
    referenceId:     uuid("reference_id"), // FK to the triggering entity (payment_request, event, etc.)
    idempotencyKey:  text("idempotency_key").notNull().unique(),
    // Format: "{source}:{reference_id}" — prevents double transactions
    performedBy:     uuid("performed_by").references(() => users.id, { onDelete: "set null" }),
    // The treasurer/admin who approved the transaction
    createdAt:       timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    walletIdIdx:   index("wallet_transactions_wallet_id_idx").on(table.walletId),
    createdAtIdx:  index("wallet_transactions_created_at_idx").on(table.createdAt),
  })
);

// ─────────────────────────────────────────────────────────────
// TABLE 13: payment_requests
// A user submits this when they've paid INR offline/UPI.
// Treasurer verifies manually and approves → triggers wallet credit.
// ─────────────────────────────────────────────────────────────
export const paymentRequests = pgTable(
  "payment_requests",
  {
    id:              uuid("id").primaryKey().defaultRandom(),
    userId:          uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
    amountInr:       numeric("amount_inr", { precision: 10, scale: 2 }).notNull(),
    amountMb:        integer("amount_mb").notNull(), // Computed: amountInr * 100
    upiTransactionId: text("upi_transaction_id").notNull(), // Required for every payment
    proofUrl:        text("proof_url").notNull(), // Screenshot — required for ALL (threshold = ₹0)
    status:          paymentRequestStatusEnum("status").notNull().default("pending"),
    verifiedBy:      uuid("verified_by").references(() => users.id, { onDelete: "set null" }),
    rejectionReason: text("rejection_reason"),
    walletTxId:      uuid("wallet_tx_id").references(() => walletTransactions.id, { onDelete: "set null" }),
    // Set after successful approval — links payment to the wallet credit
    createdAt:       timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    resolvedAt:      timestamp("resolved_at", { withTimezone: true }),
  },
  (table) => ({
    userIdIdx:  index("payment_requests_user_id_idx").on(table.userId),
    statusIdx:  index("payment_requests_status_idx").on(table.status),
  })
);

// ─────────────────────────────────────────────────────────────
// TABLE 14: budgets
// Admin creates a budget allocation for club activities.
// Expenses are linked to budgets to track utilisation.
// ─────────────────────────────────────────────────────────────
export const budgets = pgTable("budgets", {
  id:               uuid("id").primaryKey().defaultRandom(),
  title:            text("title").notNull(),
  description:      text("description"),
  totalAmountInr:   numeric("total_amount_inr", { precision: 10, scale: 2 }).notNull(),
  usedAmountInr:    numeric("used_amount_inr", { precision: 10, scale: 2 }).notNull().default("0"),
  // used_amount is updated when an expense is marked "repaid"
  isActive:         boolean("is_active").notNull().default(true),
  createdBy:        uuid("created_by").notNull().references(() => users.id, { onDelete: "restrict" }),
  createdAt:        timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt:        timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

// ─────────────────────────────────────────────────────────────
// TABLE 15: expenses
// Member submits an expense they incurred for the club.
// Treasurer approves → pays offline → marks repaid.
// ─────────────────────────────────────────────────────────────
export const expenses = pgTable(
  "expenses",
  {
    id:              uuid("id").primaryKey().defaultRandom(),
    userId:          uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
    budgetId:        uuid("budget_id").references(() => budgets.id, { onDelete: "set null" }),
    amountInr:       numeric("amount_inr", { precision: 10, scale: 2 }).notNull(),
    description:     text("description").notNull(),
    proofUrl:        text("proof_url"), // Bill/receipt — optional
    status:          expenseStatusEnum("status").notNull().default("pending"),
    approvedBy:      uuid("approved_by").references(() => users.id, { onDelete: "set null" }),
    approvedAt:      timestamp("approved_at", { withTimezone: true }),
    repaidBy:        uuid("repaid_by").references(() => users.id, { onDelete: "set null" }),
    repaidAt:        timestamp("repaid_at", { withTimezone: true }),
    rejectionReason: text("rejection_reason"),
    createdAt:       timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt:       timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    userIdIdx:  index("expenses_user_id_idx").on(table.userId),
    statusIdx:  index("expenses_status_idx").on(table.status),
  })
);

// ─────────────────────────────────────────────────────────────
// TABLE 16: notifications
// In-app notification center. Polled by client every 30s.
// ─────────────────────────────────────────────────────────────
export const notifications = pgTable(
  "notifications",
  {
    id:        uuid("id").primaryKey().defaultRandom(),
    userId:    uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
    type:      notificationTypeEnum("type").notNull(),
    title:     text("title").notNull(),
    body:      text("body").notNull(),
    link:      text("link"), // e.g. "/events/abc123"
    isRead:    boolean("is_read").notNull().default(false),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    userIdIdx:  index("notifications_user_id_idx").on(table.userId),
    isReadIdx:  index("notifications_is_read_idx").on(table.isRead),
  })
);

// ─────────────────────────────────────────────────────────────
// TABLE 17: audit_logs
// Append-only. Never update or delete rows.
// Every significant action — especially financial and role changes.
// ─────────────────────────────────────────────────────────────
export const auditLogs = pgTable(
  "audit_logs",
  {
    id:          uuid("id").primaryKey().defaultRandom(),
    actorId:     uuid("actor_id").references(() => users.id, { onDelete: "set null" }),
    // NULL actorId = system action
    action:      text("action").notNull(), // e.g. "PAYMENT_REQUEST_APPROVED"
    entityType:  text("entity_type").notNull(), // e.g. "payment_request"
    entityId:    uuid("entity_id"),
    oldValue:    jsonb("old_value"), // State before the action
    newValue:    jsonb("new_value"), // State after the action
    metadata:    jsonb("metadata"),  // Extra context
    ipAddress:   text("ip_address"),
    userAgent:   text("user_agent"),
    createdAt:   timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    actorIdIdx:    index("audit_logs_actor_id_idx").on(table.actorId),
    entityTypeIdx: index("audit_logs_entity_type_idx").on(table.entityType),
    createdAtIdx:  index("audit_logs_created_at_idx").on(table.createdAt),
  })
);

// ─────────────────────────────────────────────────────────────
// TABLE 18: app_config
// Key-value store for admin-controlled settings.
// No code changes needed to update these — Admin UI handles it.
// ─────────────────────────────────────────────────────────────
export const appConfig = pgTable("app_config", {
  id:          uuid("id").primaryKey().defaultRandom(),
  key:         text("key").notNull().unique(),
  value:       text("value").notNull(),
  description: text("description"), // Explains what this config does
  updatedBy:   uuid("updated_by").references(() => users.id, { onDelete: "set null" }),
  updatedAt:   timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

// ─────────────────────────────────────────────────────────────
// RELATIONS
// Drizzle uses these for type-safe joins and query building.
// ─────────────────────────────────────────────────────────────

export const usersRelations = relations(users, ({ many, one }) => ({
  roles:               many(userRoles),
  wallet:              one(wallets, { fields: [users.id], references: [wallets.userId] }),
  eventRegistrations:  many(eventRegistrations),
  eventLikes:          many(eventLikes),
  comments:            many(comments),
  notifications:       many(notifications),
  paymentRequests:     many(paymentRequests),
  expenses:            many(expenses),
  createdEvents:       many(events, { relationName: "createdEvents" }),
}));

export const userRolesRelations = relations(userRoles, ({ one }) => ({
  user:       one(users, { fields: [userRoles.userId],     references: [users.id] }),
  assignedBy: one(users, { fields: [userRoles.assignedBy], references: [users.id] }),
}));

export const eventsRelations = relations(events, ({ many, one }) => ({
  registrations: many(eventRegistrations),
  likes:         many(eventLikes),
  comments:      many(comments),
  createdBy:     one(users, { fields: [events.createdBy], references: [users.id], relationName: "createdEvents" }),
}));

export const walletsRelations = relations(wallets, ({ one, many }) => ({
  user:         one(users, { fields: [wallets.userId], references: [users.id] }),
  transactions: many(walletTransactions),
}));

export const walletTransactionsRelations = relations(walletTransactions, ({ one }) => ({
  wallet:      one(wallets, { fields: [walletTransactions.walletId], references: [wallets.id] }),
  performedBy: one(users,   { fields: [walletTransactions.performedBy], references: [users.id] }),
}));

export const paymentRequestsRelations = relations(paymentRequests, ({ one }) => ({
  user:       one(users, { fields: [paymentRequests.userId],     references: [users.id] }),
  verifiedBy: one(users, { fields: [paymentRequests.verifiedBy], references: [users.id] }),
  walletTx:   one(walletTransactions, { fields: [paymentRequests.walletTxId], references: [walletTransactions.id] }),
}));

export const budgetsRelations = relations(budgets, ({ one, many }) => ({
  createdBy: one(users, { fields: [budgets.createdBy], references: [users.id] }),
  expenses:  many(expenses),
}));

export const expensesRelations = relations(expenses, ({ one }) => ({
  user:       one(users,   { fields: [expenses.userId],     references: [users.id] }),
  budget:     one(budgets, { fields: [expenses.budgetId],   references: [budgets.id] }),
  approvedBy: one(users,   { fields: [expenses.approvedBy], references: [users.id] }),
  repaidBy:   one(users,   { fields: [expenses.repaidBy],   references: [users.id] }),
}));

export const commentsRelations = relations(comments, ({ one, many }) => ({
  event:       one(events, { fields: [comments.eventId], references: [events.id] }),
  user:        one(users,  { fields: [comments.userId],  references: [users.id] }),
  reports:     many(commentReports),
}));

// ─────────────────────────────────────────────────────────────
// TYPE EXPORTS
// Use these TypeScript types everywhere in the codebase.
// ─────────────────────────────────────────────────────────────
export type User              = typeof users.$inferSelect;
export type NewUser           = typeof users.$inferInsert;
export type UserRole          = typeof userRoles.$inferSelect;
export type Event             = typeof events.$inferSelect;
export type NewEvent          = typeof events.$inferInsert;
export type EventRegistration = typeof eventRegistrations.$inferSelect;
export type EventLike         = typeof eventLikes.$inferSelect;
export type Comment           = typeof comments.$inferSelect;
export type Wallet            = typeof wallets.$inferSelect;
export type WalletTransaction = typeof walletTransactions.$inferSelect;
export type PaymentRequest    = typeof paymentRequests.$inferSelect;
export type Budget            = typeof budgets.$inferSelect;
export type Expense           = typeof expenses.$inferSelect;
export type Notification      = typeof notifications.$inferSelect;
export type AuditLog          = typeof auditLogs.$inferSelect;
export type AppConfig         = typeof appConfig.$inferSelect;

// Role type for use in application logic
export type Role = "participant" | "member" | "treasurer" | "admin";
