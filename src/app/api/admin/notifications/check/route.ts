import { authorizeApi } from "@/lib/guards";
import { runHealthCheck } from "@/lib/monitor";
import { recentEmails } from "@/lib/mailer";
import { fail, ok } from "@/lib/http";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST() {
  const auth = await authorizeApi(["admin"]);
  if ("response" in auth) return auth.response;

  try {
    const result = await runHealthCheck({ force: true });
    return ok({ check: result, emails: recentEmails(10) });
  } catch (error) {
    console.error("[caddyweb] manual health check:", error);
    return fail("Health check failed.", 500);
  }
}
