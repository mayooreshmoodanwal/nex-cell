import { NextRequest } from "next/server";
import { requireAdmin } from "@/lib/auth";
import { ok, err, parseBody, AssignRoleSchema } from "@/lib/validations";
import { assignRole, revokeRole } from "@/lib/services/user.service";
import { getClientIp } from "@/lib/rate-limit";

// POST /api/users/role — assign or revoke a role (admin only)
export async function POST(request: NextRequest) {
  const admin = requireAdmin(request);
  if (admin instanceof Response) return admin;

  const body = await parseBody(request, AssignRoleSchema);
  if (body instanceof Response) return body;

  // Prevent admin from removing their own admin role
  if (body.userId === admin.id && body.role === "admin" && body.action === "revoke") {
    return err("You cannot remove your own admin role.", 400);
  }

  const ipAddress = getClientIp(request);

  if (body.action === "assign") {
    await assignRole(body.userId, body.role, admin.id, ipAddress);
    return ok({ message: `Role "${body.role}" assigned successfully.` });
  } else {
    await revokeRole(body.userId, body.role, admin.id, ipAddress);
    return ok({ message: `Role "${body.role}" revoked successfully.` });
  }
}
