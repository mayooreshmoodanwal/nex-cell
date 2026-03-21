import { NextRequest } from "next/server";
import { requireAdmin } from "@/lib/auth";
import { ok } from "@/lib/validations";
import { getPendingComments } from "@/lib/services/comment.service";

export async function GET(request: NextRequest) {
  const user = requireAdmin(request);
  if (user instanceof Response) return user;
  const comments = await getPendingComments();
  return ok(comments);
}
