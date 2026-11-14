import { SignJWT, jwtVerify } from "jose";

export const SESSION_COOKIE = "caddyweb_session";
export const SESSION_MAX_AGE = 60 * 60 * 24 * 7;

/** Authentication is mandatory. Without APP_PASSWORD the panel stays locked. */
export function isAuthEnabled(): boolean {
  return Boolean(process.env.APP_PASSWORD);
}

export function appUsername(): string {
  const value = (process.env.APP_USERNAME || "admin").trim();
  return value || "admin";
}

function secretKey(): Uint8Array {
  const secret =
    process.env.AUTH_SECRET ||
    process.env.APP_PASSWORD ||
    "caddyweb-development-secret-do-not-use-in-production";
  return new TextEncoder().encode(secret);
}

export async function createSessionToken(username: string): Promise<string> {
  return new SignJWT({ role: "admin", username })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(`${SESSION_MAX_AGE}s`)
    .sign(secretKey());
}

export async function verifySessionToken(
  token: string | undefined,
): Promise<{ username: string } | null> {
  if (!token) return null;

  try {
    const { payload } = await jwtVerify(token, secretKey());
    return {
      username: typeof payload.username === "string" ? payload.username : appUsername(),
    };
  } catch {
    return null;
  }
}

export function shouldUseSecureCookie(request?: Request): boolean {
  if (process.env.COOKIE_SECURE === "true") return true;
  if (!request) return false;
  if (request.headers.get("x-forwarded-proto") === "https") return true;

  try {
    return new URL(request.url).protocol === "https:";
  } catch {
    return false;
  }
}

export function sessionCookieOptions(request?: Request) {
  return {
    httpOnly: true,
    sameSite: "lax" as const,
    path: "/",
    maxAge: SESSION_MAX_AGE,
    secure: shouldUseSecureCookie(request),
  };
}
