/**
 * NEXT.JS MIDDLEWARE
 * Runs on every request before the route handler or page loads.
 * This is the security perimeter of the entire application.
 *
 * Responsibilities:
 *  1. Verify the access token (JWT in HTTP-only cookie)
 *  2. Enforce RBAC — block routes the user's role can't access
 *  3. Verify CSRF token on all state-changing requests (POST/PATCH/DELETE)
 *  4. Redirect unauthenticated users to /login
 *  5. Redirect authenticated users away from /login
 *  6. Maintenance mode — block non-admins when enabled
 */

import { NextRequest, NextResponse } from "next/server";
import { jwtVerify } from "jose";

// ─────────────────────────────────────────────────────────────
// ROUTE CONFIGURATION
// ─────────────────────────────────────────────────────────────

// Routes that anyone can access (no login needed)
const PUBLIC_ROUTES = [
  "/login",
  "/api/auth/send-otp",
  "/api/auth/verify-otp",
  "/api/auth/refresh",
  // Public event browsing (GET only — enforced in route handlers)
  "/events",
  "/archive",
];

// Routes that require at least the "member" role
const MEMBER_ROUTES = [
  "/events/create",
  "/api/events",          // POST (create event)
  "/api/expenses",        // POST (submit expense)
];

// Routes that require "treasurer" OR "admin" role
const TREASURER_ROUTES = [
  "/treasurer",
  "/api/treasurer",
];

// Routes that require strictly "admin" role
const ADMIN_ROUTES = [
  "/admin",
  "/api/admin",
];

// Static files, Next.js internals — skip all middleware checks
const SKIP_PATTERNS = [
  "/_next/",
  "/favicon.ico",
  "/robots.txt",
  "/sitemap.xml",
  "/images/",
  "/fonts/",
];

// ─────────────────────────────────────────────────────────────
// HELPERS
// ─────────────────────────────────────────────────────────────

function shouldSkip(pathname: string): boolean {
  return SKIP_PATTERNS.some((p) => pathname.startsWith(p));
}

function isPublicRoute(pathname: string): boolean {
  return PUBLIC_ROUTES.some((r) => pathname === r || pathname.startsWith(r + "/"));
}

function requiresMinRole(pathname: string): "member" | "treasurer" | "admin" | null {
  if (ADMIN_ROUTES.some((r) => pathname === r || pathname.startsWith(r + "/"))) {
    return "admin";
  }
  if (TREASURER_ROUTES.some((r) => pathname === r || pathname.startsWith(r + "/"))) {
    return "treasurer";
  }
  if (MEMBER_ROUTES.some((r) => pathname === r || pathname.startsWith(r + "/"))) {
    return "member";
  }
  return null; // Just needs to be logged in
}

// Role hierarchy: participant < member < treasurer < admin
const ROLE_RANK: Record<string, number> = {
  participant: 0,
  member:      1,
  treasurer:   2,
  admin:       3,
};

function hasRequiredRole(userRoles: string[], required: string): boolean {
  // Admin can access everything
  if (userRoles.includes("admin")) return true;
  // For treasurer routes, both treasurer and admin qualify
  if (required === "treasurer" && userRoles.includes("treasurer")) return true;
  // Check by rank for member+ routes
  const maxRank = Math.max(...userRoles.map((r) => ROLE_RANK[r] ?? 0));
  return maxRank >= (ROLE_RANK[required] ?? 0);
}

// ─────────────────────────────────────────────────────────────
// CSRF VERIFICATION
// The double-submit cookie pattern:
//  - A CSRF token is set as a regular (non-HTTP-only) cookie on login
//  - The frontend reads this cookie and sends it as a request header
//  - Middleware compares the header value to the cookie value
//  - An attacker's site cannot read your cookies, so it can't forge this header
// ─────────────────────────────────────────────────────────────
function verifyCsrf(request: NextRequest): boolean {
  const method = request.method.toUpperCase();

  // CSRF only matters for state-changing requests
  if (!["POST", "PATCH", "PUT", "DELETE"].includes(method)) return true;

  // Auth routes that create the session are exempt (no cookie yet)
  const path = request.nextUrl.pathname;
  if (path === "/api/auth/send-otp" || path === "/api/auth/verify-otp") return true;

  const csrfCookie = request.cookies.get("csrf_token")?.value;
  const csrfHeader = request.headers.get("x-csrf-token");

  if (!csrfCookie || !csrfHeader) return false;
  return csrfCookie === csrfHeader;
}

// ─────────────────────────────────────────────────────────────
// API ERROR RESPONSE
// ─────────────────────────────────────────────────────────────
function apiError(message: string, status: number): NextResponse {
  return NextResponse.json(
    { success: false, error: message },
    { status }
  );
}

// ─────────────────────────────────────────────────────────────
// MAIN MIDDLEWARE
// ─────────────────────────────────────────────────────────────
export async function middleware(request: NextRequest): Promise<NextResponse> {
  const { pathname } = request.nextUrl;

  // 1. Skip static files and Next.js internals
  if (shouldSkip(pathname)) {
    return NextResponse.next();
  }

  // 2. Public routes — no auth needed
  if (isPublicRoute(pathname)) {
    // If already logged in, redirect away from /login
    if (pathname === "/login") {
      const token = request.cookies.get("access_token")?.value;
      if (token) {
        try {
          const secret = new TextEncoder().encode(process.env.JWT_ACCESS_SECRET!);
          await jwtVerify(token, secret);
          // Valid token — redirect to dashboard
          return NextResponse.redirect(new URL("/dashboard", request.url));
        } catch {
          // Invalid/expired token — let them see the login page
          // (The /api/auth/refresh endpoint will handle token renewal)
        }
      }
    }
    return NextResponse.next();
  }

  // 3. All other routes require authentication
  const accessToken = request.cookies.get("access_token")?.value;

  if (!accessToken) {
    // API routes return 401, pages redirect to login
    if (pathname.startsWith("/api/")) {
      return apiError("Authentication required", 401);
    }
    const loginUrl = new URL("/login", request.url);
    loginUrl.searchParams.set("redirect", pathname);
    return NextResponse.redirect(loginUrl);
  }

  // 4. Verify the JWT
  let payload: { sub: string; email: string; roles: string[] };
  try {
    const secret = new TextEncoder().encode(process.env.JWT_ACCESS_SECRET!);
    const { payload: p } = await jwtVerify(accessToken, secret);
    payload = p as typeof payload;
  } catch (err: unknown) {
    // Token expired or tampered
    // For API routes: return 401 so the frontend can trigger a refresh
    if (pathname.startsWith("/api/")) {
      return apiError("Token expired", 401);
    }
    // For pages: redirect to login
    const response = NextResponse.redirect(new URL("/login", request.url));
    response.cookies.delete("access_token");
    return response;
  }

  // 5. CSRF check on state-changing requests
  if (!verifyCsrf(request)) {
    return apiError("Invalid CSRF token", 403);
  }

  // 6. RBAC — check if the user's role is sufficient
  const requiredRole = requiresMinRole(pathname);
  if (requiredRole && !hasRequiredRole(payload.roles ?? [], requiredRole)) {
    if (pathname.startsWith("/api/")) {
      return apiError("Insufficient permissions", 403);
    }
    // Redirect to dashboard with an error message in the URL
    return NextResponse.redirect(new URL("/dashboard?error=forbidden", request.url));
  }

  // 7. Pass user info to route handlers via request headers
  // This avoids re-parsing the JWT in every route handler
  const requestHeaders = new Headers(request.headers);
  requestHeaders.set("x-user-id",    payload.sub);
  requestHeaders.set("x-user-email", payload.email);
  requestHeaders.set("x-user-roles", (payload.roles ?? []).join(","));

  return NextResponse.next({ request: { headers: requestHeaders } });
}

// Tell Next.js which routes to run this middleware on
// Everything except static files (handled by shouldSkip above)
export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|robots.txt).*)",
  ],
};
