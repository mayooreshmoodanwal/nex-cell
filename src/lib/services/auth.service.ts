/**
 * AUTH SERVICE
 * Orchestrates the full authentication flow:
 *
 *  1. sendOtp  — generate OTP, store hash, email the code
 *  2. verifyOtp — verify code, create/update user, assign roles, issue tokens
 *  3. refreshSession — rotate access+refresh tokens
 *  4. logout — revoke refresh token
 *
 * On first login:
 *  - Creates the user record
 *  - Checks predefined_roles table — assigns role if email matches
 *  - Creates wallet with 0 balance
 *  - Sends welcome email
 *
 * On subsequent logins:
 *  - Updates last_login_at
 *  - Loads current roles from user_roles table
 *  - Issues fresh tokens
 */

import { db }                from "@/lib/db/client";
import {
  users, userRoles, predefinedRoles, refreshTokens, wallets,
} from "@/lib/db/schema";
import { eq, and, isNull, inArray } from "drizzle-orm";
import { createOtp, verifyOtp, getOtpCooldown } from "@/lib/otp";
import {
  signAccessToken, signRefreshToken, hashToken,
  generateCsrfToken, getDeviceHint,
} from "@/lib/auth";
import {
  sendOtpEmail, sendWelcomeEmail,
} from "@/lib/email";
import {
  writeAuditLog, AUDIT_ACTIONS,
} from "./audit.service";
import { getClientIp } from "@/lib/rate-limit";
import type { NextRequest } from "next/server";

// ─────────────────────────────────────────────────────────────
// SEND OTP
// ─────────────────────────────────────────────────────────────

export interface SendOtpResult {
  success:     boolean;
  cooldown?:   number;   // seconds remaining if in cooldown
  error?:      string;
}

export async function sendOtp(
  email: string,
  request: NextRequest
): Promise<SendOtpResult> {
  const normalizedEmail = email.toLowerCase().trim();
  const ipAddress = getClientIp(request);

  // Check cooldown — prevent rapid re-requests
  const cooldownRemaining = await getOtpCooldown(normalizedEmail);
  if (cooldownRemaining > 0) {
    return { success: false, cooldown: cooldownRemaining };
  }

  // Create OTP (invalidates old ones)
  const { code, expiresAt } = await createOtp(normalizedEmail, ipAddress);

  // Send email
  const emailResult = await sendOtpEmail({
    to:        normalizedEmail,
    otp:       code,
    expiresAt,
    ipAddress,
  });

  if (!emailResult.success) {
    return { success: false, error: "Failed to send email. Please try again." };
  }

  return { success: true };
}

// ─────────────────────────────────────────────────────────────
// VERIFY OTP & LOGIN
// ─────────────────────────────────────────────────────────────

export interface VerifyOtpResult {
  success:      boolean;
  isNewUser?:   boolean;
  accessToken?: string;
  refreshToken?: string;
  csrfToken?:   string;
  error?:       string;
  attemptsLeft?: number;
}

export async function verifyOtpAndLogin(
  email:     string,
  code:      string,
  request:   NextRequest
): Promise<VerifyOtpResult> {
  const normalizedEmail = email.toLowerCase().trim();
  const ipAddress = getClientIp(request);
  const userAgent = request.headers.get("user-agent") ?? undefined;

  // 1. Verify OTP code
  const otpResult = await verifyOtp(normalizedEmail, code);
  if (!otpResult.success) {
    const reasonMessages: Record<string, string> = {
      not_found:    "No active login code found. Please request a new one.",
      expired:      "This code has expired. Please request a new one.",
      used:         "This code has already been used. Please request a new one.",
      max_attempts: "Too many incorrect attempts. Please request a new code.",
      invalid:      "Incorrect code. Please try again.",
    };
    return {
      success: false,
      error:   reasonMessages[otpResult.reason] ?? "Invalid code.",
    };
  }

  // 2. Find or create user
  let user = await db.query.users.findFirst({
    where: eq(users.email, normalizedEmail),
  });

  let isNewUser = false;

  if (!user) {
    // First login — create user record
    const [newUser] = await db
      .insert(users)
      .values({ email: normalizedEmail })
      .returning();
    user = newUser;
    isNewUser = true;

    // Create wallet with zero balance
    await db.insert(wallets).values({ userId: user.id, balanceMb: 0 });

    // Check predefined_roles and assign if matched
    await assignPredefinedRoles(user.id, normalizedEmail);

    // Send welcome email (fire and forget)
    sendWelcomeEmail({ to: normalizedEmail, name: "" }).catch(() => {});

    // Audit
    await writeAuditLog({
      actorId:    user.id,
      action:     AUDIT_ACTIONS.USER_CREATED,
      entityType: "user",
      entityId:   user.id,
      newValue:   { email: normalizedEmail },
      ipAddress,
      userAgent,
    });
  } else {
    // Returning user — update last login
    await db
      .update(users)
      .set({ lastLoginAt: new Date() })
      .where(eq(users.id, user.id));
  }

  // 3. Load active roles
  const activeRoleRecords = await db
    .select({ role: userRoles.role })
    .from(userRoles)
    .where(and(eq(userRoles.userId, user.id), isNull(userRoles.revokedAt)));

  const roles = activeRoleRecords.map((r) => r.role);

  // Ensure everyone has at least participant role
  if (roles.length === 0) {
    await db.insert(userRoles).values({
      userId:     user.id,
      role:       "participant",
      assignedBy: null,
    }).onConflictDoNothing();
    roles.push("participant");
  }

  // 4. Issue tokens
  const accessToken = await signAccessToken({
    sub:   user.id,
    email: normalizedEmail,
    roles,
  });

  const { token: refreshToken, jti } = await signRefreshToken(user.id);
  const csrfToken = generateCsrfToken();

  // 5. Store hashed refresh token in DB
  const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
  await db.insert(refreshTokens).values({
    userId:     user.id,
    tokenHash:  hashToken(refreshToken),
    expiresAt,
    deviceHint: getDeviceHint(userAgent ?? null),
    ipAddress,
  });

  // 6. Audit login
  await writeAuditLog({
    actorId:    user.id,
    action:     AUDIT_ACTIONS.USER_LOGIN,
    entityType: "user",
    entityId:   user.id,
    metadata:   { isNewUser, roles },
    ipAddress,
    userAgent,
  });

  return {
    success:      true,
    isNewUser,
    accessToken,
    refreshToken,
    csrfToken,
  };
}

// ─────────────────────────────────────────────────────────────
// REFRESH SESSION
// ─────────────────────────────────────────────────────────────

export interface RefreshResult {
  success:       boolean;
  accessToken?:  string;
  refreshToken?: string;
  csrfToken?:    string;
  error?:        string;
}

export async function refreshSession(
  rawRefreshToken: string,
  request: NextRequest
): Promise<RefreshResult> {
  const ipAddress = getClientIp(request);
  const userAgent = request.headers.get("user-agent") ?? undefined;

  // Look up the hashed token in DB
  const tokenHash = hashToken(rawRefreshToken);
  const [storedToken] = await db
    .select()
    .from(refreshTokens)
    .where(and(eq(refreshTokens.tokenHash, tokenHash), isNull(refreshTokens.revokedAt)))
    .limit(1);

  if (!storedToken) {
    return { success: false, error: "Invalid or expired session" };
  }

  if (storedToken.expiresAt < new Date()) {
    return { success: false, error: "Session expired. Please log in again." };
  }

  // Revoke the old refresh token (rotation — one-time use)
  await db
    .update(refreshTokens)
    .set({ revokedAt: new Date() })
    .where(eq(refreshTokens.id, storedToken.id));

  // Load current user + roles
  const user = await db.query.users.findFirst({
    where: eq(users.id, storedToken.userId),
  });
  if (!user || user.isDeleted) {
    return { success: false, error: "Account not found" };
  }

  const activeRoles = await db
    .select({ role: userRoles.role })
    .from(userRoles)
    .where(and(eq(userRoles.userId, user.id), isNull(userRoles.revokedAt)));

  const roles = activeRoles.map((r) => r.role);

  // Issue new tokens
  const newAccessToken = await signAccessToken({
    sub:   user.id,
    email: user.email,
    roles,
  });
  const { token: newRefreshToken } = await signRefreshToken(user.id);
  const csrfToken = generateCsrfToken();

  // Store new refresh token
  await db.insert(refreshTokens).values({
    userId:     user.id,
    tokenHash:  hashToken(newRefreshToken),
    expiresAt:  new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
    deviceHint: getDeviceHint(userAgent ?? null),
    ipAddress,
  });

  return {
    success:      true,
    accessToken:  newAccessToken,
    refreshToken: newRefreshToken,
    csrfToken,
  };
}

// ─────────────────────────────────────────────────────────────
// LOGOUT
// ─────────────────────────────────────────────────────────────

export async function logout(
  userId:          string,
  rawRefreshToken: string,
  ipAddress:       string
): Promise<void> {
  // Revoke this specific refresh token
  const tokenHash = hashToken(rawRefreshToken);
  await db
    .update(refreshTokens)
    .set({ revokedAt: new Date() })
    .where(and(eq(refreshTokens.tokenHash, tokenHash), isNull(refreshTokens.revokedAt)));

  await writeAuditLog({
    actorId:    userId,
    action:     AUDIT_ACTIONS.USER_LOGOUT,
    entityType: "user",
    entityId:   userId,
    ipAddress,
  });
}

// ─────────────────────────────────────────────────────────────
// INTERNAL: ASSIGN PREDEFINED ROLES
// ─────────────────────────────────────────────────────────────

/**
 * Checks if the email has a predefined role assignment and creates
 * the user_roles record if so. Called only on first login.
 */
async function assignPredefinedRoles(userId: string, email: string): Promise<void> {
  const predefined = await db
    .select()
    .from(predefinedRoles)
    .where(eq(predefinedRoles.email, email.toLowerCase().trim()));

  for (const entry of predefined) {
    await db
      .insert(userRoles)
      .values({
        userId,
        role:       entry.role,
        assignedBy: null, // System assignment
      })
      .onConflictDoNothing();

    await writeAuditLog({
      actorId:    null,
      action:     AUDIT_ACTIONS.ROLE_ASSIGNED,
      entityType: "user",
      entityId:   userId,
      newValue:   { role: entry.role, reason: "predefined_role_on_first_login" },
    });
  }
}
