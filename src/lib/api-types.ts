import type { SiteKind, TlsMode, SiteInput } from "./caddy/schema";

export type { SiteKind, TlsMode, SiteInput };

export interface SiteSummary {
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

export interface ServerSummary {
  name: string;
  listen: string[];
  routes: number;
  automaticHttps: boolean;
}

export interface StatusResponse {
  ok: true;
  connected: boolean;
  adminUrl: string;
  latencyMs: number | null;
  error?: string;
  authEnabled: boolean;
  httpPort: string;
  httpsPort: string;
  version: string;
}

export interface SitesResponse {
  ok: true;
  sites: SiteSummary[];
  servers: ServerSummary[];
}

export interface UpstreamSummary {
  address: string;
  num_requests: number;
  fails: number;
}

export interface UpstreamsResponse {
  ok: true;
  upstreams: UpstreamSummary[];
}

export interface TlsPolicySummary {
  subjects: string[];
  issuers: string[];
}

export interface LocalCaSummary {
  name: string;
  rootCommonName: string;
  intermediateCommonName: string;
  rootCertificate: string;
}

export interface TlsResponse {
  ok: true;
  policies: TlsPolicySummary[];
  localCa: LocalCaSummary | null;
  certificates: string | null;
}

export interface ConfigResponse {
  ok: true;
  config: Record<string, unknown>;
  etag: string | null;
}

export interface AdaptResponse {
  ok: true;
  config: Record<string, unknown>;
  warnings: CaddyWarningSummary[];
}

export interface CaddyWarningSummary {
  file?: string;
  line?: number;
  message?: string;
}

export interface SiteResponse {
  ok: true;
  site: SiteSummary;
  warnings?: CaddyWarningSummary[];
}

export interface MutateResponse {
  ok: true;
  warnings?: CaddyWarningSummary[];
}
