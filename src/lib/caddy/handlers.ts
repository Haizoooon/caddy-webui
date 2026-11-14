import type { CaddyHandler, CaddyMatcher, CaddyRoute } from "./types";
import type { SiteInput } from "./schema";
import { normalizePath } from "./schema";

export const SITE_ID_PREFIX = "caddyweb_";

export interface BuildRouteOptions {
  id: string;
  /** Pre-computed bcrypt hash. Required when basic auth is enabled. */
  passwordHash?: string;
  /** Reuse the hash from an existing route when the password field is left blank. */
  existingAuthHash?: string;
}

function authHandler(username: string, hash: string): CaddyHandler {
  return {
    handler: "authentication",
    providers: {
      http_basic: {
        hash: { algorithm: "bcrypt" },
        accounts: [{ username, password: hash }],
      },
    },
  };
}

function encodeHandler(): CaddyHandler {
  return {
    handler: "encode",
    encodings: { gzip: {}, zstd: {} },
  };
}

function fileServerHandler(input: SiteInput): CaddyHandler[] {
  const root = input.root.trim();
  const browse = input.kind === "filemanager" || input.browse;

  if (input.kind === "file_server" && input.spaFallback) {
    return [
      {
        handler: "subroute",
        routes: [
          {
            match: [{ file: { try_files: ["{http.request.uri.path}"] } }],
            handle: [{ handler: "file_server", root }],
          },
          {
            handle: [
              { handler: "rewrite", uri: "/index.html" },
              { handler: "file_server", root },
            ],
          },
        ],
      },
    ];
  }

  return [
    {
      handler: "file_server",
      root,
      ...(browse ? { browse: {} } : {}),
    },
  ];
}

/**
 * Builds a single Caddy route from the simple site form.
 * Pure so the browser can render an accurate JSON preview.
 */
export function buildRoute(input: SiteInput, options: BuildRouteOptions): CaddyRoute {
  const handle: CaddyHandler[] = [];

  if (input.encode) handle.push(encodeHandler());

  if (input.auth.enabled) {
    const hash = options.passwordHash ?? options.existingAuthHash;
    if (!hash) {
      throw new Error("A password is required when basic auth is enabled.");
    }
    handle.push(authHandler(input.auth.username || "admin", hash));
  }

  switch (input.kind) {
    case "reverse_proxy": {
      handle.push({
        handler: "reverse_proxy",
        upstreams: input.upstreams.map((dial) => ({ dial })),
      });
      break;
    }
    case "file_server":
    case "filemanager": {
      handle.push(...fileServerHandler(input));
      break;
    }
    case "redirect": {
      handle.push({
        handler: "static_response",
        status_code: input.redirectCode,
        headers: { Location: [input.redirectTo] },
      });
      break;
    }
    case "respond": {
      handle.push({
        handler: "static_response",
        status_code: input.respondStatus,
        ...(input.respondBody
          ? {
              body: input.respondBody,
              headers: {
                "Content-Type": [
                  input.respondBody.trimStart().startsWith("<")
                    ? "text/html; charset=utf-8"
                    : "text/plain; charset=utf-8",
                ],
              },
            }
          : {}),
      });
      break;
    }
    case "custom": {
      const parsed = JSON.parse(input.customHandlers) as CaddyHandler[];
      handle.push(...parsed);
      break;
    }
  }

  const matcher: CaddyMatcher = {};
  if (input.hosts.length > 0) matcher.host = input.hosts;
  const path = normalizePath(input.path);
  if (path) matcher.path = [path];

  return {
    "@id": `${SITE_ID_PREFIX}${options.id}`,
    ...(Object.keys(matcher).length > 0 ? { match: [matcher] } : {}),
    handle,
    terminal: true,
  };
}

/** Finds the bcrypt hash of the first basic-auth account in a route. */
export function findAuthHash(route: CaddyRoute): string | undefined {
  const walk = (handlers: CaddyHandler[] | undefined): string | undefined => {
    for (const handler of handlers ?? []) {
      if (handler.handler === "authentication") {
        const providers = handler.providers as
          | Record<string, { accounts?: { password?: string }[] }>
          | undefined;
        const hash = providers?.http_basic?.accounts?.[0]?.password;
        if (typeof hash === "string") return hash;
      }

      if (handler.handler === "subroute" && Array.isArray(handler.routes)) {
        for (const nested of handler.routes as CaddyRoute[]) {
          const hash = walk(nested.handle);
          if (hash) return hash;
        }
      }
    }
    return undefined;
  };

  return walk(route.handle);
}
