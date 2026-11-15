import { z } from "zod";
import { authorizeApi } from "@/lib/guards";
import { DatabaseError, audit } from "@/lib/db";
import {
  UserError,
  createApiToken,
  listApiTokens,
  revokeApiToken,
} from "@/lib/users";
import { fail, ok } from "@/lib/http";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const createSchema = z.object({
  userId: z.number().int().positive(),
  name: z.string().trim().min(1).max(80),
  expiresInDays: z.number().int().min(0).max(3650).optional(),
});

function errorResponse(error: unknown) {
  if (error instanceof UserError) return fail(error.message, error.status);
  if (error instanceof DatabaseError) {
    return fail("The database is unavailable.", 503);
  }
  console.error("[caddyweb] admin tokens:", error);
  return fail("Unexpected server error.", 500);
}

export async function GET() {
  const auth = await authorizeApi(["admin"]);
  if ("response" in auth) return auth.response;

  try {
    return ok({ tokens: listApiTokens() });
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
  if (!parsed.success) return fail("Please check the token details.", 422);

  try {
    const created = createApiToken(
      parsed.data.userId,
      parsed.data.name,
      parsed.data.expiresInDays ?? null,
    );

    audit(
      auth.user.username,
      "token.create",
      created.record.username,
      created.record.prefix,
    );

    return ok({ token: created.token, record: created.record }, 201);
  } catch (error) {
    return errorResponse(error);
  }
}

export async function DELETE(request: Request) {
  const auth = await authorizeApi(["admin"]);
  if ("response" in auth) return auth.response;

  const id = Number(new URL(request.url).searchParams.get("id"));
  if (!Number.isInteger(id) || id < 1) return fail("Invalid token id.", 400);

  try {
    revokeApiToken(id);
    audit(auth.user.username, "token.revoke", String(id));
    return ok({});
  } catch (error) {
    return errorResponse(error);
  }
}
