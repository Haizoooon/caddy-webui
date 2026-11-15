import { createHash, randomBytes, timingSafeEqual } from "node:crypto";
import { createRemoteJWKSet, jwtVerify, type JWTPayload } from "jose";

export type OAuthErrorCode =
  | "config"
  | "discovery"
  | "state"
  | "token"
  | "identity"
  | "forbidden";

export class OAuthError extends Error {
  code: OAuthErrorCode;

  constructor(code: OAuthErrorCode, message?: string) {
    super(message ?? code);
    this.name = "OAuthError";
    this.code = code;
  }
}

export interface OidcConfig {
  issuer: string;
  clientId: string;
  clientSecret?: string;
  scopes: string;
  providerName: string;
  allowedUsers: string[];
  allowedGroups: string[];
  redirectUri?: string;
  tokenAuthMethod: "basic" | "post";
}

export interface OidcDiscovery {
  issuer: string;
  authorization_endpoint: string;
  token_endpoint: string;
  jwks_uri: string;
  userinfo_endpoint?: string;
  id_token_signing_alg_values_supported?: string[];
}

export interface OidcIdentity {
  subject: string;
  username: string;
  email?: string;
  groups: string[];
}

function list(value: string | undefined): string[] {
  return (value ?? "")
    .split(/[\s,]+/)
    .map((entry) => entry.trim())
    .filter(Boolean);
}

export function oidcConfig(): OidcConfig | null {
  const issuer = process.env.OIDC_ISSUER_URL?.trim();
  const clientId = process.env.OIDC_CLIENT_ID?.trim();
  if (!issuer || !clientId) return null;

  const clientSecret = process.env.OIDC_CLIENT_SECRET;
  const redirectUri = process.env.OIDC_REDIRECT_URI?.trim();

  return {
    issuer,
    clientId,
    clientSecret: clientSecret ? clientSecret : undefined,
    scopes: process.env.OIDC_SCOPES?.trim() || "openid profile email",
    providerName: process.env.OIDC_PROVIDER_NAME?.trim() || "SSO",
    allowedUsers: list(process.env.OIDC_ALLOWED_USERS),
    allowedGroups: list(process.env.OIDC_ALLOWED_GROUPS),
    redirectUri: redirectUri || undefined,
    tokenAuthMethod:
      process.env.OIDC_TOKEN_AUTH_METHOD?.trim().toLowerCase() === "post"
        ? "post"
        : "basic",
  };
}

export function isOAuthConfigured(): boolean {
  return oidcConfig() !== null;
}

export function oidcProviderName(): string {
  return process.env.OIDC_PROVIDER_NAME?.trim() || "SSO";
}

export function oidcIssuer(): string {
  return process.env.OIDC_ISSUER_URL?.trim() || "";
}

export function oauthAllowedUsers(): string[] {
  return list(process.env.OIDC_ALLOWED_USERS);
}

export function oauthAllowedGroups(): string[] {
  return list(process.env.OIDC_ALLOWED_GROUPS);
}

export function oauthBaseUrl(request: Request): string {
  const configured = process.env.APP_URL?.trim();
  if (configured) return configured.replace(/\/+$/, "");

  const url = new URL(request.url);
  const proto = request.headers.get("x-forwarded-proto")?.split(",")[0].trim() ||
    url.protocol.replace(":", "");
  const host =
    request.headers.get("x-forwarded-host")?.split(",")[0].trim() ||
    request.headers.get("host") ||
    url.host;

  return `${proto}://${host}`;
}

export function oauthRedirectUri(request: Request, config: OidcConfig): string {
  return config.redirectUri || `${oauthBaseUrl(request)}/api/auth/oauth/callback`;
}

let discoveryCache:
  | { key: string; expiresAt: number; value: OidcDiscovery }
  | null = null;

export async function getOidcDiscovery(config: OidcConfig): Promise<OidcDiscovery> {
  const normalized = config.issuer.endsWith("/") ? config.issuer : `${config.issuer}/`;
  const url = `${normalized}.well-known/openid-configuration`;

  if (
    discoveryCache &&
    discoveryCache.key === url &&
    discoveryCache.expiresAt > Date.now()
  ) {
    return discoveryCache.value;
  }

  try {
    const response = await fetch(url, {
      headers: { Accept: "application/json" },
      cache: "no-store",
      signal: AbortSignal.timeout(8000),
    });

    if (!response.ok) throw new Error(`discovery returned HTTP ${response.status}`);

    const document = (await response.json()) as Partial<OidcDiscovery>;

    const valid =
      typeof document.issuer === "string" &&
      typeof document.authorization_endpoint === "string" &&
      typeof document.token_endpoint === "string" &&
      typeof document.jwks_uri === "string" &&
      [document.authorization_endpoint, document.token_endpoint, document.jwks_uri].every(
        (endpoint) => /^https?:\/\//.test(endpoint),
      );

    if (!valid) throw new Error("discovery document is missing required endpoints");

    const value = document as OidcDiscovery;
    discoveryCache = { key: url, expiresAt: Date.now() + 60 * 60 * 1000, value };
    return value;
  } catch {
    throw new OAuthError("discovery", "Could not load the OIDC discovery document.");
  }
}

export function createPkce(): { verifier: string; challenge: string } {
  const verifier = randomBytes(32).toString("base64url");
  const challenge = createHash("sha256").update(verifier).digest("base64url");
  return { verifier, challenge };
}

export function randomToken(bytes = 32): string {
  return randomBytes(bytes).toString("base64url");
}

export function authorizationUrl(
  discovery: OidcDiscovery,
  config: OidcConfig,
  params: {
    redirectUri: string;
    state: string;
    nonce: string;
    challenge: string;
  },
): URL {
  const url = new URL(discovery.authorization_endpoint);
  url.searchParams.set("response_type", "code");
  url.searchParams.set("client_id", config.clientId);
  url.searchParams.set("redirect_uri", params.redirectUri);
  url.searchParams.set("scope", config.scopes);
  url.searchParams.set("state", params.state);
  url.searchParams.set("nonce", params.nonce);
  url.searchParams.set("code_challenge", params.challenge);
  url.searchParams.set("code_challenge_method", "S256");
  return url;
}

export async function exchangeCode(
  discovery: OidcDiscovery,
  config: OidcConfig,
  params: { code: string; verifier: string; redirectUri: string },
): Promise<{ idToken: string }> {
  const body = new URLSearchParams({
    grant_type: "authorization_code",
    code: params.code,
    redirect_uri: params.redirectUri,
    client_id: config.clientId,
    code_verifier: params.verifier,
  });

  const headers: Record<string, string> = {
    Accept: "application/json",
    "Content-Type": "application/x-www-form-urlencoded",
  };

  if (config.clientSecret) {
    if (config.tokenAuthMethod === "post") {
      body.set("client_secret", config.clientSecret);
    } else {
      headers.Authorization = `Basic ${Buffer.from(
        `${config.clientId}:${config.clientSecret}`,
      ).toString("base64")}`;
    }
  }

  let data: Record<string, unknown> | null = null;

  try {
    const response = await fetch(discovery.token_endpoint, {
      method: "POST",
      headers,
      body,
      cache: "no-store",
      signal: AbortSignal.timeout(10000),
    });

    data = (await response.json().catch(() => null)) as Record<string, unknown> | null;
    if (!response.ok) {
      throw new OAuthError("token", "The identity provider rejected the token request.");
    }
  } catch (error) {
    if (error instanceof OAuthError) throw error;
    throw new OAuthError("token", "Could not reach the identity provider token endpoint.");
  }

  if (!data || typeof data.id_token !== "string") {
    throw new OAuthError("token", "The identity provider did not return an ID token.");
  }

  return { idToken: data.id_token };
}

const jwksCache = new Map<string, ReturnType<typeof createRemoteJWKSet>>();

function jwksFor(uri: string) {
  const existing = jwksCache.get(uri);
  if (existing) return existing;
  const jwks = createRemoteJWKSet(new URL(uri));
  jwksCache.set(uri, jwks);
  return jwks;
}

function firstString(...values: unknown[]): string | undefined {
  for (const value of values) {
    if (typeof value === "string" && value.trim()) return value.trim();
  }
  return undefined;
}

function stringArray(value: unknown): string[] {
  if (Array.isArray(value)) {
    return value.filter((entry): entry is string => typeof entry === "string");
  }
  if (typeof value === "string") {
    return value.split(/[\s,]+/).filter(Boolean);
  }
  return [];
}

export async function verifyIdToken(
  discovery: OidcDiscovery,
  config: OidcConfig,
  idToken: string,
  expectedNonce: string,
): Promise<OidcIdentity> {
  let payload: JWTPayload;

  try {
    const result = await jwtVerify(idToken, jwksFor(discovery.jwks_uri), {
      issuer: discovery.issuer,
      audience: config.clientId,
      clockTolerance: 60,
    });
    payload = result.payload;
  } catch {
    throw new OAuthError("identity", "The ID token could not be verified.");
  }

  if (typeof payload.nonce !== "string" || payload.nonce !== expectedNonce) {
    throw new OAuthError("identity", "The ID token nonce does not match.");
  }

  if (typeof payload.sub !== "string" || !payload.sub) {
    throw new OAuthError("identity", "The ID token is missing a subject.");
  }

  const email = typeof payload.email === "string" ? payload.email : undefined;
  const username = firstString(
    payload.preferred_username,
    payload.email,
    payload.name,
    payload.sub,
  );

  return {
    subject: payload.sub,
    username: (username ?? payload.sub).slice(0, 200),
    email,
    groups: stringArray(payload.groups),
  };
}

export function assertOAuthAccess(identity: OidcIdentity, config: OidcConfig): void {
  if (config.allowedUsers.length === 0 && config.allowedGroups.length === 0) return;

  const candidates = [identity.subject, identity.username, identity.email]
    .filter((value): value is string => Boolean(value))
    .map((value) => value.toLowerCase());

  const userAllowed =
    config.allowedUsers.length > 0 &&
    config.allowedUsers.some((user) => candidates.includes(user.toLowerCase()));

  const groupAllowed =
    config.allowedGroups.length > 0 &&
    config.allowedGroups.some((group) => identity.groups.includes(group));

  if (!userAllowed && !groupAllowed) {
    throw new OAuthError("forbidden", "This account is not allowed to use the panel.");
  }
}

export function statesMatch(expected: string, actual: string): boolean {
  const a = Buffer.from(expected);
  const b = Buffer.from(actual);
  if (a.length !== b.length || a.length === 0) return false;
  return timingSafeEqual(a, b);
}
