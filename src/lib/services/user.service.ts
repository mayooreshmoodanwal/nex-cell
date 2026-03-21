/**
 * USER SERVICE
 * Profile management, role assignment (admin-only), soft delete.
 */

import { db }    from "@/lib/db/client";
import { users, userRoles, predefinedRoles, appConfig } from "@/lib/db/schema";
import { eq, and, isNull, desc, count } from "drizzle-orm";
import { writeAuditLog, AUDIT_ACTIONS } from "./audit.service";
import { notifyRoleChanged } from "./notification.service";
import type { Role } from "@/lib/db/schema";

export async function getUserById(id: string) {
  const user = await db.query.users.findFirst({ where: eq(users.id, id) });
  if (!user || user.isDeleted) return null;

  const roles = await db
    .select({ role: userRoles.role })
    .from(userRoles)
    .where(and(eq(userRoles.userId, id), isNull(userRoles.revokedAt)));

  return { ...user, roles: roles.map((r) => r.role) };
}

export async function updateProfile(userId: string, data: { name?: string; avatarUrl?: string }) {
  const [updated] = await db
    .update(users)
    .set({ ...data })
    .where(eq(users.id, userId))
    .returning();
  return updated;
}

export async function softDeleteUser(userId: string, requestedBy: string) {
  await db.update(users).set({
    isDeleted: true, deletedAt: new Date(),
    name: "Deleted User",
  }).where(eq(users.id, userId));

  // Revoke all active refresh tokens
  await writeAuditLog({
    actorId: requestedBy, action: AUDIT_ACTIONS.USER_DELETED,
    entityType: "user", entityId: userId,
  });
}

export async function assignRole(
  targetUserId: string, role: Role, assignedBy: string, ipAddress?: string
) {
  await db.insert(userRoles).values({
    userId: targetUserId, role, assignedBy,
  }).onConflictDoNothing();

  notifyRoleChanged({ userId: targetUserId, newRole: role }).catch(() => {});

  await writeAuditLog({
    actorId: assignedBy, action: AUDIT_ACTIONS.ROLE_ASSIGNED,
    entityType: "user", entityId: targetUserId,
    newValue: { role }, ipAddress,
  });
}

export async function revokeRole(
  targetUserId: string, role: Role, revokedBy: string, ipAddress?: string
) {
  await db.update(userRoles).set({ revokedAt: new Date() })
    .where(and(eq(userRoles.userId, targetUserId), eq(userRoles.role, role), isNull(userRoles.revokedAt)));

  await writeAuditLog({
    actorId: revokedBy, action: AUDIT_ACTIONS.ROLE_REVOKED,
    entityType: "user", entityId: targetUserId,
    oldValue: { role }, ipAddress,
  });
}

export async function getAllUsers(limit = 50, offset = 0) {
  const userList = await db
    .select({
      id: users.id, email: users.email, name: users.name,
      createdAt: users.createdAt, lastLoginAt: users.lastLoginAt, isDeleted: users.isDeleted,
    })
    .from(users)
    .orderBy(desc(users.createdAt))
    .limit(limit).offset(offset);

  // Load roles for each user
  const usersWithRoles = await Promise.all(
    userList.map(async (user) => {
      const roles = await db.select({ role: userRoles.role }).from(userRoles)
        .where(and(eq(userRoles.userId, user.id), isNull(userRoles.revokedAt)));
      return { ...user, roles: roles.map((r) => r.role) };
    })
  );

  return usersWithRoles;
}

export async function getAppConfig(key: string) {
  const [config] = await db.select().from(appConfig).where(eq(appConfig.key, key)).limit(1);
  return config?.value ?? null;
}

export async function setAppConfig(key: string, value: string, updatedBy: string) {
  const [existing] = await db.select().from(appConfig).where(eq(appConfig.key, key)).limit(1);

  await db.update(appConfig).set({ value, updatedBy, updatedAt: new Date() })
    .where(eq(appConfig.key, key));

  await writeAuditLog({
    actorId: updatedBy, action: AUDIT_ACTIONS.CONFIG_UPDATED,
    entityType: "app_config", entityId: null,
    oldValue: { key, value: existing?.value }, newValue: { key, value },
  });
}

export async function getAdminStats() {
  const [userCount] = await db.select({ count: count() }).from(users).where(eq(users.isDeleted, false));
  const { default: { events, eventRegistrations, wallets } } = await import("@/lib/db/schema");
  const [eventCount] = await db.select({ count: count() }).from(events).where(eq(events.isDeleted, false));
  const [regCount] = await db.select({ count: count() }).from(eventRegistrations);

  return {
    totalUsers:         userCount.count,
    totalEvents:        eventCount.count,
    totalRegistrations: regCount.count,
  };
}
