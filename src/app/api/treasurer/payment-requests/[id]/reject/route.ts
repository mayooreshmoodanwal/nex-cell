import { NextRequest } from "next/server";
import { requireTreasurer } from "@/lib/auth";
import { ok, err, parseBody, RejectPaymentSchema } from "@/lib/validations";
import { rejectPaymentRequest } from "@/lib/services/treasurer.service";
import { getClientIp } from "@/lib/rate-limit";

export async function POST(request: NextRequest, { params }: { params: { id: string } }) {
  const user = requireTreasurer(request);
  if (user instanceof Response) return user;

  const body = await parseBody(request, RejectPaymentSchema);
  if (body instanceof Response) return body;

  const result = await rejectPaymentRequest(params.id, user.id, body.reason, getClientIp(request));
  if (!result.success) return err(result.error ?? "Rejection failed", 400);
  return ok({ message: "Payment request rejected." });
}
