import { getConfig, mutateConfig } from "@/lib/caddy/admin";
import { buildRoute } from "@/lib/caddy/handlers";
import { describeServers, parseSites } from "@/lib/caddy/parse";
import {
  applyTlsPolicy,
  ensureHttpServer,
  ensureNoDuplicateHost,
  ensureServer,
  insertRoute,
} from "@/lib/caddy/mutate";
import { encodeRef } from "@/lib/caddy/ref";
import { requireApiAuth } from "@/lib/guards";
import { errorResponse, ok } from "@/lib/http";
import {
  assertValidRouteInput,
  hashSitePassword,
  readSiteInput,
  requirePassword,
} from "@/lib/caddy/site-service";
import { randomId } from "@/lib/utils";

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
  const denied = await requireApiAuth();
  if (denied) return denied;

  try {
    const input = await readSiteInput(request);
    assertValidRouteInput(input);
    requirePassword(input);

    const passwordHash = await hashSitePassword(input);
    const id = randomId();

    const { result, warnings } = await mutateConfig((config) => {
      ensureNoDuplicateHost(config, input.hosts);
      const target =
        input.tls === "off"
          ? ensureHttpServer(config, input.serverName)
          : ensureServer(config, input.serverName);
      const route = buildRoute(input, { id, passwordHash });
      const index = insertRoute(target.server, route);
      applyTlsPolicy(config, input.hosts, input.tls);
      return { ref: encodeRef({ server: target.name, index, id: route["@id"] }) };
    });

    return ok({ ref: result.ref, warnings });
  } catch (error) {
    return errorResponse(error);
  }
}
