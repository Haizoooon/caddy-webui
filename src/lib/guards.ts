import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { redirect } from "next/navigation";
import { isAuthEnabled, SESSION_COOKIE, verifySessionToken } from "./session";

export async function requireApiAuth(): Promise<NextResponse | null> {
  if (!isAuthEnabled()) {
    return NextResponse.json(
      {
        ok: false,
        error:
          "CaddyWeb is not configured. Set APP_PASSWORD (and optionally APP_USERNAME) and restart the container.",
      },
      { status: 503 },
    );
  }

  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  if (await verifySessionToken(token)) return null;

  return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
}

export async function requirePageAuth(): Promise<void> {
  // Fail closed: an unconfigured panel must never be usable without a login.
  if (!isAuthEnabled()) redirect("/login");

  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  if (await verifySessionToken(token)) return;

  redirect("/login");
}
