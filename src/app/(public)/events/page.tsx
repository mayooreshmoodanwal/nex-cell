import { cookies } from "next/headers";
import { getEvents } from "@/lib/services/event.service";
import EventsClient from "./EventsClient";

export const metadata = { title: "Events" };

export default async function EventsPage() {
  const events = await getEvents({ upcoming: true, limit: 50 });

  // Check if user is logged in and has member+ role
  let canCreate = false;
  try {
    const { verifyAccessToken } = await import("@/lib/auth");
    const cookieStore = await cookies();
    const token = cookieStore.get("access_token")?.value;
    if (token) {
      const payload = await verifyAccessToken(token);
      const MEMBER_ROLES = ["member", "treasurer", "admin"];
      canCreate = payload.roles?.some((r: string) => MEMBER_ROLES.includes(r)) ?? false;
    }
  } catch {
    // Not logged in or token expired — canCreate stays false
  }

  return <EventsClient events={events} canCreate={canCreate} />;
}
