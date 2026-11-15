import { createHash, randomBytes } from "node:crypto";
import bcrypt from "bcryptjs";
import { getPool } from "./db";
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
  name: string | null;
  email: string | null;
  role: Role;
  active: boolean;
  avatar: string | null;
  emailNotifications: boolean;
  authSource: "password" | "oidc" | "both" | "none";
  oidcSubject: string | null;
  createdAt: string;
  updatedAt: string;
  lastLoginAt: string | null;
}

interface UserRow {
  id: number;
  username: string;
  name: string | null;
  email: string | null;
  password_hash: string | null;
  role: Role;
  active: number;
  avatar: string | null;
  email_notifications: number;
  oidc_subject: string | null;
  oidc_issuer: string | null;
  created_at: string;
  updated_at: string;
  last_login_at: string | null;
}

export interface CreateUserInput {
  username: string;
  name?: string;
  email?: string;
  password: string;
  role: Role;
  active?: boolean;
}

export interface UpdateUserInput {
  username?: string;
  name?: string;
  email?: string | null;
  password?: string;
  role?: Role;
  active?: boolean;
  emailNotifications?: boolean;
}

function mapUser(row: UserRow): User {
  const hasPassword = Boolean(row.password_hash);
  const hasOidc = Boolean(row.oidc_subject);

  return {
    id: Number(row.id),
    username: row.username,
    name: row.name,
    email: row.email,
    role: row.role,
    active: Number(row.active) === 1,
    avatar: row.avatar,
    emailNotifications: Number(row.email_notifications) !== 0,
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

async function rowById(id: number): Promise<UserRow | undefined> {
  const pool = await getPool();
  const [rows] = await pool.execute("SELECT * FROM users WHERE id = ? LIMIT 1", [id]);
  return (rows as UserRow[])[0];
}

async function rowByUsername(username: string): Promise<UserRow | undefined> {
  const pool = await getPool();
  const [rows] = await pool.execute(
    "SELECT * FROM users WHERE username = ? LIMIT 1",
    [username],
  );
  return (rows as UserRow[])[0];
}

export async function listUsers(): Promise<User[]> {
  const pool = await getPool();
  const [rows] = await pool.query(
    "SELECT * FROM users ORDER BY username COLLATE utf8mb4_unicode_ci",
  );
  return (rows as UserRow[]).map(mapUser);
}

export async function getUserById(id: number): Promise<User | null> {
  const row = await rowById(id);
  return row ? mapUser(row) : null;
}

export async function getUserByUsername(username: string): Promise<User | null> {
  const row = await rowByUsername(username);
  return row ? mapUser(row) : null;
}

export async function countUsers(): Promise<number> {
  const pool = await getPool();
  const [rows] = await pool.query("SELECT COUNT(*) AS count FROM users");
  return Number((rows as { count: number }[])[0]?.count ?? 0);
}

async function activeAdmins(excludeId?: number): Promise<number> {
  const pool = await getPool();
  const [rows] = await pool.execute(
    `SELECT COUNT(*) AS count FROM users
     WHERE role = 'admin' AND active = 1 ${excludeId ? "AND id != ?" : ""}`,
    excludeId ? [excludeId] : [],
  );
  return Number((rows as { count: number }[])[0]?.count ?? 0);
}

async function uniqueUsername(base: string): Promise<string> {
  const clean = base.trim().slice(0, 64) || "user";
  let candidate = clean;
  let counter = 2;

  while (await rowByUsername(candidate)) {
    candidate = `${clean.slice(0, 58)}-${counter++}`;
  }
  return candidate;
}

function duplicateMessage(error: unknown): string {
  const message = error instanceof Error ? error.message : "";
  if (!message.includes("ER_DUP_ENTRY") && !message.includes("Duplicate entry")) {
    return "";
  }
  if (message.includes("users_email_unique") || message.includes("email")) {
    return "A user with that email already exists.";
  }
  if (message.includes("users_username_unique") || message.includes("username")) {
    return "A user with that username already exists.";
  }
  return "That value is already in use.";
}

export async function createUser(input: CreateUserInput): Promise<User> {
  const pool = await getPool();
  const now = new Date().toISOString();
  const hash = await bcrypt.hash(input.password, 10);

  try {
    const [result] = await pool.execute(
      `INSERT INTO users (username, name, email, password_hash, role, active, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        input.username,
        input.name || null,
        input.email || null,
        hash,
        input.role,
        input.active === false ? 0 : 1,
        now,
        now,
      ],
    );

    const id = Number((result as { insertId: number }).insertId);
    const row = await rowById(id);
    if (!row) throw new UserError("User could not be created.", 500);
    return mapUser(row);
  } catch (error) {
    if (error instanceof UserError) throw error;
    const duplicate = duplicateMessage(error);
    if (duplicate) throw new UserError(duplicate, 409);
    throw new UserError("Could not create the user.", 500);
  }
}

export async function updateUser(id: number, input: UpdateUserInput): Promise<User> {
  const current = await rowById(id);
  if (!current) throw new UserError("User not found.", 404);

  const nextRole = input.role ?? current.role;
  const nextActive =
    input.active === undefined ? Number(current.active) === 1 : input.active;

  if (current.role === "admin" && Number(current.active) === 1) {
    if ((nextRole !== "admin" || !nextActive) && (await activeAdmins(id)) === 0) {
      throw new UserError("At least one active admin must remain.", 409);
    }
  }

  const hash = input.password
    ? await bcrypt.hash(input.password, 10)
    : current.password_hash;

  try {
    const pool = await getPool();
    await pool.execute(
      `UPDATE users
       SET username = ?, name = ?, email = ?, password_hash = ?, role = ?, active = ?,
           email_notifications = ?, updated_at = ?
       WHERE id = ?`,
      [
        input.username ?? current.username,
        input.name !== undefined ? input.name || null : current.name,
        input.email !== undefined ? input.email || null : current.email,
        hash,
        nextRole,
        nextActive ? 1 : 0,
        input.emailNotifications === undefined
          ? current.email_notifications
          : input.emailNotifications
            ? 1
            : 0,
        new Date().toISOString(),
        id,
      ],
    );
  } catch (error) {
    const duplicate = duplicateMessage(error);
    if (duplicate) throw new UserError(duplicate, 409);
    throw new UserError("Could not update the user.", 500);
  }

  const updated = await rowById(id);
  if (!updated) throw new UserError("User not found.", 404);
  return mapUser(updated);
}

export async function deleteUser(id: number, actorId?: number): Promise<void> {
  const current = await rowById(id);
  if (!current) throw new UserError("User not found.", 404);
  if (actorId === id) throw new UserError("You cannot delete your own account.", 409);

  if (
    current.role === "admin" &&
    Number(current.active) === 1 &&
    (await activeAdmins(id)) === 0
  ) {
    throw new UserError("At least one active admin must remain.", 409);
  }

  const pool = await getPool();
  await pool.execute("DELETE FROM users WHERE id = ?", [id]);
}

export async function authenticateUser(
  username: string,
  password: string,
): Promise<User | null> {
  const row = await rowByUsername(username);
  if (!row || Number(row.active) !== 1 || !row.password_hash) return null;
  if (!(await bcrypt.compare(password, row.password_hash))) return null;
  return mapUser(row);
}

export async function ensureEnvAdmin(): Promise<User | null> {
  const username = process.env.APP_USERNAME?.trim() || "admin";
  const password = process.env.APP_PASSWORD;
  if (!password) return null;

  const pool = await getPool();
  const now = new Date().toISOString();
  const hash = await bcrypt.hash(password, 10);

  await pool.execute(
    `INSERT INTO users (username, name, email, password_hash, role, active, created_at, updated_at)
     VALUES (?, ?, NULL, ?, 'admin', 1, ?, ?)
     ON DUPLICATE KEY UPDATE password_hash = VALUES(password_hash), role = 'admin',
       active = 1, name = COALESCE(name, VALUES(name)), updated_at = VALUES(updated_at)`,
    [username, username, hash, now, now],
  );

  const row = await rowByUsername(username);
  return row ? mapUser(row) : null;
}

export interface OidcIdentityInput {
  subject: string;
  username: string;
  name?: string;
  email?: string;
  groups: string[];
}

export async function upsertOidcUser(
  identity: OidcIdentityInput,
  issuer: string,
  defaultRole: Role,
  autoProvision: boolean,
): Promise<User | null> {
  const pool = await getPool();
  const now = new Date().toISOString();

  const [subjectRows] = await pool.execute(
    "SELECT * FROM users WHERE oidc_subject = ? AND oidc_issuer = ? LIMIT 1",
    [identity.subject, issuer],
  );
  let row: UserRow | undefined = (subjectRows as UserRow[])[0];

  if (!row && identity.email) {
    const [emailRows] = await pool.execute(
      "SELECT * FROM users WHERE email = ? LIMIT 1",
      [identity.email],
    );
    row = (emailRows as UserRow[])[0];
  }

  if (!row) row = await rowByUsername(identity.username);

  if (row) {
    if (Number(row.active) !== 1) return null;

    await pool.execute(
      `UPDATE users SET oidc_subject = ?, oidc_issuer = ?, last_login_at = ?, updated_at = ?,
       name = COALESCE(name, ?)
       WHERE id = ?`,
      [identity.subject, issuer, now, now, identity.name || identity.username, row.id],
    );

    return await getUserById(Number(row.id));
  }

  if (!autoProvision) return null;

  const username = await uniqueUsername(identity.username);
  const [result] = await pool.execute(
    `INSERT INTO users (username, name, email, password_hash, role, active, oidc_subject, oidc_issuer, created_at, updated_at, last_login_at)
     VALUES (?, ?, ?, NULL, ?, 1, ?, ?, ?, ?, ?)`,
    [
      username,
      identity.name || identity.username,
      identity.email || null,
      defaultRole,
      identity.subject,
      issuer,
      now,
      now,
      now,
    ],
  );

  return await getUserById(Number((result as { insertId: number }).insertId));
}

export async function touchLogin(id: number): Promise<void> {
  const pool = await getPool();
  const now = new Date().toISOString();
  await pool.execute(
    "UPDATE users SET last_login_at = ?, updated_at = ? WHERE id = ?",
    [now, now, id],
  );
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
    id: Number(row.id),
    name: row.name,
    prefix: row.prefix,
    userId: Number(row.user_id),
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

export async function createApiToken(
  userId: number,
  name: string,
  expiresInDays: number | null,
): Promise<{ token: string; record: ApiToken }> {
  const user = await rowById(userId);
  if (!user) throw new UserError("User not found.", 404);

  const pool = await getPool();
  const token = `cw_${randomBytes(32).toString("base64url")}`;
  const now = new Date();
  const expiresAt =
    expiresInDays && expiresInDays > 0
      ? new Date(now.getTime() + expiresInDays * 24 * 60 * 60 * 1000).toISOString()
      : null;

  const [result] = await pool.execute(
    `INSERT INTO api_tokens (user_id, name, token_hash, prefix, created_at, expires_at)
     VALUES (?, ?, ?, ?, ?, ?)`,
    [
      userId,
      name,
      hashApiToken(token),
      token.slice(0, 12),
      now.toISOString(),
      expiresAt,
    ],
  );

  const [rows] = await pool.execute(
    `SELECT t.*, u.username FROM api_tokens t JOIN users u ON u.id = t.user_id WHERE t.id = ?`,
    [Number((result as { insertId: number }).insertId)],
  );

  return { token, record: mapToken((rows as TokenRow[])[0]) };
}

export async function listApiTokens(): Promise<ApiToken[]> {
  const pool = await getPool();
  const [rows] = await pool.query(
    `SELECT t.*, u.username
     FROM api_tokens t JOIN users u ON u.id = t.user_id
     WHERE t.revoked_at IS NULL
     ORDER BY t.created_at DESC`,
  );
  return (rows as TokenRow[]).map(mapToken);
}

export async function revokeApiToken(id: number): Promise<void> {
  const pool = await getPool();
  await pool.execute(
    "UPDATE api_tokens SET revoked_at = ? WHERE id = ? AND revoked_at IS NULL",
    [new Date().toISOString(), id],
  );
}

export interface TokenUser {
  tokenId: number;
  user: User;
}

export async function authenticateApiToken(token: string): Promise<TokenUser | null> {
  if (!token.startsWith("cw_")) return null;

  const pool = await getPool();
  const [rows] = await pool.execute(
    `SELECT t.id AS token_id, t.expires_at, t.revoked_at, u.*
     FROM api_tokens t JOIN users u ON u.id = t.user_id
     WHERE t.token_hash = ? LIMIT 1`,
    [hashApiToken(token)],
  );

  const row = (
    rows as (UserRow & {
      token_id: number;
      expires_at: string | null;
      revoked_at: string | null;
    })[]
  )[0];

  if (!row || Number(row.active) !== 1 || row.revoked_at) return null;
  if (row.expires_at && new Date(row.expires_at).getTime() < Date.now()) return null;

  await touchToken(Number(row.token_id));

  return { tokenId: Number(row.token_id), user: mapUser(row) };
}

export async function touchToken(id: number): Promise<void> {
  const pool = await getPool();
  await pool.execute("UPDATE api_tokens SET last_used_at = ? WHERE id = ?", [
    new Date().toISOString(),
    id,
  ]);
}

export async function updateProfile(
  id: number,
  input: {
    name?: string;
    email?: string | null;
    avatar?: string | null;
    emailNotifications?: boolean;
  },
): Promise<User> {
  const current = await rowById(id);
  if (!current) throw new UserError("User not found.", 404);

  try {
    const pool = await getPool();
    await pool.execute(
      `UPDATE users SET name = ?, email = ?, avatar = ?, email_notifications = ?, updated_at = ?
       WHERE id = ?`,
      [
        input.name !== undefined ? input.name || null : current.name,
        input.email !== undefined ? input.email || null : current.email,
        input.avatar !== undefined ? input.avatar || null : current.avatar,
        input.emailNotifications === undefined
          ? current.email_notifications
          : input.emailNotifications
            ? 1
            : 0,
        new Date().toISOString(),
        id,
      ],
    );
  } catch (error) {
    const duplicate = duplicateMessage(error);
    if (duplicate) {
      throw new UserError("That email address is already used by another account.", 409);
    }
    throw new UserError("Could not update the profile.", 500);
  }

  const updated = await rowById(id);
  if (!updated) throw new UserError("User not found.", 404);
  return mapUser(updated);
}

export async function setUserPassword(id: number, password: string): Promise<void> {
  if (!(await rowById(id))) throw new UserError("User not found.", 404);
  const pool = await getPool();
  await pool.execute("UPDATE users SET password_hash = ?, updated_at = ? WHERE id = ?", [
    await bcrypt.hash(password, 10),
    new Date().toISOString(),
    id,
  ]);
}

export interface NotificationRecipient {
  username: string;
  name: string | null;
  email: string;
  role: Role;
}

export async function getNotificationRecipients(
  roles: Role[],
): Promise<NotificationRecipient[]> {
  if (roles.length === 0) return [];
  const pool = await getPool();
  const placeholders = roles.map(() => "?").join(", ");

  const [rows] = await pool.execute(
    `SELECT username, name, email, role FROM users
     WHERE active = 1 AND email_notifications = 1
       AND email IS NOT NULL AND email != ''
       AND role IN (${placeholders})
     ORDER BY username`,
    roles,
  );

  return (rows as NotificationRecipient[]).map((row) => ({
    ...row,
    email: row.email,
  }));
}
