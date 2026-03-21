import { NextRequest } from "next/server";
import { requireAuth } from "@/lib/auth";
import { ok, parseBody, MarkReadSchema } from "@/lib/validations";
import { markAsRead, markAllAsRead } from "@/lib/services/notification.service";

export async function POST(request: NextRequest) {
  const user = requireAuth(request);
  if (user instanceof Response) return user;
  const body = await parseBody(request, MarkReadSchema);
  if (body instanceof Response) return body;
  if (body.markAll) {
    await markAllAsRead(user.id);
  } else if (body.ids?.length) {
    await markAsRead(user.id, body.ids);
  }
  return ok({ message: "Notifications marked as read." });
}
