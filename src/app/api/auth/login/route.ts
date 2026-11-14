import { createHash, timingSafeEqual } from "node:crypto";
import {
  appUsername,
  createSessionToken,
  isAuthEnabled,
  SESSION_COOKIE,
  sessionCookieOptions,
} from "@/lib/session";
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

  const userMatches =
    username.length > 0 &&
    safeEqual(username.toLowerCase(), expectedUser.toLowerCase());
  const passwordMatches =
    password.length > 0 &&
    expectedPassword.length > 0 &&
    safeEqual(password, expectedPassword);

  if (!userMatches || !passwordMatches) {
    return fail("Incorrect username or password.", 401);
  }

  resetRateLimit(`login:${ip}`);

  const token = await createSessionToken(expectedUser);
  const response = ok({ username: expectedUser });
  response.cookies.set(SESSION_COOKIE, token, sessionCookieOptions(request));
  return response;
}
