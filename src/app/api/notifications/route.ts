import { NextRequest } from "next/server";
import { requireAuth } from "@/lib/auth";
import { ok, parseQuery, PaginationSchema } from "@/lib/validations";
import { getUserNotifications, getUnreadCount } from "@/lib/services/notification.service";

export async function GET(request: NextRequest) {
  const user = requireAuth(request);
  if (user instanceof Response) return user;
  const query = parseQuery(request, PaginationSchema);
  if (query instanceof Response) return query;
  const [notifications, unreadCount] = await Promise.all([
    getUserNotifications(user.id, query.limit, query.offset),
    getUnreadCount(user.id),
  ]);
  return ok({ notifications, unreadCount });
}
