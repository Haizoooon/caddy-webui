import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import {
  assertOAuthAccess,
  exchangeCode,
  getOidcDiscovery,
  oauthBaseUrl,
  oidcConfig,
  OAuthError,
  statesMatch,
  verifyIdToken,
} from "@/lib/oauth";
import { getOAuthSettings } from "@/lib/oauth-settings";
import { upsertOidcUser } from "@/lib/users";
import {
  createSessionToken,
  isAuthEnabled,
  OAUTH_STATE_COOKIE,
  oauthStateCookieOptions,
  SESSION_COOKIE,
  sessionCookieOptions,
  verifyOAuthStateToken,
} from "@/lib/session";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const errorCodes = {
  config: "oauth_config",
  discovery: "oauth_unavailable",
  state: "oauth_state",
  token: "oauth_token",
  identity: "oauth_identity",
  forbidden: "oauth_forbidden",
} as const;

function loginError(request: Request, code: string) {
  const response = NextResponse.redirect(
    new URL(`/login?error=${code}`, oauthBaseUrl(request)),
  );
  response.cookies.set(OAUTH_STATE_COOKIE, "", {
    ...oauthStateCookieOptions(request),
    maxAge: 0,
  });
  response.headers.set("Cache-Control", "no-store");
  return response;
}

export async function GET(request: Request) {
  const url = new URL(request.url);

  if (!isAuthEnabled()) {
    return NextResponse.redirect(new URL("/login", oauthBaseUrl(request)));
  }

  if (url.searchParams.get("error")) {
    return loginError(request, "oauth_denied");
  }

  const config = oidcConfig();
  if (!config) return loginError(request, "oauth_config");

  const code = url.searchParams.get("code") ?? "";
  const state = url.searchParams.get("state") ?? "";

  const cookieStore = await cookies();
  const stored = await verifyOAuthStateToken(
    cookieStore.get(OAUTH_STATE_COOKIE)?.value,
  );

  if (!code || !state || !stored || !statesMatch(stored.state, state)) {
    return loginError(request, "oauth_state");
  }

  try {
    const discovery = await getOidcDiscovery(config);
    const tokens = await exchangeCode(discovery, config, {
      code,
      verifier: stored.verifier,
      redirectUri: stored.redirectUri,
    });

    const identity = await verifyIdToken(
      discovery,
      config,
      tokens.idToken,
      stored.nonce,
    );

    assertOAuthAccess(identity, config);

    const settings = getOAuthSettings();
    const user = upsertOidcUser(
      identity,
      discovery.issuer,
      settings.defaultRole,
      settings.autoProvision,
    );

    if (!user) {
      throw new OAuthError("forbidden", "This account is not allowed to use the panel.");
    }

    const session = await createSessionToken({
      username: user.username,
      role: user.role,
      userId: user.id,
      provider: "oidc",
    });
    const response = NextResponse.redirect(new URL("/", oauthBaseUrl(request)));
    response.cookies.set(SESSION_COOKIE, session, sessionCookieOptions(request));
    response.cookies.set(OAUTH_STATE_COOKIE, "", {
      ...oauthStateCookieOptions(request),
      maxAge: 0,
    });
    response.headers.set("Cache-Control", "no-store");
    return response;
  } catch (error) {
    const code =
      error instanceof OAuthError ? errorCodes[error.code] : "oauth_unavailable";
    return loginError(request, code);
  }
}
