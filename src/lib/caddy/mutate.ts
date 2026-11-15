import { CaddyError } from "./errors";
import type {
  CaddyConfig,
  CaddyRoute,
  CaddyServer,
  CaddyTlsPolicy,
} from "./types";
import type { TlsMode } from "./schema";
import { routeHosts } from "./parse";
import type { RouteRef } from "./ref";

export interface FoundRoute {
  serverName: string;
  server: CaddyServer;
  index: number;
  route: CaddyRoute;
}

function httpServers(config: CaddyConfig): Record<string, CaddyServer> {
  if (!config.apps) config.apps = {};
  if (!config.apps.http) config.apps.http = {};
  if (!config.apps.http.servers) config.apps.http.servers = {};
  return config.apps.http.servers;
}

function envPort(name: string, fallback: string): string {
  return (process.env[name] || fallback).replace(/^:/, "");
}

/**
 * When CaddyWeb runs Caddy on non-default HTTP/HTTPS ports, Caddy also needs
 * to know those ports globally. Without this, automatic HTTPS would treat the
 * custom listeners as neither HTTP nor HTTPS. Existing explicit settings win.
 */
function ensureCustomPorts(config: CaddyConfig): void {
  const httpPort = Number(envPort("CADDY_HTTP_PORT", "80"));
  const httpsPort = Number(envPort("CADDY_HTTPS_PORT", "443"));

  if (!config.apps) config.apps = {};
  if (!config.apps.http) config.apps.http = {};

  const http = config.apps.http;
  if (httpPort !== 80 && http.http_port === undefined) http.http_port = httpPort;
  if (httpsPort !== 443 && http.https_port === undefined) http.https_port = httpsPort;
}

function hasPort(server: CaddyServer, port: string): boolean {
  return (server.listen ?? []).some((listen) => listen.endsWith(`:${port}`));
}

/**
 * A server is HTTP-only when it listens on the HTTP port and not on the HTTPS
 * port. Routes on such a server are served without a certificate.
 */
export function isHttpOnlyServer(
  server: CaddyServer,
  httpPort = envPort("CADDY_HTTP_PORT", "80"),
  httpsPort = envPort("CADDY_HTTPS_PORT", "443"),
): boolean {
  if ((server.listen ?? []).length === 0) return false;
  return hasPort(server, httpPort) && !hasPort(server, httpsPort);
}

/**
 * Picks the server that terminates TLS, or creates one. The Caddy admin API
 * is only reachable server-side, so reading the port from env here is safe.
 */
export function ensureServer(
  config: CaddyConfig,
  preferredName?: string,
): { name: string; server: CaddyServer } {
  const servers = httpServers(config);
  const httpsPort = envPort("CADDY_HTTPS_PORT", "443");
  const httpPort = envPort("CADDY_HTTP_PORT", "80");

  ensureCustomPorts(config);

  if (
    preferredName &&
    servers[preferredName] &&
    !isHttpOnlyServer(servers[preferredName], httpPort, httpsPort)
  ) {
    return { name: preferredName, server: servers[preferredName] };
  }

  for (const [name, server] of Object.entries(servers)) {
    if (hasPort(server, httpsPort)) {
      return { name, server };
    }
  }

  let name = "srv0";
  let counter = 1;
  while (servers[name]) {
    name = `srv${counter++}`;
  }

  servers[name] = {
    listen: [`:${httpsPort}`],
    routes: [],
  };

  return { name, server: servers[name] };
}

/**
 * Picks (or creates) a plain-HTTP server for sites that should not have a
 * certificate. Caddy automatically disables automatic HTTPS for servers that
 * listen only on the HTTP port, so no certificate is requested; the same
 * server is still used for redirects of TLS-enabled hosts.
 */
export function ensureHttpServer(
  config: CaddyConfig,
  preferredName?: string,
): { name: string; server: CaddyServer } {
  const servers = httpServers(config);
  const httpPort = envPort("CADDY_HTTP_PORT", "80");
  const httpsPort = envPort("CADDY_HTTPS_PORT", "443");

  ensureCustomPorts(config);

  if (preferredName) {
    const preferred = servers[preferredName];
    if (preferred && isHttpOnlyServer(preferred, httpPort, httpsPort)) {
      return { name: preferredName, server: preferred };
    }
  }

  for (const [name, server] of Object.entries(servers)) {
    if (isHttpOnlyServer(server, httpPort, httpsPort)) {
      return { name, server };
    }
  }

  let name = "srv_http";
  let counter = 2;
  while (servers[name]) {
    name = `srv_http${counter++}`;
  }

  servers[name] = {
    listen: [`:${httpPort}`],
    routes: [],
  };

  return { name, server: servers[name] };
}

export function insertRoute(server: CaddyServer, route: CaddyRoute): number {
  if (!server.routes) server.routes = [];

  const catchAll = server.routes.findIndex((existing) => routeHosts(existing).length === 0);
  if (catchAll === -1) {
    server.routes.push(route);
    return server.routes.length - 1;
  }

  server.routes.splice(catchAll, 0, route);
  return catchAll;
}

export function findRoute(config: CaddyConfig, ref: RouteRef): FoundRoute | null {
  const servers = config.apps?.http?.servers ?? {};

  if (ref.id) {
    for (const [serverName, server] of Object.entries(servers)) {
      const index = (server.routes ?? []).findIndex((route) => route["@id"] === ref.id);
      if (index !== -1) {
        return {
          serverName,
          server,
          index,
          route: (server.routes ?? [])[index],
        };
      }
    }
    return null;
  }

  const server = servers[ref.server];
  if (!server || !Array.isArray(server.routes)) return null;
  if (ref.index < 0 || ref.index >= server.routes.length) return null;

  return {
    serverName: ref.server,
    server,
    index: ref.index,
    route: server.routes[ref.index],
  };
}

export function ensureNoDuplicateHost(
  config: CaddyConfig,
  hosts: string[],
  excludeRoute?: CaddyRoute,
): void {
  const wanted = hosts.map((host) => host.toLowerCase());
  const servers = config.apps?.http?.servers ?? {};

  for (const server of Object.values(servers)) {
    for (const route of server.routes ?? []) {
      if (excludeRoute && route === excludeRoute) continue;
      const existing = routeHosts(route).map((host) => host.toLowerCase());
      const clash = existing.find((host) => wanted.includes(host));
      if (clash) {
        throw new CaddyError(`The host "${clash}" is already used by another site.`, 409);
      }
    }
  }
}

function tlsPolicies(config: CaddyConfig): CaddyTlsPolicy[] {
  if (!config.apps) config.apps = {};
  if (!config.apps.tls) config.apps.tls = {};
  if (!config.apps.tls.automation) config.apps.tls.automation = {};
  if (!config.apps.tls.automation.policies) config.apps.tls.automation.policies = [];
  return config.apps.tls.automation.policies;
}

/**
 * Keeps the internal-CA automation policies in sync with the site hosts.
 * "auto" removes any internal issuer policy for these hosts and lets Caddy
 * use public ACME issuers instead.
 */
export function applyTlsPolicy(config: CaddyConfig, hosts: string[], mode: TlsMode): void {
  if (hosts.length === 0) return;

  const existing = config.apps?.tls?.automation?.policies;
  if (mode !== "internal" && (!existing || existing.length === 0)) {
    // Nothing to remove; avoid creating an empty TLS app in the config.
    return;
  }

  const policies = tlsPolicies(config);
  const wanted = hosts.map((host) => host.toLowerCase());

  for (const policy of policies) {
    if (!policy.subjects) continue;
    const isInternal = (policy.issuers ?? []).some((issuer) => issuer.module === "internal");
    if (!isInternal) continue;
    policy.subjects = policy.subjects.filter(
      (subject) => !wanted.includes(subject.toLowerCase()),
    );
  }

  for (let index = policies.length - 1; index >= 0; index -= 1) {
    if (policies[index].subjects && policies[index].subjects?.length === 0) {
      policies.splice(index, 1);
    }
  }

  if (mode === "internal") {
    for (const host of hosts) {
      policies.push({
        subjects: [host],
        issuers: [{ module: "internal" }],
      });
    }
  }
}
