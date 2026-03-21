import { NextRequest } from "next/server";
import { requireAuth } from "@/lib/auth";
import { ok, err, parseBody, UpdateProfileSchema } from "@/lib/validations";
import {
  getUserById, updateProfile, softDeleteUser,
} from "@/lib/services/user.service";

// GET /api/users/me — get current user profile + roles
export async function GET(request: NextRequest) {
  const user = requireAuth(request);
  if (user instanceof Response) return user;

  const profile = await getUserById(user.id);
  if (!profile) return err("User not found", 404);

  return ok(profile);
}

// PATCH /api/users/me — update name or avatar
export async function PATCH(request: NextRequest) {
  const user = requireAuth(request);
  if (user instanceof Response) return user;

  const body = await parseBody(request, UpdateProfileSchema);
  if (body instanceof Response) return body;

  const updated = await updateProfile(user.id, body);
  return ok(updated);
}

// DELETE /api/users/me — soft-delete own account
export async function DELETE(request: NextRequest) {
  const user = requireAuth(request);
  if (user instanceof Response) return user;

  await softDeleteUser(user.id, user.id);

  // Clear auth cookies
  const { clearAuthCookies } = await import("@/lib/auth");
  const { NextResponse } = await import("next/server");
  const response = NextResponse.json({
    success: true,
    data: { message: "Your account has been deleted." },
  });
  clearAuthCookies(response);
  return response;
}
