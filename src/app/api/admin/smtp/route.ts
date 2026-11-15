import { z } from "zod";
import { authorizeApi } from "@/lib/guards";
import { DatabaseError, audit } from "@/lib/db";
import {
  getSmtpSummary,
  saveSmtpSettings,
  type SmtpSettingsInput,
} from "@/lib/smtp-settings";
import { recentEmails } from "@/lib/mailer";
import { fail, ok } from "@/lib/http";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const schema = z
  .object({
    enabled: z.boolean(),
    host: z.string().trim().max(255),
    port: z.number().int().min(1).max(65535),
    security: z.enum(["none", "starttls", "tls"]),
    username: z.string().trim().max(255),
    password: z.string().max(1000).optional(),
    fromEmail: z.string().trim().max(254),
    fromName: z.string().trim().max(120),
    replyTo: z.string().trim().max(254).optional(),
    rejectUnauthorized: z.boolean(),
  })
  .superRefine((value, ctx) => {
    if (!value.enabled) return;
    if (!value.host) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["host"],
        message: "SMTP host is required.",
      });
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.fromEmail)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["fromEmail"],
        message: "A valid sender email is required.",
      });
    }
    if (value.replyTo && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.replyTo)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["replyTo"],
        message: "Reply-to must be a valid email.",
      });
    }
  });

function errorResponse(error: unknown) {
  if (error instanceof DatabaseError) {
    return fail("The database is unavailable.", 503);
  }
  console.error("[caddyweb] admin smtp:", error);
  return fail("Unexpected server error.", 500);
}

export async function GET() {
  const auth = await authorizeApi(["admin"]);
  if ("response" in auth) return auth.response;

  try {
    return ok({ smtp: await getSmtpSummary(), emails: await recentEmails(10) });
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
    return fail("Please check the SMTP settings.", 422, {
      issues: Object.fromEntries(
        parsed.error.issues.map((issue) => [issue.path.join("."), issue.message]),
      ),
    });
  }

  const input: SmtpSettingsInput = {
    enabled: parsed.data.enabled,
    host: parsed.data.host,
    port: parsed.data.port,
    security: parsed.data.security,
    username: parsed.data.username,
    password: parsed.data.password,
    fromEmail: parsed.data.fromEmail,
    fromName: parsed.data.fromName || "CaddyWeb",
    replyTo: parsed.data.replyTo,
    rejectUnauthorized: parsed.data.rejectUnauthorized,
  };

  try {
    const summary = await saveSmtpSettings(input);
    audit(
      auth.user.username,
      "smtp.update",
      summary.host,
      summary.enabled ? "enabled" : "disabled",
    );
    return ok({ smtp: summary });
  } catch (error) {
    return errorResponse(error);
  }
}
