import { createHash, timingSafeEqual } from "node:crypto";
import {
  appUsername,
  createSessionToken,
  isAuthEnabled,
  SESSION_COOKIE,
  sessionCookieOptions,
} from "@/lib/session";
import {
  authenticateUser,
  ensureEnvAdmin,
  touchLogin,
} from "@/lib/users";
import { clientIp, fail, ok } from "@/lib/http";
import { rateLimit, resetRateLimit } from "@/lib/rate-limit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function safeEqual(left: string, right: string): boolean {
  const a = createHash("sha256").update(left).digest();
  const b = createHash("sha256").update(right).digest();
  return timingSafeEqual(a, b);
}

export async function POST(request: Request) {
  if (!isAuthEnabled()) {
    return fail(
      "CaddyWeb is not configured. Set APP_PASSWORD (and optionally APP_USERNAME) and restart the container.",
      503,
    );
  }

  const ip = clientIp(request);
  const limit = rateLimit(`login:${ip}`, 10, 5 * 60 * 1000);
  if (!limit.allowed) {
    return fail(
      `Too many attempts. Try again in ${limit.retryAfterSeconds} seconds.`,
      429,
    );
  }

  let body: { username?: unknown; password?: unknown } = {};
  try {
    body = (await request.json()) as { username?: unknown; password?: unknown };
  } catch {
    return fail("Invalid request body.", 400);
  }

  const username = typeof body.username === "string" ? body.username.trim() : "";
  const password = typeof body.password === "string" ? body.password : "";
  const expectedUser = appUsername();
  const expectedPassword = process.env.APP_PASSWORD ?? "";

  const envMatches =
    username.length > 0 &&
    expectedPassword.length > 0 &&
    safeEqual(username.toLowerCase(), expectedUser.toLowerCase()) &&
    safeEqual(password, expectedPassword);

  let user = null;
  let provider: "password" | "env" = "password";

  if (envMatches) {
    provider = "env";
    try {
      user = ensureEnvAdmin();
      if (user) touchLogin(user.id);
    } catch {
      // The environment admin remains usable even if the database fails.
      user = null;
    }
  } else {
    try {
      user = authenticateUser(username, password);
      if (user) {
        touchLogin(user.id);
        provider = "password";
      }
    } catch {
      user = null;
    }
  }

  if (!user && !envMatches) {
    return fail("Incorrect username or password.", 401);
  }

  resetRateLimit(`login:${ip}`);

  const payload = user
    ? {
        username: user.username,
        role: user.role,
        userId: user.id,
        provider,
      }
    : {
        username: expectedUser,
        role: "admin" as const,
        provider: "env" as const,
      };

  const token = await createSessionToken(payload);
  const response = ok({ username: payload.username, role: payload.role });
  response.cookies.set(SESSION_COOKIE, token, sessionCookieOptions(request));
  return response;
}
