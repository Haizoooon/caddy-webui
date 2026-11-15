import bcrypt from "bcryptjs";
import mysql, { type Pool } from "mysql2/promise";
import { appUsername } from "./session";
import {
  connectionOptions,
  dbConfigSource,
  getDbConfigSummary,
  loadDbConfig,
  type DbConfig,
  type DbConfigSource,
} from "./db-config";

export class DatabaseError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "DatabaseError";
  }
}

export class DatabaseNotConfiguredError extends DatabaseError {
  constructor() {
    super("No database is configured. Finish the setup wizard first.");
    this.name = "DatabaseNotConfiguredError";
  }
}

let pool: Pool | null = null;
let poolConfig: DbConfig | null = null;
let initPromise: Promise<void> | null = null;

async function ensureSchema(target: Pool): Promise<void> {
  await target.query(`
    CREATE TABLE IF NOT EXISTS users (
      id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
      username VARCHAR(64) NOT NULL,
      name VARCHAR(120) NULL,
      email VARCHAR(254) NULL,
      password_hash VARCHAR(255) NULL,
      role ENUM('admin', 'editor', 'viewer') NOT NULL DEFAULT 'viewer',
      active TINYINT(1) NOT NULL DEFAULT 1,
      avatar MEDIUMTEXT NULL,
      email_notifications TINYINT(1) NOT NULL DEFAULT 1,
      oidc_subject VARCHAR(255) NULL,
      oidc_issuer VARCHAR(500) NULL,
      created_at VARCHAR(40) NOT NULL,
      updated_at VARCHAR(40) NOT NULL,
      last_login_at VARCHAR(40) NULL,
      PRIMARY KEY (id),
      UNIQUE KEY users_username_unique (username),
      UNIQUE KEY users_email_unique (email),
      KEY users_oidc (oidc_subject, oidc_issuer)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);

  await target.query(`
    CREATE TABLE IF NOT EXISTS api_tokens (
      id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
      user_id BIGINT UNSIGNED NOT NULL,
      name VARCHAR(80) NOT NULL,
      token_hash CHAR(64) CHARACTER SET ascii NOT NULL,
      prefix VARCHAR(20) NOT NULL,
      created_at VARCHAR(40) NOT NULL,
      last_used_at VARCHAR(40) NULL,
      expires_at VARCHAR(40) NULL,
      revoked_at VARCHAR(40) NULL,
      PRIMARY KEY (id),
      UNIQUE KEY api_tokens_hash_unique (token_hash),
      KEY api_tokens_user (user_id),
      CONSTRAINT api_tokens_user_fk FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);

  await target.query(`
    CREATE TABLE IF NOT EXISTS settings (
      setting_key VARCHAR(100) NOT NULL,
      setting_value LONGTEXT NOT NULL,
      updated_at VARCHAR(40) NOT NULL,
      PRIMARY KEY (setting_key)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);

  await target.query(`
    CREATE TABLE IF NOT EXISTS audit_log (
      id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
      actor VARCHAR(190) NULL,
      action VARCHAR(80) NOT NULL,
      target VARCHAR(255) NULL,
      detail TEXT NULL,
      created_at VARCHAR(40) NOT NULL,
      PRIMARY KEY (id),
      KEY audit_log_created (created_at)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);

  await target.query(`
    CREATE TABLE IF NOT EXISTS email_log (
      id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
      recipient VARCHAR(254) NOT NULL,
      subject VARCHAR(300) NOT NULL,
      status ENUM('sent', 'failed') NOT NULL,
      error TEXT NULL,
      created_at VARCHAR(40) NOT NULL,
      PRIMARY KEY (id),
      KEY email_log_created (created_at)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);

  await target.query(
    `INSERT INTO settings (setting_key, setting_value, updated_at)
     VALUES ('schema_version', '1', ?)
     ON DUPLICATE KEY UPDATE setting_value = VALUES(setting_value), updated_at = VALUES(updated_at)`,
    [new Date().toISOString()],
  );

  await seedAdmin(target);
}

async function seedAdmin(target: Pool): Promise<void> {
  const password = process.env.APP_PASSWORD;
  if (!password) return;

  const [rows] = await target.execute(
    "SELECT COUNT(*) AS count FROM users WHERE role = 'admin' AND active = 1",
  );
  const count = Number((rows as { count: number }[])[0]?.count ?? 0);
  if (count > 0) return;

  const username = appUsername();
  const now = new Date().toISOString();
  const hash = await bcrypt.hash(password, 10);

  await target.execute(
    `INSERT INTO users (username, name, email, password_hash, role, active, created_at, updated_at)
     VALUES (?, ?, NULL, ?, 'admin', 1, ?, ?)
     ON DUPLICATE KEY UPDATE password_hash = VALUES(password_hash), role = 'admin',
       active = 1, name = COALESCE(name, VALUES(name)), updated_at = VALUES(updated_at)`,
    [username, username, hash, now, now],
  );
}

export async function getPool(): Promise<Pool> {
  const config = loadDbConfig();
  if (!config) throw new DatabaseNotConfiguredError();

  const changed =
    pool &&
    poolConfig &&
    (poolConfig.host !== config.host ||
      poolConfig.port !== config.port ||
      poolConfig.database !== config.database ||
      poolConfig.user !== config.user ||
      poolConfig.password !== config.password ||
      poolConfig.ssl !== config.ssl);

  if (changed) await resetPool();

  if (!pool) {
    pool = mysql.createPool({
      ...connectionOptions(config),
      waitForConnections: true,
      connectionLimit: 10,
      queueLimit: 0,
      enableKeepAlive: true,
    });
    poolConfig = config;
  }

  if (!initPromise) {
    initPromise = ensureSchema(pool).catch(async (error) => {
      initPromise = null;
      await resetPool();
      throw new DatabaseError(
        error instanceof Error ? error.message : "Could not initialize the database.",
      );
    });
  }

  await initPromise;
  return pool;
}

export async function resetPool(): Promise<void> {
  const current = pool;
  pool = null;
  poolConfig = null;
  initPromise = null;
  healthCache = null;
  if (current) await current.end().catch(() => undefined);
}

let healthCache: { checkedAt: number; ok: boolean } | null = null;

export async function dbHealthy(): Promise<boolean> {
  if (!loadDbConfig()) return false;
  if (healthCache && Date.now() - healthCache.checkedAt < 5000) {
    return healthCache.ok;
  }

  try {
    const target = await getPool();
    await target.query("SELECT 1");
    healthCache = { checkedAt: Date.now(), ok: true };
    return true;
  } catch {
    healthCache = { checkedAt: Date.now(), ok: false };
    return false;
  }
}

export async function getSetting(key: string): Promise<string | null> {
  const target = await getPool();
  const [rows] = await target.execute(
    "SELECT setting_value FROM settings WHERE setting_key = ? LIMIT 1",
    [key],
  );
  const value = (rows as { setting_value: string }[])[0]?.setting_value;
  return value ?? null;
}

export async function setSetting(key: string, value: string): Promise<void> {
  const target = await getPool();
  await target.execute(
    `INSERT INTO settings (setting_key, setting_value, updated_at)
     VALUES (?, ?, ?)
     ON DUPLICATE KEY UPDATE setting_value = VALUES(setting_value), updated_at = VALUES(updated_at)`,
    [key, value, new Date().toISOString()],
  );
}

export async function deleteSetting(key: string): Promise<void> {
  const target = await getPool();
  await target.execute("DELETE FROM settings WHERE setting_key = ?", [key]);
}

export async function audit(
  actor: string | null,
  action: string,
  targetName?: string,
  detail?: string,
): Promise<void> {
  try {
    const target = await getPool();
    await target.execute(
      "INSERT INTO audit_log (actor, action, target, detail, created_at) VALUES (?, ?, ?, ?, ?)",
      [actor, action, targetName ?? null, detail ?? null, new Date().toISOString()],
    );
  } catch {
    // Auditing must never break the main operation.
  }
}

export interface DatabaseStatus {
  configured: boolean;
  open: boolean;
  source: DbConfigSource;
  host: string;
  port: number;
  database: string;
  user: string;
  ssl: boolean;
  version: string;
  sizeBytes: number;
  users: number;
  activeUsers: number;
  tokens: number;
  schemaVersion: number;
  error?: string;
}

export async function databaseStatus(): Promise<DatabaseStatus> {
  const config = getDbConfigSummary();

  if (!config) {
    return {
      configured: false,
      open: false,
      source: "none",
      host: "",
      port: 3306,
      database: "",
      user: "",
      ssl: false,
      version: "",
      sizeBytes: 0,
      users: 0,
      activeUsers: 0,
      tokens: 0,
      schemaVersion: 0,
    };
  }

  try {
    const target = await getPool();
    const [versionRows] = await target.query("SELECT VERSION() AS version");
    const [userRows] = await target.execute(
      "SELECT COUNT(*) AS count FROM users",
    );
    const [activeRows] = await target.execute(
      "SELECT COUNT(*) AS count FROM users WHERE active = 1",
    );
    const [tokenRows] = await target.execute(
      "SELECT COUNT(*) AS count FROM api_tokens WHERE revoked_at IS NULL",
    );
    const [schemaRows] = await target.execute(
      "SELECT setting_value FROM settings WHERE setting_key = 'schema_version' LIMIT 1",
    );
    const [sizeRows] = await target.execute(
      `SELECT COALESCE(SUM(data_length + index_length), 0) AS bytes
       FROM information_schema.tables WHERE table_schema = ?`,
      [config.database],
    );

    return {
      configured: true,
      open: true,
      source: config.source,
      host: config.host,
      port: config.port,
      database: config.database,
      user: config.user,
      ssl: config.ssl,
      version: (versionRows as { version: string }[])[0]?.version ?? "",
      sizeBytes: Number((sizeRows as { bytes: number }[])[0]?.bytes ?? 0),
      users: Number((userRows as { count: number }[])[0]?.count ?? 0),
      activeUsers: Number((activeRows as { count: number }[])[0]?.count ?? 0),
      tokens: Number((tokenRows as { count: number }[])[0]?.count ?? 0),
      schemaVersion: Number(
        (schemaRows as { setting_value: string }[])[0]?.setting_value ?? 0,
      ),
    };
  } catch (error) {
    return {
      configured: true,
      open: false,
      source: dbConfigSource(),
      host: config.host,
      port: config.port,
      database: config.database,
      user: config.user,
      ssl: config.ssl,
      version: "",
      sizeBytes: 0,
      users: 0,
      activeUsers: 0,
      tokens: 0,
      schemaVersion: 0,
      error: error instanceof Error ? error.message : "Database unavailable.",
    };
  }
}
