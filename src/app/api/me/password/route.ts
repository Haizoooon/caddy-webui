import { z } from "zod";
import { authorizeApi } from "@/lib/guards";
import { DatabaseError, audit } from "@/lib/db";
import {
  UserError,
  authenticateUser,
  getUserById,
  setUserPassword,
} from "@/lib/users";
import { fail, ok } from "@/lib/http";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const schema = z.object({
  currentPassword: z.string().max(128).optional(),
  newPassword: z.string().min(8).max(128),
});

export async function POST(request: Request) {
  const auth = await authorizeApi();
  if ("response" in auth) return auth.response;

  if (!auth.user.userId) {
    return fail("Profiles require the database.", 400);
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return fail("Invalid request body.", 400);
  }

  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return fail("The new password must be at least 8 characters.", 422);
  }

  try {
    const user = getUserById(auth.user.userId);
    if (!user) return fail("User not found.", 404);

    const hasPassword = user.authSource === "password" || user.authSource === "both";
    if (hasPassword) {
      const current = parsed.data.currentPassword ?? "";
      const valid = authenticateUser(user.username, current);
      if (!valid) return fail("Current password is incorrect.", 401);
    }

    setUserPassword(user.id, parsed.data.newPassword);
    audit(auth.user.username, "profile.password");
    return ok({});
  } catch (error) {
    if (error instanceof DatabaseError) {
      return fail("The database is unavailable.", 503);
    }
    if (error instanceof UserError) return fail(error.message, error.status);
    console.error("[caddyweb] profile password:", error);
    return fail("Unexpected server error.", 500);
  }
}
