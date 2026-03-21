import { NextRequest } from "next/server";
import { requireAdmin } from "@/lib/auth";
import { ok, parseQuery, PaginationSchema } from "@/lib/validations";
import { getAuditLogs } from "@/lib/services/audit.service";

export async function GET(request: NextRequest) {
  const user = requireAdmin(request);
  if (user instanceof Response) return user;
  const query = parseQuery(request, PaginationSchema);
  if (query instanceof Response) return query;
  const logs = await getAuditLogs({ limit: query.limit, offset: query.offset });
  return ok(logs);
}
