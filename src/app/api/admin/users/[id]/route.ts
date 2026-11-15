import { z } from "zod";
import { authorizeApi } from "@/lib/guards";
import { DatabaseError, audit } from "@/lib/db";
import { UserError, deleteUser, updateUser } from "@/lib/users";
import { fail, ok } from "@/lib/http";
import { roles } from "@/lib/roles";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const updateSchema = z.object({
  username: z
    .string()
    .trim()
    .min(3)
    .max(64)
    .regex(/^[a-zA-Z0-9._-]+$/)
    .optional(),
  name: z.string().trim().max(120).optional(),
  email: z.string().trim().email().max(254).or(z.literal("")).optional(),
  password: z.string().min(8).max(128).optional(),
  role: z.enum(roles).optional(),
  active: z.boolean().optional(),
  emailNotifications: z.boolean().optional(),
});

function errorResponse(error: unknown) {
  if (error instanceof UserError) return fail(error.message, error.status);
  if (error instanceof DatabaseError) {
    return fail("The database is unavailable.", 503);
  }
  console.error("[caddyweb] admin user:", error);
  return fail("Unexpected server error.", 500);
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = await authorizeApi(["admin"]);
  if ("response" in auth) return auth.response;

  const id = Number((await params).id);
  if (!Number.isInteger(id) || id < 1) return fail("Invalid user id.", 400);

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return fail("Invalid request body.", 400);
  }

  const parsed = updateSchema.safeParse(body);
  if (!parsed.success) return fail("Please check the user details.", 422);

  try {
    const user = await updateUser(id, {
      username: parsed.data.username,
      name: parsed.data.name,
      email:
        parsed.data.email === undefined ? undefined : parsed.data.email || null,
      password: parsed.data.password,
      role: parsed.data.role,
      active: parsed.data.active,
      emailNotifications: parsed.data.emailNotifications,
    });

    audit(auth.user.username, "user.update", user.username, user.role);
    return ok({ user });
  } catch (error) {
    return errorResponse(error);
  }
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = await authorizeApi(["admin"]);
  if ("response" in auth) return auth.response;

  const id = Number((await params).id);
  if (!Number.isInteger(id) || id < 1) return fail("Invalid user id.", 400);

  try {
    await deleteUser(id, auth.user.userId);
    audit(auth.user.username, "user.delete", String(id));
    return ok({});
  } catch (error) {
    return errorResponse(error);
  }
}
