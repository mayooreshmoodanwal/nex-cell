import { NextRequest } from "next/server";
import { requireAdmin } from "@/lib/auth";
import { ok, err, parseBody, ModerateCommentSchema } from "@/lib/validations";
import { moderateComment } from "@/lib/services/comment.service";

export async function POST(request: NextRequest, { params }: { params: { id: string } }) {
  const user = requireAdmin(request);
  if (user instanceof Response) return user;
  const body = await parseBody(request, ModerateCommentSchema);
  if (body instanceof Response) return body;
  const result = await moderateComment(params.id, user.id, body.action, body.reason);
  if (!result.success) return err(result.error ?? "Failed", 400);
  return ok({ message: `Comment ${body.action}d.` });
}
