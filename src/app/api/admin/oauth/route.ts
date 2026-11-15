import { z } from "zod";
import { authorizeApi } from "@/lib/guards";
import { DatabaseError, audit } from "@/lib/db";
import {
  getOAuthSummary,
  saveOAuthSettings,
  type OAuthSettingsInput,
} from "@/lib/oauth-settings";
import { fail, ok } from "@/lib/http";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const schema = z
  .object({
    enabled: z.boolean(),
    issuer: z.string().trim().max(500),
    clientId: z.string().trim().max(500),
    clientSecret: z.string().max(1000).optional(),
    providerName: z.string().trim().max(80).optional(),
    scopes: z.string().trim().max(500).optional(),
    allowedUsers: z.array(z.string().trim().min(1).max(254)).max(200).optional(),
    allowedGroups: z.array(z.string().trim().min(1).max(254)).max(200).optional(),
    tokenAuthMethod: z.enum(["basic", "post"]).optional(),
    defaultRole: z.enum(["viewer", "editor"]).optional(),
    autoProvision: z.boolean().optional(),
    redirectUri: z.string().trim().max(500).optional(),
  })
  .superRefine((value, ctx) => {
    if (!value.enabled) return;

    if (!value.issuer) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["issuer"],
        message: "Issuer URL is required.",
      });
    } else if (!/^https?:\/\//i.test(value.issuer)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["issuer"],
        message: "Issuer must start with http:// or https://.",
      });
    }

    if (!value.clientId) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["clientId"],
        message: "Client ID is required.",
      });
    }

    if (value.redirectUri && !/^https?:\/\//i.test(value.redirectUri)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["redirectUri"],
        message: "Redirect URI must start with http:// or https://.",
      });
    }
  });

function errorResponse(error: unknown) {
  if (error instanceof DatabaseError) {
    return fail("The database is unavailable.", 503);
  }
  console.error("[caddyweb] admin oauth:", error);
  return fail("Unexpected server error.", 500);
}

export async function GET() {
  const auth = await authorizeApi(["admin"]);
  if ("response" in auth) return auth.response;

  try {
    return ok({ oauth: await getOAuthSummary() });
  } catch (error) {
    return errorResponse(error);
  }
}

export async function PUT(request: Request) {
  const auth = await authorizeApi(["admin"]);
  if ("response" in auth) return auth.response;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return fail("Invalid request body.", 400);
  }

  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return fail("Please check the OAuth settings.", 422, {
      issues: Object.fromEntries(
        parsed.error.issues.map((issue) => [issue.path.join("."), issue.message]),
      ),
    });
  }

  const input: OAuthSettingsInput = {
    enabled: parsed.data.enabled,
    issuer: parsed.data.issuer,
    clientId: parsed.data.clientId,
    clientSecret: parsed.data.clientSecret,
    providerName: parsed.data.providerName || "SSO",
    scopes: parsed.data.scopes || "openid profile email",
    allowedUsers: parsed.data.allowedUsers ?? [],
    allowedGroups: parsed.data.allowedGroups ?? [],
    tokenAuthMethod: parsed.data.tokenAuthMethod ?? "basic",
    defaultRole: parsed.data.defaultRole ?? "viewer",
    autoProvision: parsed.data.autoProvision ?? true,
    redirectUri: parsed.data.redirectUri,
  };

  try {
    const summary = await saveOAuthSettings(input);
    audit(
      auth.user.username,
      "oauth.update",
      summary.providerName,
      summary.enabled ? "enabled" : "disabled",
    );
    return ok({ oauth: summary });
  } catch (error) {
    return errorResponse(error);
  }
}
