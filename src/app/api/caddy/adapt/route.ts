import { adaptCaddyfile } from "@/lib/caddy/admin";
import { requireApiAuth } from "@/lib/guards";
import { errorResponse, fail, ok } from "@/lib/http";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const denied = await requireApiAuth();
  if (denied) return denied;

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
