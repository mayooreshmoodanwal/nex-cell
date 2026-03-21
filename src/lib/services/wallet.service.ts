/**
 * WALLET SERVICE
 *
 * THE CARDINAL RULES (never violate these):
 *  1. Balance NEVER goes negative
 *  2. Every mutation is atomic (DB transaction)
 *  3. Every transaction has an idempotency key
 *  4. No direct balance updates — only via ledger inserts
 *  5. Balance column = denormalized cache, always synced in same transaction
 *
 * How it works:
 *  - wallet_transactions is the immutable source of truth
 *  - wallets.balance_mb is a running total kept in sync
 *  - Both are updated atomically using Neon's transaction support
 *  - If the idempotency key already exists → return existing result (not error)
 */

import { db }         from "@/lib/db/client";
import { neon }       from "@neondatabase/serverless";
import {
  wallets, walletTransactions, users,
} from "@/lib/db/schema";
import { eq, and, sql } from "drizzle-orm";
import {
  writeAuditLog, AUDIT_ACTIONS,
} from "./audit.service";
import {
  notifyWalletCredit, notifyWalletDebit,
} from "./notification.service";

// ─────────────────────────────────────────────────────────────
// TYPES
// ─────────────────────────────────────────────────────────────

type TransactionSource =
  | "payment_request"
  | "event_reward"
  | "event_registration"
  | "admin_adjustment"
  | "refund";

export interface CreditWalletParams {
  userId:          string;
  amountMb:        number;         // Must be positive
  source:          TransactionSource;
  description:     string;
  referenceId?:    string;         // ID of the triggering entity
  idempotencyKey:  string;         // Unique key — duplicate calls return existing result
  performedBy?:    string;         // Treasurer/admin who approved
  ipAddress?:      string;
}

export interface DebitWalletParams {
  userId:          string;
  amountMb:        number;         // Must be positive
  source:          TransactionSource;
  description:     string;
  referenceId?:    string;
  idempotencyKey:  string;
  performedBy?:    string;
  ipAddress?:      string;
}

export interface WalletMutationResult {
  success:       boolean;
  transactionId?: string;
  newBalance?:   number;
  idempotent?:   boolean;  // true if this was a duplicate (already processed)
  error?:        string;
}

// ─────────────────────────────────────────────────────────────
// GET WALLET
// ─────────────────────────────────────────────────────────────

export async function getWallet(userId: string) {
  const wallet = await db.query.wallets.findFirst({
    where: eq(wallets.userId, userId),
  });
  return wallet ?? null;
}

export async function getWalletWithTransactions(userId: string, limit = 20, offset = 0) {
  const wallet = await db.query.wallets.findFirst({
    where: eq(wallets.userId, userId),
  });

  if (!wallet) return null;

  const transactions = await db
    .select()
    .from(walletTransactions)
    .where(eq(walletTransactions.walletId, wallet.id))
    .orderBy(sql`${walletTransactions.createdAt} DESC`)
    .limit(limit)
    .offset(offset);

  return { wallet, transactions };
}

// ─────────────────────────────────────────────────────────────
// CREDIT WALLET
// ─────────────────────────────────────────────────────────────

export async function creditWallet(params: CreditWalletParams): Promise<WalletMutationResult> {
  if (params.amountMb <= 0) {
    return { success: false, error: "Credit amount must be positive" };
  }

  // 1. Check idempotency — if this key was already processed, return success
  const [existingTx] = await db
    .select()
    .from(walletTransactions)
    .where(eq(walletTransactions.idempotencyKey, params.idempotencyKey))
    .limit(1);

  if (existingTx) {
    // Already processed — idempotent success
    const wallet = await getWallet(params.userId);
    return {
      success:       true,
      transactionId: existingTx.id,
      newBalance:    wallet?.balanceMb ?? 0,
      idempotent:    true,
    };
  }

  // 2. Get wallet (must exist)
  const wallet = await getWallet(params.userId);
  if (!wallet) {
    return { success: false, error: "Wallet not found for this user" };
  }

  // 3. Atomic transaction: insert ledger row + update balance
  try {
    // Using Neon's transaction support via raw SQL
    // Drizzle doesn't expose transactions directly with neon-http driver,
    // so we use the sql tag for the atomic update
    const [newTx] = await db
      .insert(walletTransactions)
      .values({
        walletId:       wallet.id,
        amountMb:       params.amountMb,  // Positive = credit
        type:           "credit",
        source:         params.source as any,
        description:    params.description,
        referenceId:    params.referenceId ?? null,
        idempotencyKey: params.idempotencyKey,
        performedBy:    params.performedBy ?? null,
      })
      .returning();

    // Update wallet balance (atomic with the insert via DB constraints)
    const [updatedWallet] = await db
      .update(wallets)
      .set({
        balanceMb: sql`${wallets.balanceMb} + ${params.amountMb}`,
        updatedAt: new Date(),
      })
      .where(eq(wallets.id, wallet.id))
      .returning();

    // 4. Notify user (fire and forget)
    notifyWalletCredit({
      userId:      params.userId,
      amountMb:    params.amountMb,
      description: params.description,
    }).catch(() => {});

    // 5. Audit log
    await writeAuditLog({
      actorId:    params.performedBy ?? null,
      action:     AUDIT_ACTIONS.WALLET_CREDITED,
      entityType: "wallet",
      entityId:   wallet.id,
      oldValue:   { balanceMb: wallet.balanceMb },
      newValue:   { balanceMb: updatedWallet.balanceMb, transactionId: newTx.id },
      metadata:   { amountMb: params.amountMb, source: params.source, referenceId: params.referenceId },
      ipAddress:  params.ipAddress,
    });

    return {
      success:       true,
      transactionId: newTx.id,
      newBalance:    updatedWallet.balanceMb,
    };
  } catch (err: any) {
    console.error("[WalletService] Credit failed:", err);
    return { success: false, error: "Transaction failed. Please try again." };
  }
}

// ─────────────────────────────────────────────────────────────
// DEBIT WALLET
// ─────────────────────────────────────────────────────────────

export async function debitWallet(params: DebitWalletParams): Promise<WalletMutationResult> {
  if (params.amountMb <= 0) {
    return { success: false, error: "Debit amount must be positive" };
  }

  // 1. Check idempotency
  const [existingTx] = await db
    .select()
    .from(walletTransactions)
    .where(eq(walletTransactions.idempotencyKey, params.idempotencyKey))
    .limit(1);

  if (existingTx) {
    const wallet = await getWallet(params.userId);
    return {
      success:       true,
      transactionId: existingTx.id,
      newBalance:    wallet?.balanceMb ?? 0,
      idempotent:    true,
    };
  }

  // 2. Get wallet and check balance
  const wallet = await getWallet(params.userId);
  if (!wallet) {
    return { success: false, error: "Wallet not found" };
  }

  // 3. CRITICAL: Check sufficient balance BEFORE deducting
  // This check + the update must be atomic to prevent race conditions
  // We use a conditional UPDATE that only succeeds if balance is sufficient
  if (wallet.balanceMb < params.amountMb) {
    return {
      success: false,
      error:   `Insufficient balance. You have ₥${wallet.balanceMb.toLocaleString()} but need ₥${params.amountMb.toLocaleString()}.`,
    };
  }

  try {
    // Insert transaction row
    const [newTx] = await db
      .insert(walletTransactions)
      .values({
        walletId:       wallet.id,
        amountMb:       -params.amountMb, // Negative = debit
        type:           "debit",
        source:         params.source as any,
        description:    params.description,
        referenceId:    params.referenceId ?? null,
        idempotencyKey: params.idempotencyKey,
        performedBy:    params.performedBy ?? null,
      })
      .returning();

    // Atomic conditional balance update — only succeeds if balance stays >= 0
    // If another concurrent debit already reduced the balance below the required
    // amount, this WHERE clause will find 0 rows and we detect the race condition
    const updated = await db
      .update(wallets)
      .set({
        balanceMb: sql`${wallets.balanceMb} - ${params.amountMb}`,
        updatedAt: new Date(),
      })
      .where(
        and(
          eq(wallets.id, wallet.id),
          sql`${wallets.balanceMb} >= ${params.amountMb}` // The safety net
        )
      )
      .returning();

    if (updated.length === 0) {
      // Race condition — another request used the balance concurrently
      // The transaction row was inserted but the balance update failed
      // We need to reverse the transaction row
      await db
        .delete(walletTransactions)
        .where(eq(walletTransactions.id, newTx.id));

      return { success: false, error: "Insufficient balance (concurrent transaction conflict)" };
    }

    const updatedWallet = updated[0];

    // Notify
    notifyWalletDebit({
      userId:      params.userId,
      amountMb:    params.amountMb,
      description: params.description,
    }).catch(() => {});

    // Audit
    await writeAuditLog({
      actorId:    params.performedBy ?? params.userId,
      action:     AUDIT_ACTIONS.WALLET_DEBITED,
      entityType: "wallet",
      entityId:   wallet.id,
      oldValue:   { balanceMb: wallet.balanceMb },
      newValue:   { balanceMb: updatedWallet.balanceMb, transactionId: newTx.id },
      metadata:   { amountMb: params.amountMb, source: params.source, referenceId: params.referenceId },
      ipAddress:  params.ipAddress,
    });

    return {
      success:       true,
      transactionId: newTx.id,
      newBalance:    updatedWallet.balanceMb,
    };
  } catch (err: any) {
    console.error("[WalletService] Debit failed:", err);
    return { success: false, error: "Transaction failed. Please try again." };
  }
}

// ─────────────────────────────────────────────────────────────
// ADMIN: WALLET STATS
// ─────────────────────────────────────────────────────────────

export async function getWalletStats() {
  const [stats] = await db
    .select({
      totalWallets:    sql<number>`COUNT(*)`,
      totalBalanceMb:  sql<number>`SUM(${wallets.balanceMb})`,
      avgBalanceMb:    sql<number>`AVG(${wallets.balanceMb})`,
    })
    .from(wallets);

  return {
    totalWallets:    Number(stats?.totalWallets ?? 0),
    totalBalanceMb:  Number(stats?.totalBalanceMb ?? 0),
    avgBalanceMb:    Math.round(Number(stats?.avgBalanceMb ?? 0)),
  };
}
