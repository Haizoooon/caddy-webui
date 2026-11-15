import { z } from "zod";
import { authorizeApi } from "@/lib/guards";
import { DatabaseError, audit } from "@/lib/db";
import { UserError, createUser, listUsers } from "@/lib/users";
import { fail, ok } from "@/lib/http";
import { roles } from "@/lib/roles";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const createSchema = z.object({
  username: z
    .string()
    .trim()
    .min(3)
    .max(64)
    .regex(/^[a-zA-Z0-9._-]+$/, "Use letters, numbers, dots, dashes or underscores."),
  name: z.string().trim().max(120).optional(),
  email: z.string().trim().email().max(254).or(z.literal("")).optional(),
  password: z.string().min(8).max(128),
  role: z.enum(roles),
  active: z.boolean().optional(),
});

function errorResponse(error: unknown) {
  if (error instanceof UserError) return fail(error.message, error.status);
  if (error instanceof DatabaseError) {
    return fail("The database is unavailable.", 503);
  }
  console.error("[caddyweb] admin users:", error);
  return fail("Unexpected server error.", 500);
}

export async function GET() {
  const auth = await authorizeApi(["admin"]);
  if ("response" in auth) return auth.response;

  try {
    return ok({ users: listUsers() });
  } catch (error) {
    return errorResponse(error);
  }
}

export async function POST(request: Request) {
  const auth = await authorizeApi(["admin"]);
  if ("response" in auth) return auth.response;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return fail("Invalid request body.", 400);
  }

  const parsed = createSchema.safeParse(body);
  if (!parsed.success) {
    return fail("Please check the user details.", 422);
  }

  try {
    const user = createUser({
      username: parsed.data.username,
      name: parsed.data.name,
      email: parsed.data.email || undefined,
      password: parsed.data.password,
      role: parsed.data.role,
      active: parsed.data.active,
    });

    audit(auth.user.username, "user.create", user.username, user.role);
    return ok({ user }, 201);
  } catch (error) {
    return errorResponse(error);
  }
}
