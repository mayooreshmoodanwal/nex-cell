import { NextRequest } from "next/server";
import { requireTreasurer } from "@/lib/auth";
import { ok } from "@/lib/validations";
import { getPendingPaymentRequests } from "@/lib/services/treasurer.service";

export async function GET(request: NextRequest) {
  const user = requireTreasurer(request);
  if (user instanceof Response) return user;
  const requests = await getPendingPaymentRequests();
  return ok(requests);
}
