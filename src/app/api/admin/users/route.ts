import { NextRequest } from "next/server";
import { requireAdmin } from "@/lib/auth";
import { ok, parseQuery, PaginationSchema } from "@/lib/validations";
import { getAllUsers } from "@/lib/services/user.service";

export async function GET(request: NextRequest) {
  const user = requireAdmin(request);
  if (user instanceof Response) return user;
  const query = parseQuery(request, PaginationSchema);
  if (query instanceof Response) return query;
  const users = await getAllUsers(query.limit, query.offset);
  return ok(users);
}
