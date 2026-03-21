import { NextRequest } from "next/server";
import { requireAuth } from "@/lib/auth";
import { ok } from "@/lib/validations";
import { toggleLike } from "@/lib/services/event.service";

export async function POST(request: NextRequest, { params }: { params: { id: string } }) {
  const user = requireAuth(request);
  if (user instanceof Response) return user;
  const result = await toggleLike(params.id, user.id);
  return ok(result);
}
