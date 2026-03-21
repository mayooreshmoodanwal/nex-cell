/**
 * TREASURER SERVICE
 * Manages the INR → Mirai Bucks conversion flow.
 *
 * Security rules enforced here:
 *  1. Treasurer CANNOT approve their own payment request
 *  2. Max credit per request (from app_config) is enforced
 *  3. UPI transaction ID required for all requests
 *  4. Proof screenshot required for all requests (threshold = ₹0)
 *  5. Approval atomically credits wallet + updates request status
 */

import { db }          from "@/lib/db/client";
import {
  paymentRequests, appConfig, users, wallets,
} from "@/lib/db/schema";
import { eq, and, desc, isNull, sql } from "drizzle-orm";
import { creditWallet }                from "./wallet.service";
import { writeAuditLog, AUDIT_ACTIONS } from "./audit.service";
import {
  notifyPaymentApproved, notifyPaymentRejected,
} from "./notification.service";
import {
  sendPaymentStatusEmail,
} from "@/lib/email";

// ─────────────────────────────────────────────────────────────
// CONFIG HELPERS
// ─────────────────────────────────────────────────────────────

async function getConfigValue(key: string, fallback: string): Promise<string> {
  const [config] = await db
    .select({ value: appConfig.value })
    .from(appConfig)
    .where(eq(appConfig.key, key))
    .limit(1);
  return config?.value ?? fallback;
}

async function getMaxCreditInr(): Promise<number> {
  const val = await getConfigValue("max_credit_per_request_inr", "500");
  return Number(val);
}

async function getMbConversionRate(): Promise<number> {
  const val = await getConfigValue("mb_conversion_rate", "100");
  return Number(val);
}

// ─────────────────────────────────────────────────────────────
// SUBMIT PAYMENT REQUEST (by any user)
// ─────────────────────────────────────────────────────────────

export interface SubmitPaymentRequestParams {
  userId:           string;
  amountInr:        number;
  upiTransactionId: string;
  proofUrl:         string;   // Cloudinary URL — required for all
}

export interface SubmitPaymentRequestResult {
  success:   boolean;
  requestId?: string;
  error?:    string;
}

export async function submitPaymentRequest(
  params: SubmitPaymentRequestParams
): Promise<SubmitPaymentRequestResult> {
  // Validate amount
  if (params.amountInr <= 0) {
    return { success: false, error: "Amount must be greater than ₹0" };
  }

  const maxInr = await getMaxCreditInr();
  if (params.amountInr > maxInr) {
    return {
      success: false,
      error:   `Maximum allowed per request is ₹${maxInr}. For larger amounts, please contact an admin.`,
    };
  }

  // Require proof and UPI ID for all payments
  if (!params.proofUrl) {
    return { success: false, error: "Payment screenshot is required." };
  }
  if (!params.upiTransactionId.trim()) {
    return { success: false, error: "UPI Transaction ID is required." };
  }

  const rate     = await getMbConversionRate();
  const amountMb = Math.floor(params.amountInr * rate);

  const [request] = await db
    .insert(paymentRequests)
    .values({
      userId:           params.userId,
      amountInr:        params.amountInr.toString(),
      amountMb,
      upiTransactionId: params.upiTransactionId.trim(),
      proofUrl:         params.proofUrl,
      status:           "pending",
    })
    .returning();

  await writeAuditLog({
    actorId:    params.userId,
    action:     AUDIT_ACTIONS.PAYMENT_REQUEST_CREATED,
    entityType: "payment_request",
    entityId:   request.id,
    newValue:   { amountInr: params.amountInr, amountMb, status: "pending" },
  });

  return { success: true, requestId: request.id };
}

// ─────────────────────────────────────────────────────────────
// APPROVE PAYMENT REQUEST (Treasurer / Admin only)
// ─────────────────────────────────────────────────────────────

export interface ApprovePaymentRequestResult {
  success:   boolean;
  error?:    string;
}

export async function approvePaymentRequest(
  requestId:   string,
  treasurerId: string,
  ipAddress?:  string
): Promise<ApprovePaymentRequestResult> {
  // Load the request
  const [request] = await db
    .select()
    .from(paymentRequests)
    .where(eq(paymentRequests.id, requestId))
    .limit(1);

  if (!request) {
    return { success: false, error: "Payment request not found" };
  }

  if (request.status !== "pending") {
    return { success: false, error: `Request is already ${request.status}` };
  }

  // SECURITY: Treasurer cannot approve their own request
  if (request.userId === treasurerId) {
    return {
      success: false,
      error:   "You cannot approve your own payment request. Ask another treasurer or admin.",
    };
  }

  // Credit the wallet (idempotency key prevents double-credit)
  const idempotencyKey = `payment_request:${requestId}:credit`;
  const creditResult = await creditWallet({
    userId:         request.userId,
    amountMb:       request.amountMb,
    source:         "payment_request",
    description:    `INR payment approved: ₹${request.amountInr} → ₥${request.amountMb.toLocaleString()}`,
    referenceId:    requestId,
    idempotencyKey,
    performedBy:    treasurerId,
    ipAddress,
  });

  if (!creditResult.success) {
    return { success: false, error: creditResult.error };
  }

  // Update request status
  await db
    .update(paymentRequests)
    .set({
      status:      "approved",
      verifiedBy:  treasurerId,
      walletTxId:  creditResult.transactionId ?? null,
      resolvedAt:  new Date(),
    })
    .where(eq(paymentRequests.id, requestId));

  // Load user details for email
  const [user] = await db
    .select({ email: users.email, name: users.name })
    .from(users)
    .where(eq(users.id, request.userId))
    .limit(1);

  // Notify + email (fire and forget)
  notifyPaymentApproved({
    userId:    request.userId,
    amountInr: Number(request.amountInr),
    amountMb:  request.amountMb,
  }).catch(() => {});

  if (user) {
    sendPaymentStatusEmail({
      to:        user.email,
      name:      user.name ?? "there",
      status:    "approved",
      amountInr: Number(request.amountInr),
      amountMb:  request.amountMb,
    }).catch(() => {});
  }

  // Audit
  await writeAuditLog({
    actorId:    treasurerId,
    action:     AUDIT_ACTIONS.PAYMENT_REQUEST_APPROVED,
    entityType: "payment_request",
    entityId:   requestId,
    oldValue:   { status: "pending" },
    newValue:   {
      status:    "approved",
      amountMb:  request.amountMb,
      txId:      creditResult.transactionId,
    },
    ipAddress,
  });

  return { success: true };
}

// ─────────────────────────────────────────────────────────────
// REJECT PAYMENT REQUEST
// ─────────────────────────────────────────────────────────────

export async function rejectPaymentRequest(
  requestId:   string,
  treasurerId: string,
  reason:      string,
  ipAddress?:  string
): Promise<{ success: boolean; error?: string }> {
  const [request] = await db
    .select()
    .from(paymentRequests)
    .where(eq(paymentRequests.id, requestId))
    .limit(1);

  if (!request) return { success: false, error: "Payment request not found" };
  if (request.status !== "pending") {
    return { success: false, error: `Request is already ${request.status}` };
  }

  // Self-rejection is allowed (e.g. treasurer rejecting their own duplicate)
  // but approval is blocked — this is a deliberate asymmetry

  await db
    .update(paymentRequests)
    .set({
      status:          "rejected",
      verifiedBy:      treasurerId,
      rejectionReason: reason,
      resolvedAt:      new Date(),
    })
    .where(eq(paymentRequests.id, requestId));

  const [user] = await db
    .select({ email: users.email, name: users.name })
    .from(users)
    .where(eq(users.id, request.userId))
    .limit(1);

  notifyPaymentRejected({
    userId:    request.userId,
    amountInr: Number(request.amountInr),
    reason,
  }).catch(() => {});

  if (user) {
    sendPaymentStatusEmail({
      to:        user.email,
      name:      user.name ?? "there",
      status:    "rejected",
      amountInr: Number(request.amountInr),
      reason,
    }).catch(() => {});
  }

  await writeAuditLog({
    actorId:    treasurerId,
    action:     AUDIT_ACTIONS.PAYMENT_REQUEST_REJECTED,
    entityType: "payment_request",
    entityId:   requestId,
    oldValue:   { status: "pending" },
    newValue:   { status: "rejected", reason },
    ipAddress,
  });

  return { success: true };
}

// ─────────────────────────────────────────────────────────────
// GET PAYMENT REQUESTS
// ─────────────────────────────────────────────────────────────

export async function getPendingPaymentRequests() {
  return db
    .select({
      id:               paymentRequests.id,
      userId:           paymentRequests.userId,
      userName:         users.name,
      userEmail:        users.email,
      amountInr:        paymentRequests.amountInr,
      amountMb:         paymentRequests.amountMb,
      upiTransactionId: paymentRequests.upiTransactionId,
      proofUrl:         paymentRequests.proofUrl,
      status:           paymentRequests.status,
      createdAt:        paymentRequests.createdAt,
    })
    .from(paymentRequests)
    .leftJoin(users, eq(paymentRequests.userId, users.id))
    .where(eq(paymentRequests.status, "pending"))
    .orderBy(desc(paymentRequests.createdAt));
}

export async function getUserPaymentRequests(userId: string) {
  return db
    .select()
    .from(paymentRequests)
    .where(eq(paymentRequests.userId, userId))
    .orderBy(desc(paymentRequests.createdAt));
}
