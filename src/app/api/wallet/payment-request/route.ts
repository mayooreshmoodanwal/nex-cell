import { NextRequest } from "next/server";
import { requireAuth } from "@/lib/auth";
import { ok, err, parseBody, SubmitPaymentRequestSchema } from "@/lib/validations";
import { submitPaymentRequest, getUserPaymentRequests } from "@/lib/services/treasurer.service";

export async function POST(request: NextRequest) {
  const user = requireAuth(request);
  if (user instanceof Response) return user;
  const body = await parseBody(request, SubmitPaymentRequestSchema);
  if (body instanceof Response) return body;
  const result = await submitPaymentRequest({ userId: user.id, amountInr: body.amountInr, upiTransactionId: body.upiTransactionId, proofUrl: body.proofUrl });
  if (!result.success) return err(result.error ?? "Submission failed", 400);
  return ok({ message: "Payment request submitted. A treasurer will verify it shortly.", requestId: result.requestId }, 201);
}

export async function GET(request: NextRequest) {
  const user = requireAuth(request);
  if (user instanceof Response) return user;
  const requests = await getUserPaymentRequests(user.id);
  return ok(requests);
}
