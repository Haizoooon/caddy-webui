import { authorizeApi } from "@/lib/guards";
import { DatabaseError, backupDatabase } from "@/lib/db";
import { fail } from "@/lib/http";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const auth = await authorizeApi(["admin"]);
  if ("response" in auth) return auth.response;

  try {
    const { filename, data } = backupDatabase();
    return new Response(new Uint8Array(data), {
      headers: {
        "Content-Type": "application/vnd.sqlite3",
        "Content-Disposition": `attachment; filename="${filename}"`,
        "Cache-Control": "no-store",
      },
    });
  } catch (error) {
    if (error instanceof DatabaseError) {
      return fail("The database is unavailable.", 503);
    }
    console.error("[caddyweb] database backup:", error);
    return fail("Could not create a database backup.", 500);
  }
}
