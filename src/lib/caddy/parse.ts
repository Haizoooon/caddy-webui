import type {
  CaddyConfig,
  CaddyHandler,
  CaddyRoute,
  CaddyServer,
  CaddyTlsPolicy,
  SiteServerSummary,
} from "./types";
import type { SiteInput, SiteKind, TlsMode } from "./schema";
import { emptySiteInput } from "./schema";
import { encodeRef, managedId, SITE_ID_PREFIX } from "./ref";

export interface ParsedSite {
  ref: string;
  routeId?: string;
  managed: boolean;
  server: string;
  index: number;
  kind: SiteKind;
  hosts: string[];
  paths: string[];
  tls: TlsMode;
  target: string;
  upstreams: string[];
  root: string;
  browse: boolean;
  spaFallback: boolean;
  redirectTo: string;
  redirectCode: number;
  respondStatus: number;
  respondBody: string;
  encode: boolean;
  auth: boolean;
  authUser: string;
  handlerNames: string[];
  terminal: boolean;
}

export function collectHandlers(route: CaddyRoute): CaddyHandler[] {
  const result: CaddyHandler[] = [];

  const walk = (handlers: CaddyHandler[] | undefined) => {
    for (const handler of handlers ?? []) {
      result.push(handler);
      if (handler.handler === "subroute" && Array.isArray(handler.routes)) {
        for (const nested of handler.routes as CaddyRoute[]) {
          walk(nested.handle);
        }
      }
    }
  };

  walk(route.handle);
  return result;
}

export function routeHosts(route: CaddyRoute): string[] {
  const hosts = new Set<string>();
  for (const matcher of route.match ?? []) {
    for (const host of matcher.host ?? []) hosts.add(host);
  }
  return Array.from(hosts);
}

export function routePaths(route: CaddyRoute): string[] {
  const paths = new Set<string>();
  for (const matcher of route.match ?? []) {
    for (const path of matcher.path ?? []) paths.add(path);
  }
  return Array.from(paths);
}

function tlsModeFor(config: CaddyConfig, hosts: string[]): TlsMode {
  const policies = config.apps?.tls?.automation?.policies ?? [];
  const hasInternal = policies.some(
    (policy) =>
      (policy.issuers ?? []).some((issuer) => issuer.module === "internal") &&
      hosts.some((host) => (policy.subjects ?? []).includes(host)),
  );
  return hasInternal ? "internal" : "auto";
}

function headerValue(handler: CaddyHandler, name: string): string {
  const headers = handler.headers as Record<string, unknown> | undefined;
  if (!headers) return "";
  const value = headers[name] ?? headers[name.toLowerCase()];
  if (Array.isArray(value)) return String(value[0] ?? "");
  if (typeof value === "string") return value;
  return "";
}

function classify(
  handlers: CaddyHandler[],
  hasBrowse: boolean,
  hasAuth: boolean,
): SiteKind {
  if (handlers.some((handler) => handler.handler === "reverse_proxy")) return "reverse_proxy";
  if (handlers.some((handler) => handler.handler === "filemanager")) return "filemanager";
  if (handlers.some((handler) => handler.handler === "file_server")) {
    return hasBrowse && hasAuth ? "filemanager" : "file_server";
  }
  if (handlers.some((handler) => handler.handler === "static_response")) {
    const staticResponse = handlers.find((handler) => handler.handler === "static_response");
    if (staticResponse && headerValue(staticResponse, "Location")) return "redirect";
    return "respond";
  }
  return "custom";
}

export function parseSite(
  config: CaddyConfig,
  serverName: string,
  server: CaddyServer,
  index: number,
): ParsedSite {
  const routes = server.routes ?? [];
  const route = routes[index] ?? {};
  const handlers = collectHandlers(route);
  const hosts = routeHosts(route);

  const proxied = handlers.find((handler) => handler.handler === "reverse_proxy");
  const upstreams = Array.isArray(proxied?.upstreams)
    ? (proxied?.upstreams as { dial?: string }[])
        .map((upstream) => upstream.dial)
        .filter((dial): dial is string => typeof dial === "string")
    : [];

  const fileHandler = handlers.find((handler) => handler.handler === "file_server");
  const staticResponse = handlers.find((handler) => handler.handler === "static_response");
  const authHandler = handlers.find((handler) => handler.handler === "authentication");
  const authProviders = authHandler?.providers as
    | Record<string, { accounts?: { username?: string }[] }>
    | undefined;
  const authUser = authProviders?.http_basic?.accounts?.[0]?.username ?? "";

  const browse = Boolean(
    fileHandler && Object.prototype.hasOwnProperty.call(fileHandler, "browse"),
  );
  const hasAuth = Boolean(authHandler);
  const kind = classify(handlers, browse, hasAuth);

  const redirectTo = staticResponse ? headerValue(staticResponse, "Location") : "";
  const redirectCode =
    staticResponse && typeof staticResponse.status_code === "number"
      ? staticResponse.status_code
      : 302;
  const respondStatus =
    staticResponse && typeof staticResponse.status_code === "number"
      ? staticResponse.status_code
      : 200;
  const respondBody = typeof staticResponse?.body === "string" ? staticResponse.body : "";

  const root = typeof fileHandler?.root === "string" ? fileHandler.root : "";
  const handlerNames = handlers
    .map((handler) => handler.handler)
    .filter((name): name is string => typeof name === "string");

  const spaFallback = handlers.some(
    (handler) => handler.handler === "rewrite" && handler.uri === "/index.html",
  );

  let target = "Custom";
  if (kind === "reverse_proxy") target = upstreams.join(", ") || "No upstream";
  else if (kind === "file_server" || kind === "filemanager") target = root || "No root";
  else if (kind === "redirect") target = `${redirectCode} → ${redirectTo}`;
  else if (kind === "respond") target = `HTTP ${respondStatus}`;

  const routeId = typeof route["@id"] === "string" ? route["@id"] : undefined;
  const managed = Boolean(routeId && routeId.startsWith(SITE_ID_PREFIX));

  return {
    ref: encodeRef({ server: serverName, index, id: routeId }),
    routeId,
    managed,
    server: serverName,
    index,
    kind,
    hosts,
    paths: routePaths(route),
    tls: tlsModeFor(config, hosts),
    target,
    upstreams,
    root,
    browse,
    spaFallback,
    redirectTo,
    redirectCode: [301, 302, 307, 308].includes(redirectCode) ? redirectCode : 302,
    respondStatus,
    respondBody,
    encode: handlers.some((handler) => handler.handler === "encode"),
    auth: hasAuth,
    authUser,
    handlerNames,
    terminal: route.terminal === true,
  };
}

export function parseSites(config: CaddyConfig): ParsedSite[] {
  const servers = config.apps?.http?.servers ?? {};
  const sites: ParsedSite[] = [];

  for (const [serverName, server] of Object.entries(servers)) {
    (server.routes ?? []).forEach((_route, index) => {
      sites.push(parseSite(config, serverName, server, index));
    });
  }

  return sites.sort((a, b) => {
    const hostCompare = (a.hosts[0] ?? "").localeCompare(b.hosts[0] ?? "");
    if (hostCompare !== 0) return hostCompare;
    return a.index - b.index;
  });
}

export function describeServers(config: CaddyConfig): SiteServerSummary[] {
  const servers = config.apps?.http?.servers ?? {};
  return Object.entries(servers).map(([name, server]) => ({
    name,
    listen: server.listen ?? [],
    routes: (server.routes ?? []).length,
    automaticHttps: server.automatic_https !== undefined,
  }));
}

export function siteToInput(site: ParsedSite, route?: CaddyRoute): SiteInput {
  const input = emptySiteInput(site.kind);

  return {
    ...input,
    kind: site.kind,
    hosts: site.hosts,
    path: site.paths[0] ?? "",
    tls: site.tls,
    upstreams: site.upstreams.length ? site.upstreams : input.upstreams,
    root: site.root,
    browse: site.browse,
    spaFallback: site.spaFallback,
    redirectTo: site.redirectTo,
    redirectCode: site.redirectCode,
    respondStatus: site.respondStatus,
    respondBody: site.respondBody,
    encode: site.encode,
    auth: {
      enabled: site.auth,
      username: site.authUser || "admin",
      password: "",
    },
    customHandlers:
      site.kind === "custom" && route?.handle
        ? JSON.stringify(route.handle, null, 2)
        : "",
    serverName: site.server,
  };
}

export function tlsPolicies(config: CaddyConfig): CaddyTlsPolicy[] {
  return config.apps?.tls?.automation?.policies ?? [];
}

export function tlsPolicySummary(policy: CaddyTlsPolicy): string {
  return (policy.issuers ?? [])
    .map((issuer) => issuer.module ?? "unknown")
    .join(", ");
}
