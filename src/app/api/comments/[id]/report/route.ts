import { NextRequest } from "next/server";
import { requireAuth } from "@/lib/auth";
import { ok, parseBody, ReportCommentSchema } from "@/lib/validations";
import { reportComment } from "@/lib/services/comment.service";

export async function POST(request: NextRequest, { params }: { params: { id: string } }) {
  const user = requireAuth(request);
  if (user instanceof Response) return user;
  const body = await parseBody(request, ReportCommentSchema);
  if (body instanceof Response) return body;
  await reportComment(params.id, user.id, body.reason);
  return ok({ message: "Report submitted." });
}
