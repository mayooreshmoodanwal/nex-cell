import { cookies } from "next/headers";
import { verifyAccessToken, isAdmin } from "@/lib/auth";
import { redirect } from "next/navigation";
import { db } from "@/lib/db/client";
import { users, events, eventRegistrations, wallets } from "@/lib/db/schema";
import { eq, count, sum } from "drizzle-orm";
import AdminDashboardClient from "./AdminDashboardClient";
export const metadata = { title: "Admin Dashboard" };

export default async function AdminPage() {
  const token = cookies().get("access_token")?.value!;
  const payload = await verifyAccessToken(token);
  if (!payload.roles?.includes("admin")) redirect("/dashboard?error=forbidden");

  const [[uc], [ec], [rc], [ws]] = await Promise.all([
    db.select({ c: count() }).from(users).where(eq(users.isDeleted, false)),
    db.select({ c: count() }).from(events).where(eq(events.isDeleted, false)),
    db.select({ c: count() }).from(eventRegistrations),
    db.select({ total: sum(wallets.balanceMb), cnt: count() }).from(wallets),
  ]);

  return <AdminDashboardClient stats={{ users: uc.c, events: ec.c, registrations: rc.c, totalMb: Number(ws.total ?? 0), wallets: ws.cnt }} />;
}
