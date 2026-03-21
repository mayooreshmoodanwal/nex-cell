import { NextRequest, NextResponse } from "next/server";
import { parseBody, ok, err, VerifyOtpSchema } from "@/lib/validations";
import { rateLimitOtpVerify, rateLimitResponse } from "@/lib/rate-limit";
import { verifyOtpAndLogin } from "@/lib/services/auth.service";
import { setAuthCookies } from "@/lib/auth";

export async function POST(request: NextRequest) {
  // 1. Rate limit — 10 requests per minute per IP
  const rl = await rateLimitOtpVerify(request);
  if (!rl.success) return rateLimitResponse(rl);

  // 2. Validate body
  const body = await parseBody(request, VerifyOtpSchema);
  if (body instanceof Response) return body;

  // 3. Verify OTP and create session
  const result = await verifyOtpAndLogin(body.email, body.code, request);

  if (!result.success) {
    return err(result.error ?? "Invalid code", 401);
  }

  // 4. Build response with auth cookies
  const response = NextResponse.json(
    {
      success:  true,
      data: {
        message:   result.isNewUser ? "Welcome to NexCell!" : "Welcome back!",
        isNewUser: result.isNewUser,
      },
    },
    { status: 200 }
  );

  setAuthCookies(response, {
    accessToken:  result.accessToken!,
    refreshToken: result.refreshToken!,
    csrfToken:    result.csrfToken!,
  });

  return response;
}
