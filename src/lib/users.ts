import { createHash, randomBytes } from "node:crypto";
import bcrypt from "bcryptjs";
import { getDb } from "./db";
import type { Role } from "./roles";

export class UserError extends Error {
  status: number;

  constructor(message: string, status = 400) {
    super(message);
    this.name = "UserError";
    this.status = status;
  }
}

export interface User {
  id: number;
  username: string;
  email: string | null;
  role: Role;
  active: boolean;
  authSource: "password" | "oidc" | "both" | "none";
  oidcSubject: string | null;
  createdAt: string;
  updatedAt: string;
  lastLoginAt: string | null;
}

interface UserRow {
  id: number;
  username: string;
  email: string | null;
  password_hash: string | null;
  role: Role;
  active: number;
  oidc_subject: string | null;
  oidc_issuer: string | null;
  created_at: string;
  updated_at: string;
  last_login_at: string | null;
}

export interface CreateUserInput {
  username: string;
  email?: string;
  password: string;
  role: Role;
  active?: boolean;
}

export interface UpdateUserInput {
  username?: string;
  email?: string | null;
  password?: string;
  role?: Role;
  active?: boolean;
}

function mapUser(row: UserRow): User {
  const hasPassword = Boolean(row.password_hash);
  const hasOidc = Boolean(row.oidc_subject);

  return {
    id: row.id,
    username: row.username,
    email: row.email,
    role: row.role,
    active: row.active === 1,
    authSource:
      hasPassword && hasOidc
        ? "both"
        : hasOidc
          ? "oidc"
          : hasPassword
            ? "password"
            : "none",
    oidcSubject: row.oidc_subject,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    lastLoginAt: row.last_login_at,
  };
}

function rowById(id: number): UserRow | undefined {
  return getDb().prepare("SELECT * FROM users WHERE id = ?").get(id) as
    | UserRow
    | undefined;
}

function rowByUsername(username: string): UserRow | undefined {
  return getDb()
    .prepare("SELECT * FROM users WHERE username = ? COLLATE NOCASE")
    .get(username) as UserRow | undefined;
}

export function listUsers(): User[] {
  const rows = getDb()
    .prepare("SELECT * FROM users ORDER BY username COLLATE NOCASE")
    .all() as unknown as UserRow[];
  return rows.map(mapUser);
}

export function getUserById(id: number): User | null {
  const row = rowById(id);
  return row ? mapUser(row) : null;
}

export function getUserByUsername(username: string): User | null {
  const row = rowByUsername(username);
  return row ? mapUser(row) : null;
}

export function countUsers(): number {
  const row = getDb().prepare("SELECT COUNT(*) AS count FROM users").get() as {
    count: number;
  };
  return row.count;
}

function activeAdmins(excludeId?: number): number {
  const row = getDb()
    .prepare(
      `SELECT COUNT(*) AS count FROM users
       WHERE role = 'admin' AND active = 1 ${excludeId ? "AND id != ?" : ""}`,
    )
    .get(...(excludeId ? [excludeId] : [])) as { count: number };
  return row.count;
}

function uniqueUsername(base: string): string {
  const clean = base.trim().slice(0, 64) || "user";
  let candidate = clean;
  let counter = 2;

  while (rowByUsername(candidate)) {
    candidate = `${clean.slice(0, 58)}-${counter++}`;
  }
  return candidate;
}

export function createUser(input: CreateUserInput): User {
  const now = new Date().toISOString();
  const hash = bcrypt.hashSync(input.password, 10);

  try {
    const result = getDb()
      .prepare(
        `INSERT INTO users (username, email, password_hash, role, active, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
      )
      .run(
        input.username,
        input.email || null,
        hash,
        input.role,
        input.active === false ? 0 : 1,
        now,
        now,
      );

    const row = rowById(Number(result.lastInsertRowid));
    if (!row) throw new UserError("User could not be created.", 500);
    return mapUser(row);
  } catch (error) {
    if (error instanceof UserError) throw error;
    const message = error instanceof Error ? error.message : "";
    if (message.includes("UNIQUE") && message.includes("email")) {
      throw new UserError("A user with that email already exists.", 409);
    }
    if (message.includes("UNIQUE")) {
      throw new UserError("A user with that username already exists.", 409);
    }
    throw new UserError("Could not create the user.", 500);
  }
}

export function updateUser(id: number, input: UpdateUserInput): User {
  const current = rowById(id);
  if (!current) throw new UserError("User not found.", 404);

  const nextRole = input.role ?? current.role;
  const nextActive = input.active === undefined ? current.active === 1 : input.active;

  if (current.role === "admin" && current.active === 1) {
    if ((nextRole !== "admin" || !nextActive) && activeAdmins(id) === 0) {
      throw new UserError("At least one active admin must remain.", 409);
    }
  }

  const hash = input.password ? bcrypt.hashSync(input.password, 10) : current.password_hash;

  try {
    getDb()
      .prepare(
        `UPDATE users
         SET username = ?, email = ?, password_hash = ?, role = ?, active = ?, updated_at = ?
         WHERE id = ?`,
      )
      .run(
        input.username ?? current.username,
        input.email !== undefined ? input.email || null : current.email,
        hash,
        nextRole,
        nextActive ? 1 : 0,
        new Date().toISOString(),
        id,
      );
  } catch (error) {
    const message = error instanceof Error ? error.message : "";
    if (message.includes("UNIQUE") && message.includes("email")) {
      throw new UserError("A user with that email already exists.", 409);
    }
    if (message.includes("UNIQUE")) {
      throw new UserError("A user with that username already exists.", 409);
    }
    throw new UserError("Could not update the user.", 500);
  }

  const updated = rowById(id);
  if (!updated) throw new UserError("User not found.", 404);
  return mapUser(updated);
}

export function deleteUser(id: number, actorId?: number): void {
  const current = rowById(id);
  if (!current) throw new UserError("User not found.", 404);
  if (actorId === id) throw new UserError("You cannot delete your own account.", 409);

  if (current.role === "admin" && current.active === 1 && activeAdmins(id) === 0) {
    throw new UserError("At least one active admin must remain.", 409);
  }

  getDb().prepare("DELETE FROM users WHERE id = ?").run(id);
}

export function authenticateUser(
  username: string,
  password: string,
): User | null {
  const row = rowByUsername(username);
  if (!row || row.active !== 1 || !row.password_hash) return null;
  if (!bcrypt.compareSync(password, row.password_hash)) return null;
  return mapUser(row);
}

export function ensureEnvAdmin(): User | null {
  const username = process.env.APP_USERNAME?.trim() || "admin";
  const password = process.env.APP_PASSWORD;
  if (!password) return null;

  const now = new Date().toISOString();
  const hash = bcrypt.hashSync(password, 10);
  const existing = rowByUsername(username);

  if (existing) {
    getDb()
      .prepare(
        "UPDATE users SET password_hash = ?, role = 'admin', active = 1, updated_at = ? WHERE id = ?",
      )
      .run(hash, now, existing.id);
    const row = rowById(existing.id);
    return row ? mapUser(row) : null;
  }

  const result = getDb()
    .prepare(
      `INSERT INTO users (username, email, password_hash, role, active, created_at, updated_at)
       VALUES (?, NULL, ?, 'admin', 1, ?, ?)`,
    )
    .run(username, hash, now, now);

  const row = rowById(Number(result.lastInsertRowid));
  return row ? mapUser(row) : null;
}

export interface OidcIdentityInput {
  subject: string;
  username: string;
  email?: string;
  groups: string[];
}

export function upsertOidcUser(
  identity: OidcIdentityInput,
  issuer: string,
  defaultRole: Role,
  autoProvision: boolean,
): User | null {
  const db = getDb();
  const now = new Date().toISOString();

  const bySubject = db
    .prepare(
      "SELECT * FROM users WHERE oidc_subject = ? AND oidc_issuer = ? LIMIT 1",
    )
    .get(identity.subject, issuer) as UserRow | undefined;

  let row = bySubject;

  if (!row && identity.email) {
    row = db
      .prepare("SELECT * FROM users WHERE email = ? COLLATE NOCASE LIMIT 1")
      .get(identity.email) as UserRow | undefined;
  }

  if (!row) {
    row = rowByUsername(identity.username);
  }

  if (row) {
    if (row.active !== 1) return null;

    db.prepare(
      `UPDATE users SET oidc_subject = ?, oidc_issuer = ?, last_login_at = ?, updated_at = ?
       WHERE id = ?`,
    ).run(identity.subject, issuer, now, now, row.id);

    return getUserById(row.id);
  }

  if (!autoProvision) return null;

  const username = uniqueUsername(identity.username);
  const result = db
    .prepare(
      `INSERT INTO users (username, email, password_hash, role, active, oidc_subject, oidc_issuer, created_at, updated_at, last_login_at)
       VALUES (?, ?, NULL, ?, 1, ?, ?, ?, ?, ?)`,
    )
    .run(
      username,
      identity.email || null,
      defaultRole,
      identity.subject,
      issuer,
      now,
      now,
      now,
    );

  return getUserById(Number(result.lastInsertRowid));
}

export function touchLogin(id: number): void {
  getDb()
    .prepare("UPDATE users SET last_login_at = ?, updated_at = ? WHERE id = ?")
    .run(new Date().toISOString(), new Date().toISOString(), id);
}

export interface ApiToken {
  id: number;
  name: string;
  prefix: string;
  userId: number;
  username: string;
  createdAt: string;
  lastUsedAt: string | null;
  expiresAt: string | null;
  revokedAt: string | null;
}

interface TokenRow {
  id: number;
  name: string;
  prefix: string;
  user_id: number;
  username: string;
  created_at: string;
  last_used_at: string | null;
  expires_at: string | null;
  revoked_at: string | null;
}

function mapToken(row: TokenRow): ApiToken {
  return {
    id: row.id,
    name: row.name,
    prefix: row.prefix,
    userId: row.user_id,
    username: row.username,
    createdAt: row.created_at,
    lastUsedAt: row.last_used_at,
    expiresAt: row.expires_at,
    revokedAt: row.revoked_at,
  };
}

export function hashApiToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

export function createApiToken(
  userId: number,
  name: string,
  expiresInDays: number | null,
): { token: string; record: ApiToken } {
  const user = rowById(userId);
  if (!user) throw new UserError("User not found.", 404);

  const token = `cw_${randomBytes(32).toString("base64url")}`;
  const now = new Date();
  const expiresAt =
    expiresInDays && expiresInDays > 0
      ? new Date(now.getTime() + expiresInDays * 24 * 60 * 60 * 1000).toISOString()
      : null;

  const result = getDb()
    .prepare(
      `INSERT INTO api_tokens (user_id, name, token_hash, prefix, created_at, expires_at)
       VALUES (?, ?, ?, ?, ?, ?)`,
    )
    .run(
      userId,
      name,
      hashApiToken(token),
      token.slice(0, 12),
      now.toISOString(),
      expiresAt,
    );

  const row = getDb()
    .prepare(
      `SELECT t.*, u.username FROM api_tokens t JOIN users u ON u.id = t.user_id WHERE t.id = ?`,
    )
    .get(Number(result.lastInsertRowid)) as unknown as TokenRow;

  return { token, record: mapToken(row) };
}

export function listApiTokens(): ApiToken[] {
  const rows = getDb()
    .prepare(
      `SELECT t.*, u.username
       FROM api_tokens t JOIN users u ON u.id = t.user_id
       WHERE t.revoked_at IS NULL
       ORDER BY t.created_at DESC`,
    )
    .all() as unknown as TokenRow[];
  return rows.map(mapToken);
}

export function revokeApiToken(id: number): void {
  getDb()
    .prepare("UPDATE api_tokens SET revoked_at = ? WHERE id = ? AND revoked_at IS NULL")
    .run(new Date().toISOString(), id);
}

export interface TokenUser {
  tokenId: number;
  user: User;
}

export function authenticateApiToken(token: string): TokenUser | null {
  if (!token.startsWith("cw_")) return null;

  const row = getDb()
    .prepare(
      `SELECT t.id AS token_id, t.expires_at, t.revoked_at, u.*
       FROM api_tokens t JOIN users u ON u.id = t.user_id
       WHERE t.token_hash = ? LIMIT 1`,
    )
    .get(hashApiToken(token)) as
    | (UserRow & {
        token_id: number;
        expires_at: string | null;
        revoked_at: string | null;
      })
    | undefined;

  if (!row || row.active !== 1 || row.revoked_at) return null;
  if (row.expires_at && new Date(row.expires_at).getTime() < Date.now()) return null;

  touchToken(row.token_id);

  return { tokenId: row.token_id, user: mapUser(row) };
}

export function touchToken(id: number): void {
  getDb()
    .prepare("UPDATE api_tokens SET last_used_at = ? WHERE id = ?")
    .run(new Date().toISOString(), id);
}
