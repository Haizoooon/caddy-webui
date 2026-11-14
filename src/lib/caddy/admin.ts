import { CaddyError } from "./errors";
import type {
  CaddyConfig,
  CaddyUpstream,
  CaddyWarning,
  LocalCaInfo,
} from "./types";

const DEFAULT_ADMIN_URL = "http://localhost:2019";

export function adminBaseUrl(): string {
  return (process.env.CADDY_ADMIN_URL || DEFAULT_ADMIN_URL).replace(/\/+$/, "");
}

export function publicAdminUrl(): string {
  try {
    const url = new URL(adminBaseUrl());
    return `${url.protocol}//${url.host}`;
  } catch {
    return adminBaseUrl();
  }
}

function adminHeaders(extra: Record<string, string> = {}): Record<string, string> {
  const headers: Record<string, string> = { ...extra };
  const user = process.env.CADDY_ADMIN_USER;
  const password = process.env.CADDY_ADMIN_PASSWORD;

  if (user) {
    headers.Authorization = `Basic ${Buffer.from(`${user}:${password ?? ""}`).toString("base64")}`;
  }

  return headers;
}

interface AdminResponse {
  status: number;
  headers: Headers;
  text: string;
}

function parseErrorBody(body: unknown, fallback: string): string {
  if (typeof body === "string" && body.trim()) return body.trim().slice(0, 600);
  if (body && typeof body === "object") {
    const record = body as Record<string, unknown>;
    if (typeof record.error === "string") return record.error;
    if (typeof record.message === "string") return record.message;
  }
  return fallback;
}

async function adminFetch(
  path: string,
  init: RequestInit = {},
  timeoutMs = 8000,
): Promise<AdminResponse> {
  const base = adminBaseUrl();
  const url = `${base}${path.startsWith("/") ? path : `/${path}`}`;

  try {
    const response = await fetch(url, {
      ...init,
      cache: "no-store",
      signal: AbortSignal.timeout(timeoutMs),
      headers: adminHeaders({
        Accept: "application/json",
        ...(init.headers as Record<string, string> | undefined),
      }),
    });

    const text = await response.text();

    if (!response.ok) {
      let body: unknown = text;
      try {
        body = text ? JSON.parse(text) : text;
      } catch {
        // keep raw text
      }
      const warnings =
        body && typeof body === "object"
          ? ((body as { warnings?: CaddyWarning[] }).warnings ?? [])
          : [];
      throw new CaddyError(
        parseErrorBody(body, `Caddy responded with HTTP ${response.status}.`),
        response.status,
        warnings,
      );
    }

    return { status: response.status, headers: response.headers, text };
  } catch (error) {
    if (error instanceof CaddyError) throw error;

    if (error instanceof Error && error.name === "TimeoutError") {
      throw new CaddyError(
        `The Caddy Admin API at ${publicAdminUrl()} did not respond in time.`,
        504,
      );
    }

    throw new CaddyError(
      `Cannot reach the Caddy Admin API at ${publicAdminUrl()}. Is Caddy running with its admin endpoint enabled?`,
      502,
    );
  }
}

function parseJson<T>(text: string, fallback: T): T {
  if (!text.trim()) return fallback;
  try {
    return JSON.parse(text) as T;
  } catch {
    return fallback;
  }
}

export async function getConfigWithEtag(): Promise<{
  config: CaddyConfig;
  etag: string | null;
}> {
  const response = await adminFetch("/config/");
  return {
    config: parseJson<CaddyConfig>(response.text, {}),
    etag: response.headers.get("etag"),
  };
}

export async function getConfig(): Promise<CaddyConfig> {
  const { config } = await getConfigWithEtag();
  return config;
}

export async function loadConfig(config: CaddyConfig): Promise<CaddyWarning[]> {
  const response = await adminFetch("/load", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(config),
  });

  const body = parseJson<{ warnings?: CaddyWarning[] }>(response.text, {});
  return body.warnings ?? [];
}

/**
 * Read-modify-write helper with optimistic concurrency detection.
 * Caddy's /load endpoint has no If-Match support, so the config is re-read
 * before applying and the write is retried when it changed in the meantime.
 */
export async function mutateConfig<T>(
  mutator: (config: CaddyConfig) => T | Promise<T>,
): Promise<{ result: T; config: CaddyConfig; warnings: CaddyWarning[] }> {
  let lastError: unknown;

  for (let attempt = 0; attempt < 3; attempt += 1) {
    const { config, etag } = await getConfigWithEtag();
    const result = await mutator(config);

    if (etag && attempt < 2) {
      const current = await getConfigWithEtag();
      if (current.etag !== etag) {
        lastError = new CaddyError(
          "Caddy's configuration changed while saving. Please try again.",
          409,
        );
        continue;
      }
    }

    const warnings = await loadConfig(config);
    return { result, config, warnings };
  }

  throw lastError instanceof Error
    ? lastError
    : new CaddyError("Could not apply the configuration safely.", 409);
}

export async function adaptCaddyfile(caddyfile: string): Promise<unknown> {
  const response = await adminFetch(
    "/adapt",
    {
      method: "POST",
      headers: { "Content-Type": "text/caddyfile" },
      body: caddyfile,
    },
    15000,
  );

  return parseJson<unknown>(response.text, {});
}

export async function getUpstreams(): Promise<CaddyUpstream[]> {
  try {
    const response = await adminFetch("/reverse_proxy/upstreams");
    const upstreams = parseJson<CaddyUpstream[]>(response.text, []);
    return Array.isArray(upstreams) ? upstreams : [];
  } catch (error) {
    if (error instanceof CaddyError && error.status === 404) return [];
    throw error;
  }
}

export async function getLocalCa(): Promise<LocalCaInfo | null> {
  try {
    const response = await adminFetch("/pki/ca/local");
    return parseJson<LocalCaInfo | null>(response.text, null);
  } catch (error) {
    if (error instanceof CaddyError && (error.status === 404 || error.status === 400)) {
      return null;
    }
    throw error;
  }
}

export async function getLocalCaCertificates(): Promise<string> {
  const response = await adminFetch("/pki/ca/local/certificates");
  return response.text;
}
