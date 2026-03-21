import { NextRequest } from "next/server";
import { requireAuth, isMember } from "@/lib/auth";
import { ok, err, parseBody, parseQuery, CreateEventSchema, PaginationSchema } from "@/lib/validations";
import { getEvents, createEvent } from "@/lib/services/event.service";
import { z } from "zod";
import { getClientIp } from "@/lib/rate-limit";

const EventQuerySchema = PaginationSchema.extend({
  type:     z.enum(["free", "paid_mb"]).optional(),
  archived: z.coerce.boolean().optional().default(false),
});

// GET /api/events — public event listing
export async function GET(request: NextRequest) {
  const query = parseQuery(request, EventQuerySchema);
  if (query instanceof Response) return query;

  // Get user ID for personalisation if logged in
  const { getCurrentUser } = await import("@/lib/auth");
  const user = getCurrentUser(request);

  const events = await getEvents({
    type:     query.type,
    archived: query.archived,
    limit:    query.limit,
    offset:   query.offset,
    userId:   user?.id,
  });

  return ok(events);
}

// POST /api/events — create event (member+ only)
export async function POST(request: NextRequest) {
  const user = requireAuth(request);
  if (user instanceof Response) return user;

  if (!isMember(user)) {
    return err("Only members and above can create events.", 403);
  }

  const body = await parseBody(request, CreateEventSchema);
  if (body instanceof Response) return body;

  const event = await createEvent(
    {
      ...body,
      eventDate:            new Date(body.eventDate),
      registrationDeadline: new Date(body.registrationDeadline),
    },
    user.id,
    getClientIp(request)
  );

  return ok(event, 201);
}
