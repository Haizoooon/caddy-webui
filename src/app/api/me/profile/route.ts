import { z } from "zod";
import { authorizeApi } from "@/lib/guards";
import { DatabaseError, audit } from "@/lib/db";
import { UserError, getUserById, updateProfile } from "@/lib/users";
import { fail, ok } from "@/lib/http";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const schema = z.object({
  name: z.string().trim().max(120).optional(),
  email: z.string().trim().email().max(254).or(z.literal("")).optional(),
  avatar: z
    .string()
    .max(600_000)
    .refine(
      (value) =>
        value === "" ||
        /^data:image\/(png|jpeg|webp);base64,[A-Za-z0-9+/=]+$/.test(value),
      "Use a PNG, JPEG or WebP image.",
    )
    .optional(),
  emailNotifications: z.boolean().optional(),
});

function errorResponse(error: unknown) {
  if (error instanceof UserError) return fail(error.message, error.status);
  if (error instanceof DatabaseError) {
    return fail("The database is unavailable.", 503);
  }
  console.error("[caddyweb] profile:", error);
  return fail("Unexpected server error.", 500);
}

export async function GET() {
  const auth = await authorizeApi();
  if ("response" in auth) return auth.response;

  if (!auth.user.userId) {
    return fail("Profiles require the database.", 400);
  }

  try {
    const user = getUserById(auth.user.userId);
    if (!user) return fail("User not found.", 404);
    return ok({ user });
  } catch (error) {
    return errorResponse(error);
  }
}

export async function PATCH(request: Request) {
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
    return fail("Please check the profile fields.", 422, {
      issues: Object.fromEntries(
        parsed.error.issues.map((issue) => [issue.path.join("."), issue.message]),
      ),
    });
  }

  try {
    const user = updateProfile(auth.user.userId, {
      name: parsed.data.name,
      email:
        parsed.data.email === undefined ? undefined : parsed.data.email || null,
      avatar:
        parsed.data.avatar === undefined ? undefined : parsed.data.avatar || null,
      emailNotifications: parsed.data.emailNotifications,
    });

    audit(auth.user.username, "profile.update", user.username);
    return ok({ user });
  } catch (error) {
    return errorResponse(error);
  }
}
