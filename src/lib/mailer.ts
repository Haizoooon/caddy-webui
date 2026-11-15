import nodemailer from "nodemailer";
import { getPool } from "./db";
import { getSmtpSettings, type SmtpSettings } from "./smtp-settings";

export class MailError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "MailError";
  }
}

export interface EmailLogEntry {
  id: number;
  recipient: string;
  subject: string;
  status: "sent" | "failed";
  error: string | null;
  createdAt: string;
}

function sanitizeHeader(value: string): string {
  return value.replace(/[\r\n]+/g, " ").trim();
}

function transportFor(settings: SmtpSettings) {
  return nodemailer.createTransport({
    host: settings.host,
    port: settings.port,
    secure: settings.security === "tls",
    requireTLS: settings.security === "starttls",
    ignoreTLS: settings.security === "none",
    auth:
      settings.username && settings.password
        ? { user: settings.username, pass: settings.password }
        : undefined,
    tls: { rejectUnauthorized: settings.rejectUnauthorized },
    connectionTimeout: 10000,
    greetingTimeout: 10000,
    socketTimeout: 15000,
  });
}

function fromHeader(settings: SmtpSettings): string {
  const name = sanitizeHeader(settings.fromName || "CaddyWeb").replace(/"/g, "");
  return `"${name}" <${sanitizeHeader(settings.fromEmail)}>`;
}

export async function logEmail(
  recipient: string,
  subject: string,
  status: "sent" | "failed",
  error?: string,
): Promise<void> {
  try {
    const pool = await getPool();
    await pool.execute(
      "INSERT INTO email_log (recipient, subject, status, error, created_at) VALUES (?, ?, ?, ?, ?)",
      [
        recipient.slice(0, 254),
        subject.slice(0, 300),
        status,
        error ? error.slice(0, 2000) : null,
        new Date().toISOString(),
      ],
    );
  } catch {
    // Logging must never break the send path.
  }
}

export async function sendEmail(input: {
  to: string;
  subject: string;
  text: string;
  html?: string;
}): Promise<void> {
  const settings = await getSmtpSettings();
  if (!settings.enabled || !settings.host || !settings.fromEmail) {
    throw new MailError("SMTP is not configured or disabled.");
  }

  const to = sanitizeHeader(input.to);
  const subject = sanitizeHeader(input.subject);

  try {
    await transportFor(settings).sendMail({
      from: fromHeader(settings),
      to,
      replyTo: settings.replyTo,
      subject,
      text: input.text,
      html: input.html,
    });
    await logEmail(to, subject, "sent");
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown mail error";
    await logEmail(to, subject, "failed", message);
    throw new MailError(message);
  }
}

export function validEmail(value: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

export async function sendTestEmail(to: string): Promise<void> {
  if (!validEmail(to)) throw new MailError("Enter a valid email address.");

  await sendEmail({
    to,
    subject: "CaddyWeb SMTP test",
    text: [
      "This is a test email from CaddyWeb.",
      "",
      "If you received it, the SMTP settings are working.",
      `Sent at ${new Date().toISOString()}.`,
    ].join("\n"),
    html: `<div style="font-family:Arial,sans-serif;color:#2c3e50">
      <h2 style="color:#1abc9c">CaddyWeb SMTP test</h2>
      <p>If you received this email, the SMTP settings are working.</p>
      <p style="color:#7f8c8d;font-size:12px">Sent at ${new Date().toISOString()}.</p>
    </div>`,
  });
}

export async function sendNotificationEmails(
  recipients: string[],
  subject: string,
  text: string,
): Promise<number> {
  const unique = Array.from(
    new Set(recipients.map((email) => email.trim().toLowerCase()).filter(validEmail)),
  );
  let sent = 0;

  const lines = text.split("\n");

  for (const recipient of unique) {
    try {
      await sendEmail({
        to: recipient,
        subject,
        text,
        html: `<div style="font-family:Arial,sans-serif;color:#2c3e50;line-height:1.6">
          <div style="border-left:4px solid #1abc9c;padding:8px 14px;background:#f4f8f9">
            <strong>${subject.replace(/</g, "&lt;")}</strong>
          </div>
          <div style="padding:12px 4px">
            ${lines.map((line) => `<p style="margin:4px 0">${line.replace(/</g, "&lt;")}</p>`).join("")}
          </div>
          <p style="color:#7f8c8d;font-size:12px">Sent by CaddyWeb · ${new Date().toISOString()}</p>
        </div>`,
      });
      sent += 1;
    } catch {
      // sendEmail already logged the failure for this recipient.
    }
  }

  return sent;
}

export async function recentEmails(limit = 10): Promise<EmailLogEntry[]> {
  const pool = await getPool();
  const [rows] = await pool.execute(
    "SELECT id, recipient, subject, status, error, created_at FROM email_log ORDER BY id DESC LIMIT ?",
    [limit],
  );

  return (
    rows as {
      id: number;
      recipient: string;
      subject: string;
      status: "sent" | "failed";
      error: string | null;
      created_at: string;
    }[]
  ).map((row) => ({
    id: Number(row.id),
    recipient: row.recipient,
    subject: row.subject,
    status: row.status,
    error: row.error,
    createdAt: row.created_at,
  }));
}
