import { z } from "zod";
import { getConfig } from "@/lib/caddy/admin";
import { ApiError } from "@/lib/caddy/errors";
import { parseSites } from "@/lib/caddy/parse";
import {
  emptySiteInput,
  formatZodError,
  siteInputSchema,
  siteKinds,
  tlsModes,
  type SiteInput,
} from "@/lib/caddy/schema";
import { createSite, normalizeSiteInput } from "@/lib/caddy/site-service";
import { authorizeApiOrToken } from "@/lib/api-auth";
import { audit } from "@/lib/db";
import { errorResponse, ok } from "@/lib/http";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const subdomainSchema = z.object({
  host: z.string().trim().max(253).optional(),
  hosts: z.array(z.string().trim().min(1).max(253)).max(20).optional(),
  subdomain: z.string().trim().max(253).optional(),
  domain: z.string().trim().max(253).optional(),
  kind: z.enum(siteKinds).optional(),
  type: z.enum(siteKinds).optional(),
  target: z.union([z.string(), z.array(z.string())]).optional(),
  upstreams: z.array(z.string()).max(20).optional(),
  root: z.string().trim().max(512).optional(),
  redirectTo: z.string().trim().max(1024).optional(),
  status: z.number().int().min(200).max(599).optional(),
  body: z.string().max(40000).optional(),
  tls: z.enum(tlsModes).default("auto"),
  path: z.string().trim().max(512).optional(),
  browse: z.boolean().optional(),
  spa: z.boolean().optional(),
  compress: z.boolean().optional(),
  basicAuth: z
    .object({
      username: z.string().trim().min(1).max(64),
      password: z.string().min(1).max(128),
    })
    .optional(),
  handlers: z.string().max(200000).optional(),
});

function resolveHosts(input: z.infer<typeof subdomainSchema>): string[] {
  if (input.hosts && input.hosts.length > 0) return input.hosts;
  if (input.host) return [input.host];

  const subdomain = (input.subdomain || "").replace(/^\.+|\.+$/g, "");
  if (!subdomain) {
    throw new ApiError("Provide `host`, `hosts` or `subdomain`.", 422);
  }

  const baseDomain = (input.domain || process.env.CADDYWEB_BASE_DOMAIN || "")
    .trim()
    .replace(/^\.+|\.+$/g, "");

  if (!baseDomain) {
    if (!subdomain.includes(".")) {
      throw new ApiError(
        "A bare subdomain needs `domain` or CADDYWEB_BASE_DOMAIN.",
        422,
      );
    }
    return [subdomain];
  }

  return [`${subdomain}.${baseDomain}`];
}

function targetList(input: z.infer<typeof subdomainSchema>): string[] {
  if (input.upstreams?.length) return input.upstreams;
  if (Array.isArray(input.target)) return input.target;
  if (typeof input.target === "string" && input.target.trim()) {
    return [input.target];
  }
  return [];
}

function buildInput(input: z.infer<typeof subdomainSchema>): SiteInput {
  const kind = input.kind ?? input.type ?? "reverse_proxy";
  const site = emptySiteInput(kind);

  site.hosts = resolveHosts(input);
  site.tls = input.tls;
  site.path = input.path ?? "";
  site.encode = input.compress ?? true;
  site.spaFallback = input.spa ?? false;

  if (input.basicAuth) {
    site.auth = {
      enabled: true,
      username: input.basicAuth.username,
      password: input.basicAuth.password,
    };
  }

  if (kind === "reverse_proxy") {
    site.upstreams = targetList(input);
  } else if (kind === "file_server" || kind === "filemanager") {
    site.root = input.root || input.target?.toString() || "";
    site.browse = input.browse ?? kind === "filemanager";
  } else if (kind === "redirect") {
    site.redirectTo = input.redirectTo || input.target?.toString() || "";
    site.redirectCode =
      input.status === 301 || input.status === 307 || input.status === 308
        ? input.status
        : 302;
  } else if (kind === "respond") {
    site.respondStatus = input.status ?? 200;
    site.respondBody = input.body ?? input.target?.toString() ?? "";
  } else if (kind === "custom") {
    site.customHandlers = input.handlers || "";
  }

  const parsed = siteInputSchema.safeParse(site);
  if (!parsed.success) {
    throw new ApiError("Invalid subdomain definition.", 422, {
      issues: formatZodError(parsed.error),
    });
  }

  return normalizeSiteInput(parsed.data);
}

export async function GET(request: Request) {
  const auth = await authorizeApiOrToken(request);
  if ("response" in auth) return auth.response;

  try {
    const config = await getConfig();
    const sites = parseSites(config).map((site) => ({
      ref: site.ref,
      hosts: site.hosts,
      kind: site.kind,
      tls: site.tls,
      target: site.target,
    }));
    return ok({ sites });
  } catch (error) {
    return errorResponse(error);
  }
}

export async function POST(request: Request) {
  const auth = await authorizeApiOrToken(request, ["admin", "editor"]);
  if ("response" in auth) return auth.response;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return errorResponse(new ApiError("Invalid JSON body.", 400));
  }

  const parsed = subdomainSchema.safeParse(body);
  if (!parsed.success) {
    return errorResponse(
      new ApiError("Invalid subdomain definition.", 422, {
        issues: formatZodError(parsed.error),
      }),
    );
  }

  try {
    const input = buildInput(parsed.data);
    const result = await createSite(input);
    audit(
      `${auth.user.username} (api)`,
      "site.create",
      input.hosts.join(", "),
      `${input.kind} · ${input.tls}`,
    );

    return ok({
      ref: result.ref,
      hosts: input.hosts,
      kind: input.kind,
      tls: input.tls,
      warnings: result.warnings,
    });
  } catch (error) {
    return errorResponse(error);
  }
}
