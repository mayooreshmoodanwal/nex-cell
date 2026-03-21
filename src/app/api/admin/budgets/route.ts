import { NextRequest } from "next/server";
import { requireAdmin } from "@/lib/auth";
import { ok, parseBody, CreateBudgetSchema } from "@/lib/validations";
import { createBudget, getBudgets } from "@/lib/services/budget.service";

export async function GET(request: NextRequest) {
  const user = requireAdmin(request);
  if (user instanceof Response) return user;
  const budgets = await getBudgets();
  return ok(budgets);
}

export async function POST(request: NextRequest) {
  const user = requireAdmin(request);
  if (user instanceof Response) return user;
  const body = await parseBody(request, CreateBudgetSchema);
  if (body instanceof Response) return body;
  const budget = await createBudget({ title: body.title, description: body.description, totalAmountInr: body.totalAmountInr }, user.id);
  return ok(budget, 201);
}
