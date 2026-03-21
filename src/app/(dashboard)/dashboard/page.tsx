import { cookies } from "next/headers";
import { verifyAccessToken } from "@/lib/auth";
import { getUserById } from "@/lib/services/user.service";
import { getWalletWithTransactions } from "@/lib/services/wallet.service";
import { getUserRegistrations } from "@/lib/services/event.service";
import { getUserNotifications, getUnreadCount } from "@/lib/services/notification.service";
import DashboardClient from "./DashboardClient";

export const metadata = { title: "Dashboard" };

export default async function DashboardPage() {
  const cookieStore = await cookies();
  const token = cookieStore.get("access_token")?.value!;
  const payload = await verifyAccessToken(token);

  const [profile, walletData, registrations, notifications, unreadCount] = await Promise.all([
    getUserById(payload.sub),
    getWalletWithTransactions(payload.sub, 5, 0),
    getUserRegistrations(payload.sub),
    getUserNotifications(payload.sub, 5, 0),
    getUnreadCount(payload.sub),
  ]);

  const MEMBER_ROLES = ["member", "treasurer", "admin"];
  const canCreate = payload.roles?.some((r: string) => MEMBER_ROLES.includes(r)) ?? false;

  return (
    <DashboardClient
      user={profile}
      wallet={walletData}
      registrations={registrations}
      notifications={notifications}
      unreadCount={unreadCount}
      canCreate={canCreate}
    />
  );
}

