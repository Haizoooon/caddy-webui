import { NextResponse, type NextRequest } from "next/server";
import { isAuthEnabled, SESSION_COOKIE } from "@/lib/session";

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  if (pathname === "/login" || pathname === "/api/auth/login") {
    return NextResponse.next();
  }

  // Locked until an operator configures APP_PASSWORD. Never expose the panel
  // in an "open" mode by accident.
  if (!isAuthEnabled()) {
    if (pathname.startsWith("/api/")) {
      return NextResponse.json(
        {
          ok: false,
          error:
            "CaddyWeb is not configured. Set APP_PASSWORD (and optionally APP_USERNAME) and restart the container.",
        },
        { status: 503 },
      );
    }

    const url = request.nextUrl.clone();
    url.pathname = "/login";
    url.search = "";
    return NextResponse.redirect(url);
  }

  // A lightweight presence check runs on the edge. The cookie signature is
  // verified in the app layout and in every API route (Node runtime), where
  // the environment is guaranteed to be available.
  if (request.cookies.get(SESSION_COOKIE)?.value) {
    return NextResponse.next();
  }

  if (pathname.startsWith("/api/")) {
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }

  const url = request.nextUrl.clone();
  url.pathname = "/login";
  url.search = "";
  return NextResponse.redirect(url);
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|icon\\.svg|icon-192\\.png|icon-512\\.png|apple-touch-icon\\.png|manifest\\.webmanifest).*)",
  ],
};
