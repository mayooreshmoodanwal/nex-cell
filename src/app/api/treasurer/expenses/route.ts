import { NextRequest } from "next/server";
import { requireAuth, requireTreasurer, isMember } from "@/lib/auth";
import { ok, err, parseBody, SubmitExpenseSchema } from "@/lib/validations";
import { submitExpense, getExpenses } from "@/lib/services/budget.service";

export async function POST(request: NextRequest) {
  const user = requireAuth(request);
  if (user instanceof Response) return user;
  if (!isMember(user)) return err("Only members and above can submit expenses.", 403);
  const body = await parseBody(request, SubmitExpenseSchema);
  if (body instanceof Response) return body;
  const expense = await submitExpense({ userId: user.id, ...body });
  return ok(expense, 201);
}

export async function GET(request: NextRequest) {
  const user = requireTreasurer(request);
  if (user instanceof Response) return user;
  const expenses = await getExpenses();
  return ok(expenses);
}
