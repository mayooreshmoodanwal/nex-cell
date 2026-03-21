/**
 * AUTH LIBRARY
 * Central place for all authentication logic.
 *
 * Exports:
 *  - signAccessToken / signRefreshToken
 *  - verifyAccessToken / verifyRefreshToken
 *  - setAuthCookies / clearAuthCookies
 *  - generateCsrfToken
 *  - getCurrentUser (reads user from request headers set by middleware)
 *  - requireAuth / requireRole (route handler guards)
 */

import { SignJWT, jwtVerify } from "jose";
import { cookies } from "next/headers";
import { NextRequest, NextResponse } from "next/server";
import { nanoid } from "nanoid";
import crypto from "crypto";

// ─────────────────────────────────────────────────────────────
// TYPES
// ─────────────────────────────────────────────────────────────

export interface AccessTokenPayload {
  sub:   string;   // user ID
  email: string;
  roles: string[];
  type:  "access";
}

export interface RefreshTokenPayload {
  sub:  string;   // user ID
  jti:  string;   // unique token ID (for revocation)
  type: "refresh";
}

export interface CurrentUser {
  id:    string;
  email: string;
  roles: string[];
}

export type Role = "participant" | "member" | "treasurer" | "admin";

// ─────────────────────────────────────────────────────────────
// SECRETS
// ─────────────────────────────────────────────────────────────

function getSecret(name: string): Uint8Array {
  const val = process.env[name];
  if (!val) throw new Error(`Environment variable ${name} is not set`);
  return new TextEncoder().encode(val);
}

// ─────────────────────────────────────────────────────────────
// TOKEN CREATION
// ─────────────────────────────────────────────────────────────

/**
 * Creates a short-lived access token (15 minutes).
 * Contains user ID, email, and roles — everything needed for RBAC.
 * Stored in an HTTP-only cookie, never in localStorage.
 */
export async function signAccessToken(payload: Omit<AccessTokenPayload, "type">): Promise<string> {
  const secret = getSecret("JWT_ACCESS_SECRET");
  const expiry = process.env.JWT_ACCESS_EXPIRY ?? "15m";

  return new SignJWT({ ...payload, type: "access" })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(expiry)
    .setIssuer("nexcell")
    .setAudience("nexcell-client")
    .sign(secret);
}

/**
 * Creates a long-lived refresh token (7 days).
 * Only contains user ID and a unique JTI (JWT ID).
 * The JTI is stored (hashed) in the DB — this allows revocation.
 * Stored in an HTTP-only cookie.
 */
export async function signRefreshToken(userId: string): Promise<{ token: string; jti: string }> {
  const secret = getSecret("JWT_REFRESH_SECRET");
  const expiry = process.env.JWT_REFRESH_EXPIRY ?? "7d";
  const jti = nanoid(32); // Unique ID for this specific token

  const token = await new SignJWT({ sub: userId, jti, type: "refresh" })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(expiry)
    .setIssuer("nexcell")
    .sign(secret);

  return { token, jti };
}

// ─────────────────────────────────────────────────────────────
// TOKEN VERIFICATION
// ─────────────────────────────────────────────────────────────

export async function verifyAccessToken(token: string): Promise<AccessTokenPayload> {
  const secret = getSecret("JWT_ACCESS_SECRET");
  const { payload } = await jwtVerify(token, secret, {
    issuer:   "nexcell",
    audience: "nexcell-client",
  });
  return payload as unknown as AccessTokenPayload;
}

export async function verifyRefreshToken(token: string): Promise<RefreshTokenPayload> {
  const secret = getSecret("JWT_REFRESH_SECRET");
  const { payload } = await jwtVerify(token, secret, {
    issuer: "nexcell",
  });
  return payload as unknown as RefreshTokenPayload;
}

// ─────────────────────────────────────────────────────────────
// COOKIE MANAGEMENT
// All cookies are:
//   HttpOnly — JavaScript cannot read them (XSS protection)
//   Secure   — Only sent over HTTPS (in production)
//   SameSite=Lax — Sent on same-site navigations, blocked on cross-site
//                  requests (CSRF protection layer 1)
// ─────────────────────────────────────────────────────────────

const IS_PROD = process.env.NODE_ENV === "production";

export interface AuthTokens {
  accessToken:  string;
  refreshToken: string;
  csrfToken:    string;
}

/**
 * Sets all three auth cookies:
 *  - access_token  (HTTP-only, 15 min)
 *  - refresh_token (HTTP-only, 7 days)
 *  - csrf_token    (readable by JS, 7 days) — needed for CSRF double-submit
 */
export function setAuthCookies(response: NextResponse, tokens: AuthTokens): void {
  const cookieOptions = {
    httpOnly: true,
    secure:   IS_PROD,
    sameSite: "lax" as const,
    path:     "/",
  };

  // Access token — short lived
  response.cookies.set("access_token", tokens.accessToken, {
    ...cookieOptions,
    maxAge: 15 * 60, // 15 minutes in seconds
  });

  // Refresh token — long lived
  response.cookies.set("refresh_token", tokens.refreshToken, {
    ...cookieOptions,
    maxAge: 7 * 24 * 60 * 60, // 7 days in seconds
    // Extra restriction: only the /api/auth/refresh endpoint can read this
    path: "/api/auth",
  });

  // CSRF token — NOT httpOnly (JS needs to read it to send as a header)
  response.cookies.set("csrf_token", tokens.csrfToken, {
    httpOnly: false, // Must be readable by JavaScript
    secure:   IS_PROD,
    sameSite: "lax" as const,
    path:     "/",
    maxAge:   7 * 24 * 60 * 60,
  });
}

/**
 * Clears all auth cookies — called on logout.
 */
export function clearAuthCookies(response: NextResponse): void {
  const deletionOptions = {
    httpOnly: true,
    secure:   IS_PROD,
    sameSite: "lax" as const,
    path:     "/",
    maxAge:   0,
  };

  response.cookies.set("access_token",  "", deletionOptions);
  response.cookies.set("csrf_token",     "", { ...deletionOptions, httpOnly: false });
  response.cookies.set("refresh_token", "", { ...deletionOptions, path: "/api/auth" });
}

// ─────────────────────────────────────────────────────────────
// CSRF TOKEN
// ─────────────────────────────────────────────────────────────

/**
 * Generates a cryptographically random CSRF token.
 * This is set as a readable cookie on login.
 * The frontend reads it and sends it as the x-csrf-token header.
 */
export function generateCsrfToken(): string {
  return crypto.randomBytes(32).toString("hex");
}

// ─────────────────────────────────────────────────────────────
// TOKEN HASHING
// Refresh tokens and OTP codes are stored HASHED in the DB.
// We never store the raw value — only the hash.
// ─────────────────────────────────────────────────────────────

export function hashToken(token: string): string {
  return crypto.createHash("sha256").update(token).digest("hex");
}

// ─────────────────────────────────────────────────────────────
// CURRENT USER — for use in API route handlers
// Middleware sets these headers from the verified JWT.
// Route handlers read them instead of re-parsing the JWT.
// ─────────────────────────────────────────────────────────────

/**
 * Reads the current user from the request headers set by middleware.
 * Returns null if not authenticated (should not happen if route is protected).
 */
export function getCurrentUser(request: NextRequest): CurrentUser | null {
  const id    = request.headers.get("x-user-id");
  const email = request.headers.get("x-user-email");
  const rolesStr = request.headers.get("x-user-roles");

  if (!id || !email) return null;

  return {
    id,
    email,
    roles: rolesStr ? rolesStr.split(",").filter(Boolean) : [],
  };
}

// ─────────────────────────────────────────────────────────────
// ROLE HELPERS
// ─────────────────────────────────────────────────────────────

export function hasRole(user: CurrentUser, role: Role): boolean {
  return user.roles.includes(role);
}

export function hasAnyRole(user: CurrentUser, ...roles: Role[]): boolean {
  return roles.some((r) => user.roles.includes(r));
}

export function isAdmin(user: CurrentUser): boolean {
  return user.roles.includes("admin");
}

export function isTreasurer(user: CurrentUser): boolean {
  return user.roles.includes("treasurer") || user.roles.includes("admin");
}

export function isMember(user: CurrentUser): boolean {
  const MEMBER_AND_ABOVE: Role[] = ["member", "treasurer", "admin"];
  return MEMBER_AND_ABOVE.some((r) => user.roles.includes(r));
}

// ─────────────────────────────────────────────────────────────
// ROUTE GUARDS — use these at the top of every API route handler
// ─────────────────────────────────────────────────────────────

/**
 * Standard API response shape — used everywhere for consistency.
 */
export function apiResponse<T>(data: T, status = 200): NextResponse {
  return NextResponse.json({ success: true, data }, { status });
}

export function apiError(message: string, status: number, details?: unknown): NextResponse {
  // NEVER expose stack traces or internal error details in production
  const body: Record<string, unknown> = { success: false, error: message };
  if (process.env.NODE_ENV === "development" && details) {
    body.details = details;
  }
  return NextResponse.json(body, { status });
}

/**
 * requireAuth — returns the current user or throws an API 401 response.
 * Use at the top of every protected route handler.
 *
 * Usage:
 *   const user = requireAuth(request);
 *   if (user instanceof NextResponse) return user;
 */
export function requireAuth(request: NextRequest): CurrentUser | NextResponse {
  const user = getCurrentUser(request);
  if (!user) return apiError("Authentication required", 401);
  return user;
}

/**
 * requireRole — checks the user has a specific role.
 *
 * Usage:
 *   const user = requireRole(request, "admin");
 *   if (user instanceof NextResponse) return user;
 */
export function requireRole(request: NextRequest, role: Role): CurrentUser | NextResponse {
  const user = getCurrentUser(request);
  if (!user) return apiError("Authentication required", 401);
  if (!hasAnyRole(user, role, "admin")) {
    return apiError("Insufficient permissions", 403);
  }
  return user;
}

/**
 * requireTreasurer — checks the user is a treasurer or admin.
 */
export function requireTreasurer(request: NextRequest): CurrentUser | NextResponse {
  const user = getCurrentUser(request);
  if (!user) return apiError("Authentication required", 401);
  if (!isTreasurer(user)) return apiError("Treasurer or Admin role required", 403);
  return user;
}

/**
 * requireAdmin — checks the user is an admin.
 */
export function requireAdmin(request: NextRequest): CurrentUser | NextResponse {
  const user = getCurrentUser(request);
  if (!user) return apiError("Authentication required", 401);
  if (!isAdmin(user)) return apiError("Admin role required", 403);
  return user;
}

// ─────────────────────────────────────────────────────────────
// DEVICE HINT — for refresh token display
// ─────────────────────────────────────────────────────────────

/**
 * Extracts a human-readable device hint from the User-Agent header.
 * Stored with refresh tokens so admins can see active sessions.
 */
export function getDeviceHint(userAgent: string | null): string {
  if (!userAgent) return "Unknown device";

  if (userAgent.includes("Chrome"))  return "Chrome";
  if (userAgent.includes("Firefox")) return "Firefox";
  if (userAgent.includes("Safari"))  return "Safari";
  if (userAgent.includes("Edge"))    return "Edge";
  if (userAgent.includes("Mobile"))  return "Mobile browser";

  return "Unknown browser";
}
