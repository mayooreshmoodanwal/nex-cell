import { NextRequest } from "next/server";
import { requireAuth, getCurrentUser } from "@/lib/auth";
import { ok, err, parseBody, parseQuery, PostCommentSchema } from "@/lib/validations";
import { postComment, getApprovedComments } from "@/lib/services/comment.service";
import { z } from "zod";

export async function GET(request: NextRequest) {
  const query = parseQuery(request, z.object({ eventId: z.string().uuid() }));
  if (query instanceof Response) return query;
  const comments = await getApprovedComments(query.eventId);
  return ok(comments);
}

export async function POST(request: NextRequest) {
  const user = requireAuth(request);
  if (user instanceof Response) return user;
  const body = await parseBody(request, PostCommentSchema);
  if (body instanceof Response) return body;
  const result = await postComment({ eventId: body.eventId, userId: user.id, body: body.body });
  return ok({ comment: result.comment, status: result.status, message: result.status === "pending" ? "Comment submitted for review." : "Comment posted." }, 201);
}
