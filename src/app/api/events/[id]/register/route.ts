import { NextRequest } from "next/server";
import { requireAuth } from "@/lib/auth";
import { ok, err } from "@/lib/validations";
import { registerForEvent } from "@/lib/services/event.service";
import { getClientIp } from "@/lib/rate-limit";

export async function POST(request: NextRequest, { params }: { params: { id: string } }) {
  const user = requireAuth(request);
  if (user instanceof Response) return user;

  const result = await registerForEvent(params.id, user.id, getClientIp(request));
  if (!result.success) return err(result.error ?? "Registration failed", 400);
  return ok({ message: "Successfully registered for the event!" });
}
