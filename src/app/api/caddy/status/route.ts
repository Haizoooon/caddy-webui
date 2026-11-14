import { getConfig, publicAdminUrl } from "@/lib/caddy/admin";
import { isAuthEnabled } from "@/lib/session";
import { APP_VERSION } from "@/lib/version";
import { requireApiAuth } from "@/lib/guards";
import { ok } from "@/lib/http";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const version = APP_VERSION;

export async function GET() {
  const denied = await requireApiAuth();
  if (denied) return denied;

  const started = Date.now();
  const ports = {
    httpPort: process.env.CADDY_HTTP_PORT || "80",
    httpsPort: process.env.CADDY_HTTPS_PORT || "443",
    authEnabled: isAuthEnabled(),
    version,
  };

  try {
    await getConfig();
    return ok({
      connected: true,
      adminUrl: publicAdminUrl(),
      latencyMs: Date.now() - started,
      ...ports,
    });
  } catch (error) {
    return ok({
      connected: false,
      adminUrl: publicAdminUrl(),
      latencyMs: null,
      error: error instanceof Error ? error.message : "Unknown error",
      ...ports,
    });
  }
}
