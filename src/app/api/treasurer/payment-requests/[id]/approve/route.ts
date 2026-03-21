import { NextRequest } from "next/server";
import { requireTreasurer } from "@/lib/auth";
import { ok, err } from "@/lib/validations";
import { approvePaymentRequest } from "@/lib/services/treasurer.service";
import { getClientIp } from "@/lib/rate-limit";

export async function POST(request: NextRequest, { params }: { params: { id: string } }) {
  const user = requireTreasurer(request);
  if (user instanceof Response) return user;

  const result = await approvePaymentRequest(params.id, user.id, getClientIp(request));
  if (!result.success) return err(result.error ?? "Approval failed", 400);
  return ok({ message: "Payment approved and wallet credited." });
}
