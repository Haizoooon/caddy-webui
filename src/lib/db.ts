import fs from "node:fs";
import path from "node:path";
import { DatabaseSync } from "node:sqlite";
import bcrypt from "bcryptjs";
import { appUsername } from "./session";

export class DatabaseError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "DatabaseError";
  }
}

interface DatabaseState {
  db: DatabaseSync;
  path: string;
}

let state: DatabaseState | null = null;

export function dataDirectory(): string {
  return process.env.CADDYWEB_DATA_DIR?.trim() || path.join(process.cwd(), "data");
}

export function databasePath(): string {
  return (
    process.env.CADDYWEB_DB_PATH?.trim() ||
    path.join(dataDirectory(), "caddyweb.db")
  );
}

function ensureColumn(
  db: DatabaseSync,
  table: string,
  column: string,
  definition: string,
): void {
  const columns = db
    .prepare(`PRAGMA table_info(${table})`)
    .all() as unknown as { name: string }[];

  if (!columns.some((entry) => entry.name === column)) {
    db.exec(`ALTER TABLE ${table} ADD COLUMN ${column} ${definition}`);
  }
}

function migrate(db: DatabaseSync): void {
  db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      username TEXT NOT NULL UNIQUE COLLATE NOCASE,
      name TEXT,
      email TEXT COLLATE NOCASE,
      password_hash TEXT,
      role TEXT NOT NULL DEFAULT 'viewer' CHECK (role IN ('admin', 'editor', 'viewer')),
      active INTEGER NOT NULL DEFAULT 1,
      avatar TEXT,
      email_notifications INTEGER NOT NULL DEFAULT 1,
      oidc_subject TEXT,
      oidc_issuer TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      last_login_at TEXT
    );

    CREATE UNIQUE INDEX IF NOT EXISTS users_email_unique
      ON users(email) WHERE email IS NOT NULL AND email != '';

    CREATE TABLE IF NOT EXISTS api_tokens (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      name TEXT NOT NULL,
      token_hash TEXT NOT NULL UNIQUE,
      prefix TEXT NOT NULL,
      created_at TEXT NOT NULL,
      last_used_at TEXT,
      expires_at TEXT,
      revoked_at TEXT
    );

    CREATE TABLE IF NOT EXISTS settings (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS audit_log (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      actor TEXT,
      action TEXT NOT NULL,
      target TEXT,
      detail TEXT,
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS email_log (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      recipient TEXT NOT NULL,
      subject TEXT NOT NULL,
      status TEXT NOT NULL,
      error TEXT,
      created_at TEXT NOT NULL
    );
  `);

  // Migration from schema v1 (users without profile fields).
  ensureColumn(db, "users", "name", "TEXT");
  ensureColumn(db, "users", "avatar", "TEXT");
  ensureColumn(db, "users", "email_notifications", "INTEGER NOT NULL DEFAULT 1");

  db.exec("PRAGMA user_version = 2");
}

function seedAdmin(db: DatabaseSync): void {
  const password = process.env.APP_PASSWORD;
  if (!password) return;

  const admins = db
    .prepare("SELECT COUNT(*) AS count FROM users WHERE role = 'admin' AND active = 1")
    .get() as { count: number };
  if (admins.count > 0) return;

  const username = appUsername();
  const now = new Date().toISOString();
  const hash = bcrypt.hashSync(password, 10);
  const existing = db
    .prepare("SELECT id FROM users WHERE username = ? COLLATE NOCASE")
    .get(username) as { id: number } | undefined;

  if (existing) {
    db.prepare(
      `UPDATE users SET password_hash = ?, role = 'admin', active = 1,
       name = COALESCE(name, ?), updated_at = ? WHERE id = ?`,
    ).run(hash, username, now, existing.id);
  } else {
    db.prepare(
      `INSERT INTO users (username, name, email, password_hash, role, active, created_at, updated_at)
       VALUES (?, ?, NULL, ?, 'admin', 1, ?, ?)`,
    ).run(username, username, hash, now, now);
  }
}

export function getDb(): DatabaseSync {
  const target = databasePath();

  if (state && state.path === target) return state.db;

  try {
    fs.mkdirSync(path.dirname(target), { recursive: true });
    const db = new DatabaseSync(target);
    db.exec("PRAGMA journal_mode = WAL");
    db.exec("PRAGMA foreign_keys = ON");
    db.exec("PRAGMA busy_timeout = 5000");
    db.exec("PRAGMA synchronous = NORMAL");
    migrate(db);
    seedAdmin(db);
    state = { db, path: target };
    return db;
  } catch (error) {
    throw new DatabaseError(
      error instanceof Error ? error.message : "Could not open the database.",
    );
  }
}

export function getSetting(key: string): string | null {
  const row = getDb()
    .prepare("SELECT value FROM settings WHERE key = ?")
    .get(key) as { value: string } | undefined;
  return row?.value ?? null;
}

export function setSetting(key: string, value: string): void {
  const now = new Date().toISOString();
  getDb()
    .prepare(
      `INSERT INTO settings (key, value, updated_at) VALUES (?, ?, ?)
       ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at`,
    )
    .run(key, value, now);
}

export function deleteSetting(key: string): void {
  getDb().prepare("DELETE FROM settings WHERE key = ?").run(key);
}

export function audit(
  actor: string | null,
  action: string,
  target?: string,
  detail?: string,
): void {
  try {
    getDb()
      .prepare(
        "INSERT INTO audit_log (actor, action, target, detail, created_at) VALUES (?, ?, ?, ?, ?)",
      )
      .run(actor, action, target ?? null, detail ?? null, new Date().toISOString());
  } catch {
    // Auditing must never break the main operation.
  }
}

export interface DatabaseStatus {
  open: boolean;
  path: string;
  sizeBytes: number;
  users: number;
  activeUsers: number;
  tokens: number;
  schemaVersion: number;
  error?: string;
}

export function databaseStatus(): DatabaseStatus {
  const target = databasePath();

  try {
    const db = getDb();
    const users = db.prepare("SELECT COUNT(*) AS count FROM users").get() as {
      count: number;
    };
    const activeUsers = db
      .prepare("SELECT COUNT(*) AS count FROM users WHERE active = 1")
      .get() as { count: number };
    const tokens = db
      .prepare("SELECT COUNT(*) AS count FROM api_tokens WHERE revoked_at IS NULL")
      .get() as { count: number };
    const version = db.prepare("PRAGMA user_version").get() as {
      user_version: number;
    };

    let size = 0;
    try {
      size = fs.statSync(target).size;
    } catch {
      size = 0;
    }

    return {
      open: true,
      path: target,
      sizeBytes: size,
      users: users.count,
      activeUsers: activeUsers.count,
      tokens: tokens.count,
      schemaVersion: version.user_version,
    };
  } catch (error) {
    return {
      open: false,
      path: target,
      sizeBytes: 0,
      users: 0,
      activeUsers: 0,
      tokens: 0,
      schemaVersion: 0,
      error: error instanceof Error ? error.message : "Database unavailable.",
    };
  }
}

export function backupDatabase(): { filename: string; data: Buffer } {
  const db = getDb();
  db.exec("PRAGMA wal_checkpoint(FULL)");
  return {
    filename: `caddyweb-backup-${new Date().toISOString().slice(0, 10)}.db`,
    data: fs.readFileSync(databasePath()),
  };
}
