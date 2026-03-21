import { NextRequest, NextResponse } from "next/server";
import { ok, err } from "@/lib/validations";
import { setAuthCookies, clearAuthCookies } from "@/lib/auth";
import { refreshSession } from "@/lib/services/auth.service";

export async function POST(request: NextRequest) {
  const rawRefreshToken = request.cookies.get("refresh_token")?.value;

  if (!rawRefreshToken) {
    return err("No refresh token found. Please log in again.", 401);
  }

  const result = await refreshSession(rawRefreshToken, request);

  if (!result.success) {
    // Clear invalid cookies and force re-login
    const response = NextResponse.json(
      { success: false, error: result.error },
      { status: 401 }
    );
    clearAuthCookies(response);
    return response;
  }

  const response = NextResponse.json({ success: true, data: { refreshed: true } });
  setAuthCookies(response, {
    accessToken:  result.accessToken!,
    refreshToken: result.refreshToken!,
    csrfToken:    result.csrfToken!,
  });

  return response;
}
