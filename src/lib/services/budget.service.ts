/**
 * BUDGET & EXPENSE SERVICE
 * Manages club budgets and member expense reimbursement requests.
 */

import { db }          from "@/lib/db/client";
import { budgets, expenses, users, appConfig } from "@/lib/db/schema";
import { eq, desc, sql } from "drizzle-orm";
import { writeAuditLog, AUDIT_ACTIONS } from "./audit.service";
import {
  notifyExpenseApproved, notifyExpenseRepaid,
} from "./notification.service";

// ── Budgets ──────────────────────────────────────────────────

export async function createBudget(data: {
  title: string; description?: string; totalAmountInr: number;
}, createdBy: string) {
  const [budget] = await db.insert(budgets).values({
    title:          data.title,
    description:    data.description,
    totalAmountInr: data.totalAmountInr.toString(),
    createdBy,
  }).returning();

  await writeAuditLog({
    actorId: createdBy, action: AUDIT_ACTIONS.BUDGET_CREATED,
    entityType: "budget", entityId: budget.id,
    newValue: { title: data.title, totalAmountInr: data.totalAmountInr },
  });

  return budget;
}

export async function getBudgets() {
  return db.select().from(budgets).orderBy(desc(budgets.createdAt));
}

// ── Expenses ──────────────────────────────────────────────────

export async function submitExpense(data: {
  userId: string; budgetId?: string; amountInr: number;
  description: string; proofUrl?: string;
}) {
  const [expense] = await db.insert(expenses).values({
    userId:      data.userId,
    budgetId:    data.budgetId ?? null,
    amountInr:   data.amountInr.toString(),
    description: data.description,
    proofUrl:    data.proofUrl ?? null,
    status:      "pending",
  }).returning();

  await writeAuditLog({
    actorId: data.userId, action: AUDIT_ACTIONS.EXPENSE_SUBMITTED,
    entityType: "expense", entityId: expense.id,
    newValue: { amountInr: data.amountInr, description: data.description },
  });

  return expense;
}

export async function approveExpense(
  expenseId: string, approverId: string, ipAddress?: string
) {
  const [expense] = await db.select().from(expenses).where(eq(expenses.id, expenseId)).limit(1);
  if (!expense || expense.status !== "pending") {
    return { success: false, error: "Expense not found or not pending" };
  }

  await db.update(expenses).set({
    status: "approved", approvedBy: approverId, approvedAt: new Date(), updatedAt: new Date(),
  }).where(eq(expenses.id, expenseId));

  notifyExpenseApproved({ userId: expense.userId, amountInr: Number(expense.amountInr) }).catch(() => {});

  await writeAuditLog({
    actorId: approverId, action: AUDIT_ACTIONS.EXPENSE_APPROVED,
    entityType: "expense", entityId: expenseId,
    oldValue: { status: "pending" }, newValue: { status: "approved" }, ipAddress,
  });

  return { success: true };
}

export async function rejectExpense(
  expenseId: string, approverId: string, reason: string, ipAddress?: string
) {
  await db.update(expenses).set({
    status: "rejected", approvedBy: approverId,
    rejectionReason: reason, updatedAt: new Date(),
  }).where(eq(expenses.id, expenseId));

  await writeAuditLog({
    actorId: approverId, action: AUDIT_ACTIONS.EXPENSE_REJECTED,
    entityType: "expense", entityId: expenseId,
    newValue: { status: "rejected", reason }, ipAddress,
  });

  return { success: true };
}

export async function markExpenseRepaid(
  expenseId: string, repaidBy: string, ipAddress?: string
) {
  const [expense] = await db.select().from(expenses).where(eq(expenses.id, expenseId)).limit(1);
  if (!expense || expense.status !== "approved") {
    return { success: false, error: "Expense not found or not in approved state" };
  }

  await db.update(expenses).set({
    status: "repaid", repaidBy, repaidAt: new Date(), updatedAt: new Date(),
  }).where(eq(expenses.id, expenseId));

  // Update budget used amount if linked to a budget
  if (expense.budgetId) {
    await db.update(budgets).set({
      usedAmountInr: sql`${budgets.usedAmountInr} + ${expense.amountInr}`,
      updatedAt: new Date(),
    }).where(eq(budgets.id, expense.budgetId));
  }

  notifyExpenseRepaid({ userId: expense.userId, amountInr: Number(expense.amountInr) }).catch(() => {});

  await writeAuditLog({
    actorId: repaidBy, action: AUDIT_ACTIONS.EXPENSE_REPAID,
    entityType: "expense", entityId: expenseId,
    newValue: { status: "repaid" }, ipAddress,
  });

  return { success: true };
}

export async function getExpenses(filters: { userId?: string; status?: string } = {}) {
  const rows = await db
    .select({
      id: expenses.id, userId: expenses.userId, userName: users.name,
      userEmail: users.email, amountInr: expenses.amountInr,
      description: expenses.description, proofUrl: expenses.proofUrl,
      status: expenses.status, createdAt: expenses.createdAt,
      budgetId: expenses.budgetId, repaidAt: expenses.repaidAt,
    })
    .from(expenses)
    .leftJoin(users, eq(expenses.userId, users.id))
    .orderBy(desc(expenses.createdAt));

  return rows;
}
