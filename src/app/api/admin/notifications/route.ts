import { z } from "zod";
import { authorizeApi } from "@/lib/guards";
import { DatabaseError, audit } from "@/lib/db";
import {
  getNotificationSettings,
  lastHealthCheck,
  notificationRecipientEmails,
  saveNotificationSettings,
  type NotificationSettings,
} from "@/lib/notifications-settings";
import { recentEmails } from "@/lib/mailer";
import { fail, ok } from "@/lib/http";
import { roles } from "@/lib/roles";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const schema = z.object({
  enabled: z.boolean(),
  intervalMinutes: z.number().int().min(1).max(1440),
  roles: z.array(z.enum(roles)).min(1),
  extraRecipients: z.array(z.string().trim().email()).max(100),
  events: z.object({
    caddyUnreachable: z.boolean(),
    caddyRecovered: z.boolean(),
    upstreamDown: z.boolean(),
    upstreamRecovered: z.boolean(),
  }),
});

function errorResponse(error: unknown) {
  if (error instanceof DatabaseError) {
    return fail("The database is unavailable.", 503);
  }
  console.error("[caddyweb] admin notifications:", error);
  return fail("Unexpected server error.", 500);
}

export async function GET() {
  const auth = await authorizeApi(["admin"]);
  if ("response" in auth) return auth.response;

  try {
    const settings = getNotificationSettings();
    return ok({
      notifications: settings,
      recipients: notificationRecipientEmails(settings),
      lastCheck: lastHealthCheck(),
      emails: recentEmails(10),
    });
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
    return fail("Please check the notification settings.", 422, {
      issues: Object.fromEntries(
        parsed.error.issues.map((issue) => [issue.path.join("."), issue.message]),
      ),
    });
  }

  try {
    const settings = saveNotificationSettings(parsed.data as NotificationSettings);
    audit(
      auth.user.username,
      "notifications.update",
      "email",
      settings.enabled ? "enabled" : "disabled",
    );
    return ok({ notifications: settings });
  } catch (error) {
    return errorResponse(error);
  }
}
