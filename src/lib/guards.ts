import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { redirect } from "next/navigation";
import {
  isAuthEnabled,
  SESSION_COOKIE,
  verifySessionToken,
  type SessionTokenPayload,
} from "./session";
import { getUserById } from "./users";
import type { Role } from "./roles";

export interface SessionUser {
  userId?: number;
  username: string;
  role: Role;
  provider: "password" | "oidc" | "env" | "api";
}

export type ApiAuthorization = { user: SessionUser } | { response: NextResponse };

async function resolveSessionUser(
  payload: SessionTokenPayload,
): Promise<SessionUser | null> {
  if (!payload.userId) {
    return {
      username: payload.username,
      role: payload.role,
      provider: payload.provider,
    };
  }

  try {
    const user = getUserById(payload.userId);
    if (!user || !user.active) return null;
    return {
      userId: user.id,
      username: user.username,
      role: user.role,
      provider: payload.provider,
    };
  } catch {
    return null;
  }
}

export async function getSessionUser(): Promise<SessionUser | null> {
  if (!isAuthEnabled()) return null;
  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  const payload = await verifySessionToken(token);
  if (!payload) return null;
  return resolveSessionUser(payload);
}

export async function authorizeApi(requiredRoles?: Role[]): Promise<ApiAuthorization> {
  if (!isAuthEnabled()) {
    return {
      response: NextResponse.json(
        {
          ok: false,
          error:
            "CaddyWeb is not configured. Set APP_PASSWORD (and optionally APP_USERNAME) and restart the container.",
        },
        { status: 503 },
      ),
    };
  }

  const user = await getSessionUser();
  if (!user) {
    return {
      response: NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 }),
    };
  }

  if (requiredRoles && !requiredRoles.includes(user.role)) {
    return {
      response: NextResponse.json(
        { ok: false, error: "Your role does not allow this action." },
        { status: 403 },
      ),
    };
  }

  return { user };
}

export async function requireApiAuth(): Promise<NextResponse | null> {
  const auth = await authorizeApi();
  return "response" in auth ? auth.response : null;
}

export async function requirePageUser(): Promise<SessionUser> {
  if (!isAuthEnabled()) redirect("/login");

  const user = await getSessionUser();
  if (!user) redirect("/login");

  return user;
}

export async function requirePageRole(requiredRoles: Role[]): Promise<SessionUser> {
  const user = await requirePageUser();
  if (!requiredRoles.includes(user.role)) redirect("/");
  return user;
}

export async function requirePageAuth(): Promise<void> {
  await requirePageUser();
}
