import { NextResponse } from "next/server";
import type { Role } from "./roles";
import { authenticateApiToken } from "./users";
import { getSessionUser, type SessionUser } from "./guards";

export type ApiOrTokenAuthorization =
  | { user: SessionUser; tokenId?: number }
  | { response: NextResponse };

/**
 * Accepts either an API token (`Authorization: Bearer cw_…`) or a signed-in
 * session cookie. Role checks are applied to both.
 */
export async function authorizeApiOrToken(
  request: Request,
  requiredRoles?: Role[],
): Promise<ApiOrTokenAuthorization> {
  const header = request.headers.get("authorization") || "";
  const bearer = /^Bearer\s+(.+)$/i.exec(header);

  if (bearer) {
    try {
      const result = authenticateApiToken(bearer[1].trim());
      if (!result) {
        return {
          response: NextResponse.json(
            { ok: false, error: "Invalid or expired API token." },
            { status: 401 },
          ),
        };
      }

      if (requiredRoles && !requiredRoles.includes(result.user.role)) {
        return {
          response: NextResponse.json(
            { ok: false, error: "This token's role does not allow the action." },
            { status: 403 },
          ),
        };
      }

      return {
        user: {
          userId: result.user.id,
          username: result.user.username,
          role: result.user.role,
          provider: "api",
        },
        tokenId: result.tokenId,
      };
    } catch {
      return {
        response: NextResponse.json(
          { ok: false, error: "Database unavailable." },
          { status: 503 },
        ),
      };
    }
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
