import { adaptCaddyfile } from "@/lib/caddy/admin";
import { authorizeApi } from "@/lib/guards";
import { errorResponse, fail, ok } from "@/lib/http";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const auth = await authorizeApi(["admin", "editor"]);
  if ("response" in auth) return auth.response;

  let body: { caddyfile?: unknown };
  try {
    body = (await request.json()) as { caddyfile?: unknown };
  } catch {
    return fail("Invalid request body.", 400);
  }

  const caddyfile = typeof body.caddyfile === "string" ? body.caddyfile : "";
  if (!caddyfile.trim()) {
    return fail("Paste a Caddyfile before adapting it.", 422);
  }

  try {
    const config = await adaptCaddyfile(caddyfile);
    return ok({ config, warnings: [] });
  } catch (error) {
    return errorResponse(error);
  }
}
