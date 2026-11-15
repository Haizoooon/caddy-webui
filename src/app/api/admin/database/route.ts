import { authorizeApi } from "@/lib/guards";
import { DatabaseError, databaseStatus } from "@/lib/db";
import { fail, ok } from "@/lib/http";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const auth = await authorizeApi(["admin"]);
  if ("response" in auth) return auth.response;

  try {
    return ok({ database: await databaseStatus() });
  } catch (error) {
    if (error instanceof DatabaseError) {
      return fail("The database is unavailable.", 503);
    }
    console.error("[caddyweb] admin database:", error);
    return fail("Unexpected server error.", 500);
  }
}
