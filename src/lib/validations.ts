/**
 * SHARED VALIDATION UTILITIES
 * Zod schemas + helpers used across all API routes.
 *
 * Pattern used in every route handler:
 *   const body = await parseBody(request, MySchema);
 *   if (body instanceof NextResponse) return body;
 *   // body is now fully typed and validated
 */

import { NextRequest, NextResponse } from "next/server";
import { z, ZodSchema } from "zod";

// ─────────────────────────────────────────────────────────────
// STANDARD RESPONSE SHAPES
// ─────────────────────────────────────────────────────────────

export function ok<T>(data: T, status = 200): NextResponse {
  return NextResponse.json({ success: true, data }, { status });
}

export function created<T>(data: T): NextResponse {
  return NextResponse.json({ success: true, data }, { status: 201 });
}

export function noContent(): NextResponse {
  return new NextResponse(null, { status: 204 });
}

export function err(message: string, status: number, details?: unknown): NextResponse {
  const body: Record<string, unknown> = { success: false, error: message };
  if (process.env.NODE_ENV === "development" && details) {
    body.details = String(details);
  }
  return NextResponse.json(body, { status });
}

export function validationError(issues: z.ZodIssue[]): NextResponse {
  return NextResponse.json(
    {
      success: false,
      error:   "Validation failed",
      fields:  issues.map((i) => ({ path: i.path.join("."), message: i.message })),
    },
    { status: 422 }
  );
}

// ─────────────────────────────────────────────────────────────
// BODY PARSER + VALIDATOR
// ─────────────────────────────────────────────────────────────

/**
 * Parses the request body as JSON and validates it against a Zod schema.
 * Returns the typed data on success, or a NextResponse error on failure.
 *
 * Usage:
 *   const body = await parseBody(request, MySchema);
 *   if (body instanceof NextResponse) return body;
 */
export async function parseBody<T extends ZodSchema>(
  request: NextRequest,
  schema:  T
): Promise<z.infer<T> | NextResponse> {
  let raw: unknown;

  try {
    raw = await request.json();
  } catch {
    return err("Request body must be valid JSON", 400);
  }

  const result = schema.safeParse(raw);
  if (!result.success) {
    return validationError(result.error.issues);
  }

  return result.data;
}

/**
 * Parses URL search params against a Zod schema.
 */
export function parseQuery<T extends ZodSchema>(
  request: NextRequest,
  schema:  T
): z.infer<T> | NextResponse {
  const params: Record<string, string> = {};
  request.nextUrl.searchParams.forEach((value, key) => {
    params[key] = value;
  });

  const result = schema.safeParse(params);
  if (!result.success) {
    return validationError(result.error.issues);
  }

  return result.data;
}

// ─────────────────────────────────────────────────────────────
// SHARED ZOD SCHEMAS
// ─────────────────────────────────────────────────────────────

// Email validation — normalised to lowercase
export const EmailSchema = z
  .string()
  .email("Please enter a valid email address")
  .toLowerCase()
  .trim();

// OTP code — exactly 6 digits
export const OtpCodeSchema = z
  .string()
  .length(6, "Code must be exactly 6 digits")
  .regex(/^\d{6}$/, "Code must contain only numbers");

// UUID validation
export const UuidSchema = z.string().uuid("Invalid ID format");

// Pagination
export const PaginationSchema = z.object({
  limit:  z.coerce.number().int().min(1).max(100).default(20),
  offset: z.coerce.number().int().min(0).default(0),
});

// ── Auth schemas ──────────────────────────────────────────────
export const SendOtpSchema = z.object({
  email: EmailSchema,
  role:  z.enum(["participant", "member", "admin"]).optional(),
  // 'role' is a UI hint only — actual role comes from predefined_roles table
});

export const VerifyOtpSchema = z.object({
  email: EmailSchema,
  code:  OtpCodeSchema,
});

// ── User schemas ──────────────────────────────────────────────
export const UpdateProfileSchema = z.object({
  name:      z.string().min(1).max(100).trim().optional(),
  avatarUrl: z.string().url().optional(),
});

export const AssignRoleSchema = z.object({
  userId: UuidSchema,
  role:   z.enum(["participant", "member", "treasurer", "admin"]),
  action: z.enum(["assign", "revoke"]),
});

// ── Event schemas ─────────────────────────────────────────────
export const CreateEventSchema = z.object({
  title:                z.string().min(3).max(200).trim(),
  description:          z.string().min(10).max(5000).trim(),
  shortDescription:     z.string().max(300).trim().optional(),
  eventDate:            z.string().datetime({ message: "Invalid date format" }),
  registrationDeadline: z.string().datetime({ message: "Invalid date format" }),
  type:                 z.enum(["free", "paid_mb"]),
  priceMb:              z.number().int().positive().optional(),
  maxParticipants:      z.number().int().positive().optional(),
  imageUrl:             z.string().url().optional(),
  venue:                z.string().max(200).trim().optional(),
  tags:                 z.array(z.string().max(30)).max(10).optional(),
}).refine((data) => {
  if (data.type === "paid_mb" && !data.priceMb) {
    return false;
  }
  return true;
}, { message: "Price in Mirai Bucks is required for paid events", path: ["priceMb"] })
.refine((data) => {
  return new Date(data.eventDate) > new Date(data.registrationDeadline);
}, { message: "Event date must be after registration deadline", path: ["eventDate"] });

export const UpdateEventSchema = z.object({
  title:                z.string().min(3).max(200).trim().optional(),
  description:          z.string().min(10).max(5000).trim().optional(),
  shortDescription:     z.string().max(300).trim().optional(),
  eventDate:            z.string().datetime().optional(),
  registrationDeadline: z.string().datetime().optional(),
  type:                 z.enum(["free", "paid_mb"]).optional(),
  priceMb:              z.number().int().positive().optional(),
  maxParticipants:      z.number().int().positive().optional(),
  imageUrl:             z.string().url().optional(),
  venue:                z.string().max(200).trim().optional(),
  tags:                 z.array(z.string().max(30)).max(10).optional(),
  isPublished:          z.boolean().optional(),
  autoApproveComments:  z.boolean().optional(),
});

// ── Wallet schemas ────────────────────────────────────────────
export const SubmitPaymentRequestSchema = z.object({
  amountInr:        z.number().positive().max(50000, "Maximum single payment is ₹50,000"),
  upiTransactionId: z.string().min(6).max(50).trim(),
  proofUrl:         z.string().url("Proof URL must be a valid URL"),
});

export const AdminCreditSchema = z.object({
  userId:      UuidSchema,
  amountMb:    z.number().int().positive().max(1_000_000),
  description: z.string().min(3).max(200).trim(),
});

// ── Treasurer schemas ─────────────────────────────────────────
export const RejectPaymentSchema = z.object({
  reason: z.string().min(5).max(500).trim(),
});

export const SubmitExpenseSchema = z.object({
  budgetId:    UuidSchema.optional(),
  amountInr:   z.number().positive().max(50000),
  description: z.string().min(5).max(500).trim(),
  proofUrl:    z.string().url().optional(),
});

export const RejectExpenseSchema = z.object({
  reason: z.string().min(5).max(500).trim(),
});

// ── Budget schemas ────────────────────────────────────────────
export const CreateBudgetSchema = z.object({
  title:          z.string().min(3).max(200).trim(),
  description:    z.string().max(1000).trim().optional(),
  totalAmountInr: z.number().positive().max(10_000_000),
});

// ── Comment schemas ───────────────────────────────────────────
export const PostCommentSchema = z.object({
  eventId: UuidSchema,
  body:    z.string().min(1).max(1000).trim(),
});

export const ModerateCommentSchema = z.object({
  action: z.enum(["approve", "reject"]),
  reason: z.string().max(500).trim().optional(),
});

export const ReportCommentSchema = z.object({
  reason: z.string().min(5).max(500).trim(),
});

// ── Config schemas ────────────────────────────────────────────
export const UpdateConfigSchema = z.object({
  key:   z.string().min(1).max(100),
  value: z.string().min(0).max(1000),
});

// ── Notification schemas ──────────────────────────────────────
export const MarkReadSchema = z.object({
  ids:    z.array(UuidSchema).max(50).optional(),
  markAll: z.boolean().optional(),
});
