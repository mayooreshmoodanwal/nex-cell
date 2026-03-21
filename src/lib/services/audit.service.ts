/**
 * AUDIT SERVICE
 * Append-only logging for every significant action in the system.
 * Called by every other service — never skipped, never optional.
 *
 * Rule: This function NEVER throws. If the audit write fails,
 * it logs the error but does NOT fail the parent operation.
 * A failed audit is bad — a failed payment because of audit is worse.
 */

import { db } from "@/lib/db/client";
import { auditLogs } from "@/lib/db/schema";

// ─────────────────────────────────────────────────────────────
// ACTION CONSTANTS
// Use these string constants everywhere — no magic strings.
// ─────────────────────────────────────────────────────────────

export const AUDIT_ACTIONS = {
  // Auth
  USER_LOGIN:               "USER_LOGIN",
  USER_LOGOUT:              "USER_LOGOUT",
  USER_CREATED:             "USER_CREATED",
  USER_DELETED:             "USER_DELETED",

  // Roles
  ROLE_ASSIGNED:            "ROLE_ASSIGNED",
  ROLE_REVOKED:             "ROLE_REVOKED",

  // Events
  EVENT_CREATED:            "EVENT_CREATED",
  EVENT_UPDATED:            "EVENT_UPDATED",
  EVENT_DELETED:            "EVENT_DELETED",
  EVENT_REGISTRATION:       "EVENT_REGISTRATION",
  EVENT_UNREGISTRATION:     "EVENT_UNREGISTRATION",

  // Wallet
  WALLET_CREDITED:          "WALLET_CREDITED",
  WALLET_DEBITED:           "WALLET_DEBITED",

  // Payment requests
  PAYMENT_REQUEST_CREATED:  "PAYMENT_REQUEST_CREATED",
  PAYMENT_REQUEST_APPROVED: "PAYMENT_REQUEST_APPROVED",
  PAYMENT_REQUEST_REJECTED: "PAYMENT_REQUEST_REJECTED",

  // Expenses
  EXPENSE_SUBMITTED:        "EXPENSE_SUBMITTED",
  EXPENSE_APPROVED:         "EXPENSE_APPROVED",
  EXPENSE_REJECTED:         "EXPENSE_REJECTED",
  EXPENSE_REPAID:           "EXPENSE_REPAID",

  // Budget
  BUDGET_CREATED:           "BUDGET_CREATED",
  BUDGET_UPDATED:           "BUDGET_UPDATED",

  // Comments
  COMMENT_APPROVED:         "COMMENT_APPROVED",
  COMMENT_REJECTED:         "COMMENT_REJECTED",
  COMMENT_DELETED:          "COMMENT_DELETED",

  // Config
  CONFIG_UPDATED:           "CONFIG_UPDATED",

  // Predefined roles
  PREDEFINED_ROLE_ADDED:    "PREDEFINED_ROLE_ADDED",
  PREDEFINED_ROLE_REMOVED:  "PREDEFINED_ROLE_REMOVED",
} as const;

export type AuditAction = typeof AUDIT_ACTIONS[keyof typeof AUDIT_ACTIONS];

// ─────────────────────────────────────────────────────────────
// TYPES
// ─────────────────────────────────────────────────────────────

export interface AuditEntry {
  actorId?:    string | null;   // The user who performed the action (null = system)
  action:      AuditAction;
  entityType:  string;          // e.g. "payment_request", "user", "event"
  entityId?:   string | null;   // The ID of the affected entity
  oldValue?:   Record<string, unknown> | null;
  newValue?:   Record<string, unknown> | null;
  metadata?:   Record<string, unknown> | null;
  ipAddress?:  string | null;
  userAgent?:  string | null;
}

// ─────────────────────────────────────────────────────────────
// WRITE AUDIT LOG
// ─────────────────────────────────────────────────────────────

/**
 * Writes an audit log entry.
 * Never throws — catches all errors internally.
 * Always call this AFTER the main operation succeeds.
 */
export async function writeAuditLog(entry: AuditEntry): Promise<void> {
  try {
    await db.insert(auditLogs).values({
      actorId:    entry.actorId ?? null,
      action:     entry.action,
      entityType: entry.entityType,
      entityId:   entry.entityId ?? null,
      oldValue:   entry.oldValue ?? null,
      newValue:   entry.newValue ?? null,
      metadata:   entry.metadata ?? null,
      ipAddress:  entry.ipAddress ?? null,
      userAgent:  entry.userAgent ?? null,
    });
  } catch (err) {
    // Audit failure is logged but NEVER propagated
    console.error("[AuditService] Failed to write audit log:", {
      action: entry.action,
      entityType: entry.entityType,
      entityId: entry.entityId,
      error: err,
    });
  }
}

// ─────────────────────────────────────────────────────────────
// QUERY AUDIT LOGS (Admin only)
// ─────────────────────────────────────────────────────────────

export interface AuditLogFilters {
  actorId?:    string;
  entityType?: string;
  action?:     string;
  fromDate?:   Date;
  toDate?:     Date;
  limit?:      number;
  offset?:     number;
}

export async function getAuditLogs(filters: AuditLogFilters = {}) {
  const {
    limit  = 50,
    offset = 0,
  } = filters;

  // Build query with Drizzle
  // Using raw SQL conditions for flexibility with optional filters
  const logs = await db.query.auditLogs.findMany({
    with: {
      // actor relation isn't set up in schema, so we'll do a separate lookup
    },
    orderBy: (auditLogs, { desc }) => [desc(auditLogs.createdAt)],
    limit,
    offset,
  });

  return logs;
}
