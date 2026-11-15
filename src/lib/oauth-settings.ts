import { getSetting, setSetting } from "./db";
import { decryptSecret, encryptSecret } from "./secrets";

export type OAuthSource = "database" | "env" | "none";

export interface OAuthSettings {
  enabled: boolean;
  issuer: string;
  clientId: string;
  clientSecret?: string;
  providerName: string;
  scopes: string;
  allowedUsers: string[];
  allowedGroups: string[];
  tokenAuthMethod: "basic" | "post";
  defaultRole: "viewer" | "editor";
  autoProvision: boolean;
  redirectUri?: string;
  source: OAuthSource;
}

export interface OAuthSummary {
  enabled: boolean;
  issuer: string;
  clientId: string;
  providerName: string;
  scopes: string;
  allowedUsers: string[];
  allowedGroups: string[];
  tokenAuthMethod: "basic" | "post";
  defaultRole: "viewer" | "editor";
  autoProvision: boolean;
  redirectUri?: string;
  source: OAuthSource;
  hasSecret: boolean;
}

export interface OAuthSettingsInput {
  enabled: boolean;
  issuer: string;
  clientId: string;
  clientSecret?: string;
  providerName: string;
  scopes: string;
  allowedUsers: string[];
  allowedGroups: string[];
  tokenAuthMethod: "basic" | "post";
  defaultRole: "viewer" | "editor";
  autoProvision: boolean;
  redirectUri?: string;
}

interface StoredOAuthSettings {
  enabled: boolean;
  issuer: string;
  clientId: string;
  clientSecretEncrypted: string | null;
  providerName: string;
  scopes: string;
  allowedUsers: string[];
  allowedGroups: string[];
  tokenAuthMethod: "basic" | "post";
  defaultRole: "viewer" | "editor";
  autoProvision: boolean;
  redirectUri?: string;
}

const SETTING_KEY = "oauth";

function list(value: string | undefined): string[] {
  return (value ?? "")
    .split(/[\s,]+/)
    .map((entry) => entry.trim())
    .filter(Boolean);
}

function envSettings(): OAuthSettings {
  const issuer = process.env.OIDC_ISSUER_URL?.trim() || "";
  const clientId = process.env.OIDC_CLIENT_ID?.trim() || "";
  const secret = process.env.OIDC_CLIENT_SECRET;

  return {
    enabled: Boolean(issuer && clientId),
    issuer,
    clientId,
    clientSecret: secret ? secret : undefined,
    providerName: process.env.OIDC_PROVIDER_NAME?.trim() || "SSO",
    scopes: process.env.OIDC_SCOPES?.trim() || "openid profile email",
    allowedUsers: list(process.env.OIDC_ALLOWED_USERS),
    allowedGroups: list(process.env.OIDC_ALLOWED_GROUPS),
    tokenAuthMethod:
      process.env.OIDC_TOKEN_AUTH_METHOD?.trim().toLowerCase() === "post"
        ? "post"
        : "basic",
    defaultRole:
      process.env.OIDC_DEFAULT_ROLE?.trim().toLowerCase() === "editor"
        ? "editor"
        : "viewer",
    autoProvision: process.env.OIDC_AUTO_PROVISION?.trim().toLowerCase() !== "false",
    redirectUri: process.env.OIDC_REDIRECT_URI?.trim() || undefined,
    source: issuer && clientId ? "env" : "none",
  };
}

function fromStored(stored: StoredOAuthSettings): OAuthSettings {
  return {
    enabled: Boolean(stored.enabled),
    issuer: stored.issuer ?? "",
    clientId: stored.clientId ?? "",
    clientSecret: decryptSecret(stored.clientSecretEncrypted) ?? undefined,
    providerName: stored.providerName || "SSO",
    scopes: stored.scopes || "openid profile email",
    allowedUsers: Array.isArray(stored.allowedUsers) ? stored.allowedUsers : [],
    allowedGroups: Array.isArray(stored.allowedGroups) ? stored.allowedGroups : [],
    tokenAuthMethod: stored.tokenAuthMethod === "post" ? "post" : "basic",
    defaultRole: stored.defaultRole === "editor" ? "editor" : "viewer",
    autoProvision: stored.autoProvision !== false,
    redirectUri: stored.redirectUri || undefined,
    source: "database",
  };
}

export function getOAuthSettings(): OAuthSettings {
  try {
    const raw = getSetting(SETTING_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as StoredOAuthSettings;
      return fromStored(parsed);
    }
  } catch {
    // Fall back to environment configuration if the database is unavailable.
  }

  return envSettings();
}

export function saveOAuthSettings(input: OAuthSettingsInput): OAuthSummary {
  const current = getOAuthSettings();
  const secret =
    input.clientSecret && input.clientSecret.trim()
      ? input.clientSecret.trim()
      : current.clientSecret;

  const stored: StoredOAuthSettings = {
    enabled: input.enabled,
    issuer: input.issuer.trim(),
    clientId: input.clientId.trim(),
    clientSecretEncrypted: secret ? encryptSecret(secret) : null,
    providerName: input.providerName.trim() || "SSO",
    scopes: input.scopes.trim() || "openid profile email",
    allowedUsers: input.allowedUsers,
    allowedGroups: input.allowedGroups,
    tokenAuthMethod: input.tokenAuthMethod,
    defaultRole: input.defaultRole,
    autoProvision: input.autoProvision,
    redirectUri: input.redirectUri?.trim() || undefined,
  };

  setSetting(SETTING_KEY, JSON.stringify(stored));
  return summarize(fromStored(stored));
}

export function summarize(settings: OAuthSettings): OAuthSummary {
  return {
    enabled: settings.enabled,
    issuer: settings.issuer,
    clientId: settings.clientId,
    providerName: settings.providerName,
    scopes: settings.scopes,
    allowedUsers: settings.allowedUsers,
    allowedGroups: settings.allowedGroups,
    tokenAuthMethod: settings.tokenAuthMethod,
    defaultRole: settings.defaultRole,
    autoProvision: settings.autoProvision,
    redirectUri: settings.redirectUri,
    source: settings.source,
    hasSecret: Boolean(settings.clientSecret),
  };
}

export function getOAuthSummary(): OAuthSummary {
  return summarize(getOAuthSettings());
}
