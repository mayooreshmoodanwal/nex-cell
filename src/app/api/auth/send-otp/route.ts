import { NextRequest } from "next/server";
import { parseBody, ok, err, SendOtpSchema } from "@/lib/validations";
import { rateLimitOtpSend, rateLimitResponse } from "@/lib/rate-limit";
import { sendOtp } from "@/lib/services/auth.service";

export async function POST(request: NextRequest) {
  // 1. Rate limit — 5 requests per minute per IP
  const rl = await rateLimitOtpSend(request);
  if (!rl.success) return rateLimitResponse(rl);

  // 2. Validate body
  const body = await parseBody(request, SendOtpSchema);
  if (body instanceof Response) return body;

  // 3. Send OTP
  const result = await sendOtp(body.email, request);

  if (!result.success) {
    if (result.cooldown) {
      return err(
        `Please wait ${result.cooldown} seconds before requesting another code.`,
        429
      );
    }
    return err(result.error ?? "Failed to send code", 500);
  }

  // Never confirm whether an email exists in our system — always say success
  return ok({
    message: "If an account exists for this email, a login code has been sent.",
  });
}
