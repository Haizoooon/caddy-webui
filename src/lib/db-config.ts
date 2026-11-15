import fs from "node:fs";
import path from "node:path";
import mysql from "mysql2/promise";
import { decryptSecret, encryptSecret } from "./secrets";

export type DbConfigSource = "env" | "file" | "none";

export interface DbConfig {
  host: string;
  port: number;
  database: string;
  user: string;
  password: string;
  ssl: boolean;
  sslRejectUnauthorized: boolean;
  source: DbConfigSource;
}

export interface DbConfigInput {
  host: string;
  port: number;
  database: string;
  user: string;
  password?: string;
  ssl: boolean;
  sslRejectUnauthorized: boolean;
}

export interface DbConfigSummary {
  host: string;
  port: number;
  database: string;
  user: string;
  ssl: boolean;
  sslRejectUnauthorized: boolean;
  source: DbConfigSource;
  hasPassword: boolean;
}

interface StoredDbConfig {
  host: string;
  port: number;
  database: string;
  user: string;
  passwordEncrypted: string | null;
  ssl: boolean;
  sslRejectUnauthorized: boolean;
}

let cache: DbConfig | null | undefined;

function configDirectory(): string {
  return (
    process.env.CADDYWEB_CONFIG_DIR?.trim() ||
    process.env.CADDYWEB_DATA_DIR?.trim() ||
    path.join(process.cwd(), "data")
  );
}

export function dbConfigFilePath(): string {
  return path.join(configDirectory(), "database.json");
}

function envDbConfig(): DbConfig | null {
  const urlValue = process.env.DATABASE_URL?.trim();

  if (urlValue) {
    try {
      const url = new URL(urlValue);
      if (url.protocol !== "mysql:" && url.protocol !== "mariadb:") return null;
      const ssl =
        url.searchParams.get("ssl") === "true" ||
        url.searchParams.get("ssl") === "required";

      return {
        host: url.hostname,
        port: Number(url.port || 3306),
        database: decodeURIComponent(url.pathname.replace(/^\/+/, "")),
        user: decodeURIComponent(url.username),
        password: decodeURIComponent(url.password),
        ssl,
        sslRejectUnauthorized:
          url.searchParams.get("sslRejectUnauthorized") !== "false",
        source: "env",
      };
    } catch {
      return null;
    }
  }

  const host = process.env.DB_HOST?.trim();
  const database = process.env.DB_NAME?.trim();
  const user = process.env.DB_USER?.trim();
  if (!host || !database || !user) return null;

  return {
    host,
    port: Number(process.env.DB_PORT || 3306),
    database,
    user,
    password: process.env.DB_PASSWORD ?? "",
    ssl: process.env.DB_SSL?.trim().toLowerCase() === "true",
    sslRejectUnauthorized:
      process.env.DB_SSL_REJECT_UNAUTHORIZED?.trim().toLowerCase() !== "false",
    source: "env",
  };
}

function fileDbConfig(): DbConfig | null {
  try {
    const raw = fs.readFileSync(dbConfigFilePath(), "utf8");
    const stored = JSON.parse(raw) as StoredDbConfig;
    if (!stored.host || !stored.database || !stored.user) return null;

    return {
      host: stored.host,
      port: Number(stored.port || 3306),
      database: stored.database,
      user: stored.user,
      password: decryptSecret(stored.passwordEncrypted) ?? "",
      ssl: Boolean(stored.ssl),
      sslRejectUnauthorized: stored.sslRejectUnauthorized !== false,
      source: "file",
    };
  } catch {
    return null;
  }
}

export function loadDbConfig(force = false): DbConfig | null {
  if (!force && cache !== undefined) return cache;
  cache = envDbConfig() ?? fileDbConfig();
  return cache;
}

export function dbConfigSource(): DbConfigSource {
  return loadDbConfig()?.source ?? "none";
}

export function isDbConfigured(): boolean {
  return loadDbConfig() !== null;
}

export function saveDbConfig(input: DbConfigInput): DbConfigSummary {
  const current = loadDbConfig();
  if (current?.source === "env") {
    throw new Error("Database settings are managed by environment variables.");
  }

  const password =
    input.password && input.password.length > 0
      ? input.password
      : current?.password ?? "";

  if (!input.host.trim() || !input.database.trim() || !input.user.trim()) {
    throw new Error("Host, database and user are required.");
  }
  if (!password) {
    throw new Error("A database password is required.");
  }

  const stored: StoredDbConfig = {
    host: input.host.trim(),
    port: input.port || 3306,
    database: input.database.trim(),
    user: input.user.trim(),
    passwordEncrypted: encryptSecret(password),
    ssl: input.ssl,
    sslRejectUnauthorized: input.sslRejectUnauthorized,
  };

  const file = dbConfigFilePath();
  fs.mkdirSync(path.dirname(file), { recursive: true, mode: 0o700 });
  fs.writeFileSync(file, `${JSON.stringify(stored, null, 2)}\n`, { mode: 0o600 });
  cache = undefined;

  return summarize(loadDbConfig(true) as DbConfig);
}

export function connectionOptions(config: DbConfig) {
  return {
    host: config.host,
    port: config.port,
    database: config.database,
    user: config.user,
    password: config.password,
    ssl: config.ssl
      ? { rejectUnauthorized: config.sslRejectUnauthorized }
      : undefined,
    connectTimeout: 8000,
    charset: "utf8mb4",
  };
}

export async function testDbConnection(
  config: DbConfig,
): Promise<{ ok: boolean; version?: string; error?: string }> {
  let connection: mysql.Connection | null = null;
  try {
    connection = await mysql.createConnection(connectionOptions(config));
    const [rows] = await connection.query("SELECT VERSION() AS version");
    const version = (rows as { version?: string }[])[0]?.version;
    return { ok: true, version };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Connection failed.";
    return { ok: false, error: message.slice(0, 500) };
  } finally {
    if (connection) await connection.end().catch(() => undefined);
  }
}

export function summarize(config: DbConfig): DbConfigSummary {
  return {
    host: config.host,
    port: config.port,
    database: config.database,
    user: config.user,
    ssl: config.ssl,
    sslRejectUnauthorized: config.sslRejectUnauthorized,
    source: config.source,
    hasPassword: Boolean(config.password),
  };
}

export function getDbConfigSummary(): DbConfigSummary | null {
  const config = loadDbConfig();
  return config ? summarize(config) : null;
}
