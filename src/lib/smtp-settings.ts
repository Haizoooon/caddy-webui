import { getSetting, setSetting } from "./db";
import { decryptSecret, encryptSecret } from "./secrets";

export type SmtpSecurity = "none" | "starttls" | "tls";
export type SmtpSource = "database" | "env" | "none";

export interface SmtpSettings {
  enabled: boolean;
  host: string;
  port: number;
  security: SmtpSecurity;
  username: string;
  password?: string;
  fromEmail: string;
  fromName: string;
  replyTo?: string;
  rejectUnauthorized: boolean;
  source: SmtpSource;
}

export interface SmtpSummary {
  enabled: boolean;
  host: string;
  port: number;
  security: SmtpSecurity;
  username: string;
  fromEmail: string;
  fromName: string;
  replyTo?: string;
  rejectUnauthorized: boolean;
  source: SmtpSource;
  hasPassword: boolean;
}

export interface SmtpSettingsInput {
  enabled: boolean;
  host: string;
  port: number;
  security: SmtpSecurity;
  username: string;
  password?: string;
  fromEmail: string;
  fromName: string;
  replyTo?: string;
  rejectUnauthorized: boolean;
}

interface StoredSmtpSettings {
  enabled: boolean;
  host: string;
  port: number;
  security: SmtpSecurity;
  username: string;
  passwordEncrypted: string | null;
  fromEmail: string;
  fromName: string;
  replyTo?: string;
  rejectUnauthorized: boolean;
}

const SETTING_KEY = "smtp";

function envSecurity(value: string | undefined): SmtpSecurity {
  const normalized = value?.trim().toLowerCase();
  if (normalized === "tls" || normalized === "ssl") return "tls";
  if (normalized === "none" || normalized === "plain") return "none";
  return "starttls";
}

function envSettings(): SmtpSettings {
  const host = process.env.SMTP_HOST?.trim() || "";
  const fromEmail = process.env.SMTP_FROM_EMAIL?.trim() || "";

  return {
    enabled: Boolean(host && fromEmail),
    host,
    port: Number(process.env.SMTP_PORT || 587),
    security: envSecurity(process.env.SMTP_SECURITY),
    username: process.env.SMTP_USER?.trim() || "",
    password: process.env.SMTP_PASSWORD || undefined,
    fromEmail,
    fromName: process.env.SMTP_FROM_NAME?.trim() || "CaddyWeb",
    replyTo: process.env.SMTP_REPLY_TO?.trim() || undefined,
    rejectUnauthorized:
      process.env.SMTP_REJECT_UNAUTHORIZED?.trim().toLowerCase() !== "false",
    source: host && fromEmail ? "env" : "none",
  };
}

function fromStored(stored: StoredSmtpSettings): SmtpSettings {
  return {
    enabled: Boolean(stored.enabled),
    host: stored.host ?? "",
    port: Number(stored.port || 587),
    security:
      stored.security === "tls" || stored.security === "none"
        ? stored.security
        : "starttls",
    username: stored.username ?? "",
    password: decryptSecret(stored.passwordEncrypted) ?? undefined,
    fromEmail: stored.fromEmail ?? "",
    fromName: stored.fromName || "CaddyWeb",
    replyTo: stored.replyTo || undefined,
    rejectUnauthorized: stored.rejectUnauthorized !== false,
    source: "database",
  };
}

export async function getSmtpSettings(): Promise<SmtpSettings> {
  try {
    const raw = await getSetting(SETTING_KEY);
    if (raw) return fromStored(JSON.parse(raw) as StoredSmtpSettings);
  } catch {
    // Fall back to environment configuration.
  }
  return envSettings();
}

export async function saveSmtpSettings(
  input: SmtpSettingsInput,
): Promise<SmtpSummary> {
  const current = await getSmtpSettings();
  const password =
    input.password && input.password.trim() ? input.password : current.password;

  const stored: StoredSmtpSettings = {
    enabled: input.enabled,
    host: input.host.trim(),
    port: input.port,
    security: input.security,
    username: input.username.trim(),
    passwordEncrypted: password ? encryptSecret(password) : null,
    fromEmail: input.fromEmail.trim(),
    fromName: input.fromName.trim() || "CaddyWeb",
    replyTo: input.replyTo?.trim() || undefined,
    rejectUnauthorized: input.rejectUnauthorized,
  };

  await setSetting(SETTING_KEY, JSON.stringify(stored));
  return summarizeSmtp(fromStored(stored));
}

export function summarizeSmtp(settings: SmtpSettings): SmtpSummary {
  return {
    enabled: settings.enabled,
    host: settings.host,
    port: settings.port,
    security: settings.security,
    username: settings.username,
    fromEmail: settings.fromEmail,
    fromName: settings.fromName,
    replyTo: settings.replyTo,
    rejectUnauthorized: settings.rejectUnauthorized,
    source: settings.source,
    hasPassword: Boolean(settings.password),
  };
}

export async function getSmtpSummary(): Promise<SmtpSummary> {
  return summarizeSmtp(await getSmtpSettings());
}
