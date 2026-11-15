import { getConfig } from "@/lib/caddy/admin";
import { describeServers, parseSites } from "@/lib/caddy/parse";
import { authorizeApi, requireApiAuth } from "@/lib/guards";
import { errorResponse, ok } from "@/lib/http";
import { createSite, readSiteInput } from "@/lib/caddy/site-service";
import { audit } from "@/lib/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const denied = await requireApiAuth();
  if (denied) return denied;

  try {
    const config = await getConfig();
    return ok({ sites: parseSites(config), servers: describeServers(config) });
  } catch (error) {
    return errorResponse(error);
  }
}

export async function POST(request: Request) {
  const auth = await authorizeApi(["admin", "editor"]);
  if ("response" in auth) return auth.response;

  try {
    const input = await readSiteInput(request);
    const result = await createSite(input);
    audit(
      auth.user.username,
      "site.create",
      input.hosts.join(", "),
      `${input.kind} · ${input.tls}`,
    );
    return ok(result);
  } catch (error) {
    return errorResponse(error);
  }
}
