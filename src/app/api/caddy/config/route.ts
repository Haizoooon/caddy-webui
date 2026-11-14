import { getConfigWithEtag, loadConfig } from "@/lib/caddy/admin";
import { requireApiAuth } from "@/lib/guards";
import { errorResponse, fail, ok } from "@/lib/http";
import type { CaddyConfig } from "@/lib/caddy/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const denied = await requireApiAuth();
  if (denied) return denied;

  try {
    const { config, etag } = await getConfigWithEtag();
    return ok({ config, etag });
  } catch (error) {
    return errorResponse(error);
  }
}

export async function POST(request: Request) {
  const denied = await requireApiAuth();
  if (denied) return denied;

  let body: { config?: unknown };
  try {
    body = (await request.json()) as { config?: unknown };
  } catch {
    return fail("Invalid request body.", 400);
  }

  const config = body.config;
  if (!config || typeof config !== "object" || Array.isArray(config)) {
    return fail("The configuration must be a JSON object.", 422);
  }

  try {
    const warnings = await loadConfig(config as CaddyConfig);
    return ok({ warnings });
  } catch (error) {
    return errorResponse(error);
  }
}
