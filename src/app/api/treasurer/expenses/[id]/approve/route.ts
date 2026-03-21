import { NextRequest } from "next/server";
import { requireTreasurer } from "@/lib/auth";
import { ok, err } from "@/lib/validations";
import { approveExpense } from "@/lib/services/budget.service";
import { getClientIp } from "@/lib/rate-limit";

export async function POST(request: NextRequest, { params }: { params: { id: string } }) {
  const user = requireTreasurer(request);
  if (user instanceof Response) return user;
  const result = await approveExpense(params.id, user.id, getClientIp(request));
  if (!result.success) return err(result.error ?? "Failed", 400);
  return ok({ message: "Expense approved." });
}
