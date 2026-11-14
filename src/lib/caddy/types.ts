export interface CaddyMatcher {
  host?: string[];
  path?: string[];
  file?: { try_files?: string[]; try_policy?: string };
  [key: string]: unknown;
}

export interface CaddyHandler {
  handler?: string;
  routes?: CaddyRoute[];
  [key: string]: unknown;
}

export interface CaddyRoute {
  "@id"?: string;
  match?: CaddyMatcher[];
  handle?: CaddyHandler[];
  terminal?: boolean;
  [key: string]: unknown;
}

export interface CaddyServer {
  listen?: string[];
  routes?: CaddyRoute[];
  automatic_https?: Record<string, unknown>;
  [key: string]: unknown;
}

export interface CaddyTlsPolicy {
  subjects?: string[];
  issuers?: { module?: string; [key: string]: unknown }[];
  [key: string]: unknown;
}

export interface CaddyHttpApp {
  servers?: Record<string, CaddyServer>;
  [key: string]: unknown;
}

export interface CaddyTlsApp {
  automation?: {
    policies?: CaddyTlsPolicy[];
    [key: string]: unknown;
  };
  [key: string]: unknown;
}

export interface CaddyConfig {
  admin?: Record<string, unknown>;
  apps?: {
    http?: CaddyHttpApp;
    tls?: CaddyTlsApp;
    [key: string]: unknown;
  };
  [key: string]: unknown;
}

export interface CaddyUpstream {
  address: string;
  num_requests: number;
  fails: number;
}

export interface CaddyWarning {
  file?: string;
  line?: number;
  message?: string;
}

export interface LocalCaInfo {
  id: string;
  name?: string;
  root_common_name?: string;
  intermediate_common_name?: string;
  root_certificate?: string;
  intermediate_certificate?: string;
}

export interface SiteServerSummary {
  name: string;
  listen: string[];
  routes: number;
  automaticHttps: boolean;
}
