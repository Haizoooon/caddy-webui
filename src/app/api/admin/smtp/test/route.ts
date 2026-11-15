import { z } from "zod";
import { authorizeApi } from "@/lib/guards";
import { getSmtpSettings } from "@/lib/smtp-settings";
import { MailError, sendTestEmail } from "@/lib/mailer";
import { fail, ok } from "@/lib/http";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const schema = z.object({
  to: z.string().trim().email(),
});

export async function POST(request: Request) {
  const auth = await authorizeApi(["admin"]);
  if ("response" in auth) return auth.response;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return fail("Invalid request body.", 400);
  }

  const parsed = schema.safeParse(body);
  if (!parsed.success) return fail("Enter a valid email address.", 422);

  const settings = await getSmtpSettings();
  if (!settings.enabled || !settings.host || !settings.fromEmail) {
    return fail("Save and enable SMTP settings first.", 422);
  }

  try {
    await sendTestEmail(parsed.data.to);
    return ok({ message: `Test email sent to ${parsed.data.to}.` });
  } catch (error) {
    return fail(
      error instanceof MailError
        ? `SMTP test failed: ${error.message}`
        : "SMTP test failed.",
      502,
    );
  }
}
