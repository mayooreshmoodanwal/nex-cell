import { NextRequest } from "next/server";
import { requireAdmin } from "@/lib/auth";
import { ok } from "@/lib/validations";
import { db } from "@/lib/db/client";
import { users, events, eventRegistrations, wallets } from "@/lib/db/schema";
import { eq, count, sum, sql } from "drizzle-orm";

export async function GET(request: NextRequest) {
  const user = requireAdmin(request);
  if (user instanceof Response) return user;

  const [userCount] = await db.select({ c: count() }).from(users).where(eq(users.isDeleted, false));
  const [eventCount] = await db.select({ c: count() }).from(events).where(eq(events.isDeleted, false));
  const [regCount] = await db.select({ c: count() }).from(eventRegistrations);
  const [walletStats] = await db.select({
    total: sum(wallets.balanceMb),
    walletCount: count(),
  }).from(wallets);

  return ok({
    totalUsers:         userCount.c,
    totalEvents:        eventCount.c,
    totalRegistrations: regCount.c,
    totalMbInCirculation: Number(walletStats.total ?? 0),
    totalWallets:       walletStats.walletCount,
  });
}
