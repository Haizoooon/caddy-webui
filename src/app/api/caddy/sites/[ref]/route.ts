import { ApiError } from "@/lib/caddy/errors";
import { buildRoute } from "@/lib/caddy/handlers";
import {
  applyTlsPolicy,
  ensureNoDuplicateHost,
  findRoute,
} from "@/lib/caddy/mutate";
import { parseSite, routeHosts } from "@/lib/caddy/parse";
import { decodeRef, managedId } from "@/lib/caddy/ref";
import { requireApiAuth } from "@/lib/guards";
import { errorResponse, fail, ok } from "@/lib/http";
import { getConfig, mutateConfig } from "@/lib/caddy/admin";
import {
  assertValidRouteInput,
  hashSitePassword,
  readSiteInput,
  requirePassword,
} from "@/lib/caddy/site-service";
import { randomId } from "@/lib/utils";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type RouteParams = { params: Promise<{ ref: string }> };

export async function GET(_request: Request, { params }: RouteParams) {
  const denied = await requireApiAuth();
  if (denied) return denied;

  const ref = decodeRef((await params).ref);
  if (!ref) return fail("Invalid site reference.", 400);

  try {
    const config = await getConfig();
    const found = findRoute(config, ref);
    if (!found) return fail("Site not found. It may have been removed.", 404);

    return ok({
      site: parseSite(config, found.serverName, found.server, found.index),
    });
  } catch (error) {
    return errorResponse(error);
  }
}

export async function PUT(request: Request, { params }: RouteParams) {
  const denied = await requireApiAuth();
  if (denied) return denied;

  const ref = decodeRef((await params).ref);
  if (!ref) return fail("Invalid site reference.", 400);

  try {
    const input = await readSiteInput(request);
    assertValidRouteInput(input);

    const routeId = randomId();

    const { warnings } = await mutateConfig(async (config) => {
      const found = findRoute(config, ref);
      if (!found) {
        throw new ApiError("Site not found. It may have been removed.", 404);
      }

      // Resolves to the existing bcrypt hash when the password field is blank.
      const existingHash = requirePassword(input, found.route);
      const newHash = await hashSitePassword(input);
      const id = managedId(found.route["@id"]) ?? routeId;
      const built = buildRoute(input, {
        id,
        passwordHash: newHash,
        existingAuthHash: existingHash,
      });

      ensureNoDuplicateHost(config, input.hosts, found.route);

      const oldHosts = routeHosts(found.route);
      found.server.routes![found.index] = built;

      applyTlsPolicy(config, oldHosts, "auto");
      applyTlsPolicy(config, input.hosts, input.tls);
    });

    return ok({ warnings });
  } catch (error) {
    return errorResponse(error);
  }
}

export async function DELETE(_request: Request, { params }: RouteParams) {
  const denied = await requireApiAuth();
  if (denied) return denied;

  const ref = decodeRef((await params).ref);
  if (!ref) return fail("Invalid site reference.", 400);

  try {
    const { warnings } = await mutateConfig((config) => {
      const found = findRoute(config, ref);
      if (!found) {
        throw new ApiError("Site not found. It may have been removed.", 404);
      }

      const hosts = routeHosts(found.route);
      found.server.routes!.splice(found.index, 1);
      applyTlsPolicy(config, hosts, "auto");
    });

    return ok({ warnings });
  } catch (error) {
    return errorResponse(error);
  }
}
