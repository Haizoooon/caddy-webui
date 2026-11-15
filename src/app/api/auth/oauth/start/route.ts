import { NextResponse } from "next/server";
import {
  authorizationUrl,
  createPkce,
  getOidcDiscovery,
  oauthBaseUrl,
  oauthRedirectUri,
  oidcConfig,
  randomToken,
} from "@/lib/oauth";
import {
  createOAuthStateToken,
  isAuthEnabled,
  OAUTH_STATE_COOKIE,
  oauthStateCookieOptions,
} from "@/lib/session";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  if (!isAuthEnabled()) {
    return NextResponse.redirect(new URL("/login", oauthBaseUrl(request)));
  }

  const config = oidcConfig();

  if (!config) {
    return NextResponse.redirect(
      new URL("/login?error=oauth_config", oauthBaseUrl(request)),
    );
  }

  try {
    const discovery = await getOidcDiscovery(config);
    const redirectUri = oauthRedirectUri(request, config);
    const state = randomToken();
    const nonce = randomToken();
    const { verifier, challenge } = createPkce();

    const signedState = await createOAuthStateToken({
      state,
      verifier,
      nonce,
      redirectUri,
    });

    const target = authorizationUrl(discovery, config, {
      redirectUri,
      state,
      nonce,
      challenge,
    });

    const response = NextResponse.redirect(target);
    response.cookies.set(
      OAUTH_STATE_COOKIE,
      signedState,
      oauthStateCookieOptions(request),
    );
    response.headers.set("Cache-Control", "no-store");
    return response;
  } catch {
    return NextResponse.redirect(
      new URL("/login?error=oauth_unavailable", oauthBaseUrl(request)),
    );
  }
}
