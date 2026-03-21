import { NextRequest } from "next/server";
import { requireTreasurer } from "@/lib/auth";
import { ok, err, parseBody, RejectExpenseSchema } from "@/lib/validations";
import { rejectExpense } from "@/lib/services/budget.service";
import { getClientIp } from "@/lib/rate-limit";

export async function POST(request: NextRequest, { params }: { params: { id: string } }) {
  const user = requireTreasurer(request);
  if (user instanceof Response) return user;
  const body = await parseBody(request, RejectExpenseSchema);
  if (body instanceof Response) return body;
  const result = await rejectExpense(params.id, user.id, body.reason, getClientIp(request));
  if (!result.success) return err(result.error ?? "Failed", 400);
  return ok({ message: "Expense rejected." });
}
