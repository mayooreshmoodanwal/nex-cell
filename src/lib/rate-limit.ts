/**
 * RATE LIMITING — Upstash Redis
 *
 * Why Upstash? Because Vercel runs serverless functions — each request
 * can be a fresh process. In-memory rate limiting would reset on every
 * cold start. Upstash Redis persists the counters across all instances.
 *
 * Rules (applied per IP address unless noted):
 *
 *  OTP send:       5  requests / 60  seconds  (prevent OTP spam)
 *  OTP verify:     10 requests / 60  seconds  (prevent brute force)
 *  Auth general:   20 requests / 60  seconds
 *  API global:     100 requests / 60 seconds  (per IP)
 *  Upload:         10 requests / 60  seconds  (per user)
 *  Wallet ops:     20 requests / 60  seconds  (per user)
 */

import { Redis } from "@upstash/redis";
import { Ratelimit } from "@upstash/ratelimit";
import { NextRequest } from "next/server";

// ─────────────────────────────────────────────────────────────
// REDIS CLIENT
// ─────────────────────────────────────────────────────────────

let redis: Redis | null = null;

function getRedis(): Redis {
  if (!redis) {
    if (!process.env.UPSTASH_REDIS_REST_URL || !process.env.UPSTASH_REDIS_REST_TOKEN) {
      throw new Error(
        "Upstash Redis credentials not set. Add UPSTASH_REDIS_REST_URL and UPSTASH_REDIS_REST_TOKEN to .env.local"
      );
    }
    redis = new Redis({
      url:   process.env.UPSTASH_REDIS_REST_URL,
      token: process.env.UPSTASH_REDIS_REST_TOKEN,
    });
  }
  return redis;
}

// ─────────────────────────────────────────────────────────────
// RATE LIMITERS
// Sliding window algorithm: more accurate than fixed window.
// ─────────────────────────────────────────────────────────────

// Lazy-initialized limiters (so tests don't need Redis)
const limiters: Record<string, Ratelimit> = {};

function getLimiter(key: string, requests: number, window: string): Ratelimit {
  const id = `${key}:${requests}:${window}`;
  if (!limiters[id]) {
    limiters[id] = new Ratelimit({
      redis:   getRedis(),
      limiter: Ratelimit.slidingWindow(requests, window as `${number} ${"ms" | "s" | "m" | "h" | "d"}`),
      prefix:  `nexcell:rl:${key}`,
      analytics: false, // Don't track for privacy
    });
  }
  return limiters[id];
}

// ─────────────────────────────────────────────────────────────
// IP EXTRACTION
// ─────────────────────────────────────────────────────────────

export function getClientIp(request: NextRequest): string {
  // Vercel sets this header for the real client IP
  const forwardedFor = request.headers.get("x-forwarded-for");
  if (forwardedFor) {
    return forwardedFor.split(",")[0].trim();
  }
  return request.headers.get("x-real-ip") ?? "127.0.0.1";
}

// ─────────────────────────────────────────────────────────────
// RATE LIMIT RESULT
// ─────────────────────────────────────────────────────────────

export interface RateLimitResult {
  success:   boolean;
  limit:     number;
  remaining: number;
  reset:     number; // Unix timestamp when the window resets
}

// ─────────────────────────────────────────────────────────────
// RATE LIMIT FUNCTIONS
// Call these at the start of each API route handler.
// ─────────────────────────────────────────────────────────────

/**
 * OTP send — very strict: 5 per minute per IP.
 * Prevents attackers from spamming Resend emails.
 */
export async function rateLimitOtpSend(request: NextRequest): Promise<RateLimitResult> {
  const ip = getClientIp(request);
  const limiter = getLimiter("otp-send", 5, "60 s");
  const result = await limiter.limit(ip);
  return {
    success:   result.success,
    limit:     result.limit,
    remaining: result.remaining,
    reset:     result.reset,
  };
}

/**
 * OTP verify — moderate: 10 per minute per IP.
 * Prevents brute-forcing OTP codes.
 */
export async function rateLimitOtpVerify(request: NextRequest): Promise<RateLimitResult> {
  const ip = getClientIp(request);
  const limiter = getLimiter("otp-verify", 10, "60 s");
  const result = await limiter.limit(ip);
  return {
    success:   result.success,
    limit:     result.limit,
    remaining: result.remaining,
    reset:     result.reset,
  };
}

/**
 * General auth operations: 20 per minute per IP.
 */
export async function rateLimitAuth(request: NextRequest): Promise<RateLimitResult> {
  const ip = getClientIp(request);
  const limiter = getLimiter("auth", 20, "60 s");
  const result = await limiter.limit(ip);
  return {
    success:   result.success,
    limit:     result.limit,
    remaining: result.remaining,
    reset:     result.reset,
  };
}

/**
 * API global: 100 requests per minute per IP.
 * Applied to all API routes as a baseline.
 */
export async function rateLimitApi(request: NextRequest): Promise<RateLimitResult> {
  const ip = getClientIp(request);
  const limiter = getLimiter("api", 100, "60 s");
  const result = await limiter.limit(ip);
  return {
    success:   result.success,
    limit:     result.limit,
    remaining: result.remaining,
    reset:     result.reset,
  };
}

/**
 * File upload: 10 per minute per user ID.
 * Prevents storage abuse.
 */
export async function rateLimitUpload(userId: string): Promise<RateLimitResult> {
  const limiter = getLimiter("upload", 10, "60 s");
  const result = await limiter.limit(`user:${userId}`);
  return {
    success:   result.success,
    limit:     result.limit,
    remaining: result.remaining,
    reset:     result.reset,
  };
}

/**
 * Wallet operations: 20 per minute per user ID.
 * Prevents automated wallet abuse.
 */
export async function rateLimitWallet(userId: string): Promise<RateLimitResult> {
  const limiter = getLimiter("wallet", 20, "60 s");
  const result = await limiter.limit(`user:${userId}`);
  return {
    success:   result.success,
    limit:     result.limit,
    remaining: result.remaining,
    reset:     result.reset,
  };
}

// ─────────────────────────────────────────────────────────────
// RESPONSE HELPER
// Returns a standard 429 response with Retry-After header.
// ─────────────────────────────────────────────────────────────

export function rateLimitResponse(result: RateLimitResult): Response {
  const retryAfter = Math.ceil((result.reset - Date.now()) / 1000);
  return new Response(
    JSON.stringify({
      success: false,
      error:   "Too many requests. Please wait before trying again.",
      retryAfter,
    }),
    {
      status: 429,
      headers: {
        "Content-Type":  "application/json",
        "Retry-After":   retryAfter.toString(),
        "X-RateLimit-Limit":     result.limit.toString(),
        "X-RateLimit-Remaining": result.remaining.toString(),
        "X-RateLimit-Reset":     result.reset.toString(),
      },
    }
  );
}
