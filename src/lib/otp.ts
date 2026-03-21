/**
 * OTP LIBRARY
 *
 * Security properties:
 *  - 6-digit numeric code (1,000,000 possible values)
 *  - Expires in 5 minutes
 *  - Max 3 verification attempts (then code is invalidated)
 *  - 60-second cooldown before another OTP can be requested
 *  - Code is stored as SHA-256 hash — never plain text
 *  - Old unused codes are invalidated when a new one is requested
 *  - Constant-time comparison to prevent timing attacks
 */

import crypto from "crypto";
import { db } from "./db/client";
import { otpCodes } from "./db/schema";
import { eq, and, lt, isNull } from "drizzle-orm";

// ─────────────────────────────────────────────────────────────
// CONSTANTS (also configurable via app_config table)
// ─────────────────────────────────────────────────────────────

const OTP_EXPIRY_MINUTES = 5;
const OTP_MAX_ATTEMPTS   = 3;

// ─────────────────────────────────────────────────────────────
// GENERATE
// ─────────────────────────────────────────────────────────────

/**
 * Generates a cryptographically random 6-digit OTP.
 * Uses crypto.randomInt for uniform distribution (no modulo bias).
 */
export function generateOtp(): string {
  // randomInt(min, max) — max is exclusive, so this gives 000000–999999
  const code = crypto.randomInt(0, 1_000_000);
  return code.toString().padStart(6, "0");
}

/**
 * Hashes an OTP code with SHA-256.
 * We store the hash, verify by hashing the input and comparing.
 */
export function hashOtp(code: string): string {
  return crypto.createHash("sha256").update(code).digest("hex");
}

// ─────────────────────────────────────────────────────────────
// SEND (create DB record)
// ─────────────────────────────────────────────────────────────

export interface CreateOtpResult {
  code:      string; // The plain OTP — only returned here, never stored
  expiresAt: Date;
}

/**
 * Creates a new OTP for the given email.
 * Invalidates any existing unused OTPs for that email first.
 * Returns the plain code (which you then email to the user).
 */
export async function createOtp(email: string, ipAddress?: string): Promise<CreateOtpResult> {
  const normalizedEmail = email.toLowerCase().trim();

  // Invalidate all existing unused OTPs for this email
  // This prevents confusion from multiple valid codes
  await db
    .update(otpCodes)
    .set({ usedAt: new Date() })
    .where(
      and(
        eq(otpCodes.email, normalizedEmail),
        isNull(otpCodes.usedAt)
      )
    );

  // Generate new OTP
  const code      = generateOtp();
  const codeHash  = hashOtp(code);
  const expiresAt = new Date(Date.now() + OTP_EXPIRY_MINUTES * 60 * 1000);

  // Store hashed OTP in DB
  await db.insert(otpCodes).values({
    email:     normalizedEmail,
    codeHash,
    expiresAt,
    ipAddress: ipAddress ?? null,
    attempts:  0,
  });

  return { code, expiresAt };
}

// ─────────────────────────────────────────────────────────────
// VERIFY
// ─────────────────────────────────────────────────────────────

export type OtpVerifyResult =
  | { success: true }
  | { success: false; reason: "not_found" | "expired" | "used" | "max_attempts" | "invalid" };

/**
 * Verifies an OTP code for the given email.
 *
 * Steps:
 *  1. Find the most recent unused OTP for this email
 *  2. Check it hasn't expired
 *  3. Check attempts < max
 *  4. Hash the input and compare with stored hash (constant-time)
 *  5. If valid: mark as used
 *  6. If invalid: increment attempts (invalidate if max reached)
 */
export async function verifyOtp(email: string, code: string): Promise<OtpVerifyResult> {
  const normalizedEmail = email.toLowerCase().trim();
  const now = new Date();

  // Find the most recent active (unused, not expired) OTP for this email
  const [otpRecord] = await db
    .select()
    .from(otpCodes)
    .where(
      and(
        eq(otpCodes.email, normalizedEmail),
        isNull(otpCodes.usedAt)
      )
    )
    .orderBy(otpCodes.createdAt)
    .limit(1);

  if (!otpRecord) {
    return { success: false, reason: "not_found" };
  }

  // Check expiry
  if (otpRecord.expiresAt < now) {
    return { success: false, reason: "expired" };
  }

  // Check max attempts
  if (otpRecord.attempts >= OTP_MAX_ATTEMPTS) {
    return { success: false, reason: "max_attempts" };
  }

  // Hash the provided code and compare
  const inputHash = hashOtp(code.trim());

  // crypto.timingSafeEqual prevents timing attacks
  // (comparing hashes of equal length ensures this is meaningful)
  const storedHashBuffer = Buffer.from(otpRecord.codeHash, "hex");
  const inputHashBuffer  = Buffer.from(inputHash, "hex");

  const isValid =
    storedHashBuffer.length === inputHashBuffer.length &&
    crypto.timingSafeEqual(storedHashBuffer, inputHashBuffer);

  if (!isValid) {
    // Increment attempt counter
    const newAttempts = otpRecord.attempts + 1;

    if (newAttempts >= OTP_MAX_ATTEMPTS) {
      // Max attempts reached — mark as used (effectively invalidated)
      await db
        .update(otpCodes)
        .set({ attempts: newAttempts, usedAt: now })
        .where(eq(otpCodes.id, otpRecord.id));
      return { success: false, reason: "max_attempts" };
    }

    await db
      .update(otpCodes)
      .set({ attempts: newAttempts })
      .where(eq(otpCodes.id, otpRecord.id));

    return { success: false, reason: "invalid" };
  }

  // Valid! Mark as used so it can't be reused
  await db
    .update(otpCodes)
    .set({ usedAt: now })
    .where(eq(otpCodes.id, otpRecord.id));

  return { success: true };
}

// ─────────────────────────────────────────────────────────────
// COOLDOWN CHECK
// ─────────────────────────────────────────────────────────────

/**
 * Checks if the email is in cooldown (requested an OTP too recently).
 * Returns seconds remaining if in cooldown, 0 if free to request.
 */
export async function getOtpCooldown(email: string): Promise<number> {
  const normalizedEmail = email.toLowerCase().trim();
  const cooldownSeconds = 60;
  const cooldownWindow  = new Date(Date.now() - cooldownSeconds * 1000);

  const [recentOtp] = await db
    .select({ createdAt: otpCodes.createdAt })
    .from(otpCodes)
    .where(
      and(
        eq(otpCodes.email, normalizedEmail),
        // Find OTPs created within the cooldown window
        lt(cooldownWindow, otpCodes.createdAt)
      )
    )
    .orderBy(otpCodes.createdAt)
    .limit(1);

  if (!recentOtp) return 0;

  const secondsSinceLastOtp = Math.floor(
    (Date.now() - recentOtp.createdAt.getTime()) / 1000
  );

  const remaining = cooldownSeconds - secondsSinceLastOtp;
  return remaining > 0 ? remaining : 0;
}

// ─────────────────────────────────────────────────────────────
// CLEANUP (run periodically or on a cron job)
// ─────────────────────────────────────────────────────────────

/**
 * Deletes expired OTP codes older than 24 hours.
 * Run this as a scheduled job to keep the table clean.
 */
export async function cleanupExpiredOtps(): Promise<number> {
  const cutoff = new Date(Date.now() - 24 * 60 * 60 * 1000);

  const deleted = await db
    .delete(otpCodes)
    .where(lt(otpCodes.expiresAt, cutoff))
    .returning({ id: otpCodes.id });

  return deleted.length;
}
