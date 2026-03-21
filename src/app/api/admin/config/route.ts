import { NextRequest } from "next/server";
import { requireAdmin } from "@/lib/auth";
import { ok, parseBody, UpdateConfigSchema } from "@/lib/validations";
import { setAppConfig } from "@/lib/services/user.service";
import { db } from "@/lib/db/client";
import { appConfig } from "@/lib/db/schema";

export async function GET(request: NextRequest) {
  const user = requireAdmin(request);
  if (user instanceof Response) return user;
  const configs = await db.select().from(appConfig);
  return ok(configs);
}

export async function POST(request: NextRequest) {
  const user = requireAdmin(request);
  if (user instanceof Response) return user;
  const body = await parseBody(request, UpdateConfigSchema);
  if (body instanceof Response) return body;
  await setAppConfig(body.key, body.value, user.id);
  return ok({ message: "Config updated." });
}
