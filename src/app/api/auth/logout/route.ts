import { NextRequest, NextResponse } from "next/server";
import { clearAuthCookies, getCurrentUser } from "@/lib/auth";
import { logout } from "@/lib/services/auth.service";
import { getClientIp } from "@/lib/rate-limit";

export async function POST(request: NextRequest) {
  const user            = getCurrentUser(request);
  const rawRefreshToken = request.cookies.get("refresh_token")?.value;
  const ipAddress       = getClientIp(request);

  // Revoke the refresh token if we have it
  if (user && rawRefreshToken) {
    await logout(user.id, rawRefreshToken, ipAddress);
  }

  const response = NextResponse.json(
    { success: true, data: { message: "Logged out successfully" } }
  );
  clearAuthCookies(response);
  return response;
}
