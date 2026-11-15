"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  Activity,
  CheckCircle2,
  Mail,
  Play,
  Save,
  Send,
  TriangleAlert,
} from "lucide-react";
import { api, ClientApiError } from "@/lib/api-client";
import { roleLabels, roles, type Role } from "@/lib/roles";
import { formatDateTime } from "@/lib/utils";
import type { SmtpSummary } from "@/lib/smtp-settings";
import type {
  NotificationSettings,
} from "@/lib/notifications-settings";
import type { EmailLogEntry } from "@/lib/mailer";
import type { HealthCheckResult } from "@/lib/monitor";
import {
  Badge,
  Button,
  Card,
  CardHeader,
  Notice,
  Spinner,
} from "@/components/ui/primitives";
import { Field, Input, Select, Toggle } from "@/components/ui/form";
import { useToast } from "@/components/ui/toast";

interface SmtpForm {
  enabled: boolean;
  host: string;
  port: string;
  security: "none" | "starttls" | "tls";
  username: string;
  password: string;
  fromEmail: string;
  fromName: string;
  replyTo: string;
  rejectUnauthorized: boolean;
}

export function EmailNotificationsCard({
  smtp: initialSmtp,
  notifications: initialNotifications,
  recipients: initialRecipients,
  lastCheck: initialLastCheck,
  emails: initialEmails,
}: {
  smtp: SmtpSummary;
  notifications: NotificationSettings;
  recipients: string[];
  lastCheck: string | null;
  emails: EmailLogEntry[];
}) {
  const router = useRouter();
  const { push } = useToast();

  const [smtp, setSmtp] = useState<SmtpForm>({
    enabled: initialSmtp.enabled,
    host: initialSmtp.host,
    port: String(initialSmtp.port),
    security: initialSmtp.security,
    username: initialSmtp.username,
    password: "",
    fromEmail: initialSmtp.fromEmail,
    fromName: initialSmtp.fromName,
    replyTo: initialSmtp.replyTo ?? "",
    rejectUnauthorized: initialSmtp.rejectUnauthorized,
  });
  const [smtpBusy, setSmtpBusy] = useState(false);
  const [testTo, setTestTo] = useState(initialSmtp.fromEmail);
  const [testBusy, setTestBusy] = useState(false);

  const [notifications, setNotifications] =
    useState<NotificationSettings>(initialNotifications);
  const [notificationBusy, setNotificationBusy] = useState(false);
  const [checkBusy, setCheckBusy] = useState(false);
  const [checkResult, setCheckResult] = useState<HealthCheckResult | null>(null);
  const [emails, setEmails] = useState(initialEmails);
  const [lastCheck, setLastCheck] = useState(initialLastCheck);
  const [recipients, setRecipients] = useState(initialRecipients);

  function updateSmtp<K extends keyof SmtpForm>(key: K, value: SmtpForm[K]) {
    setSmtp((current) => ({ ...current, [key]: value }));
  }

  function updateNotifications<K extends keyof NotificationSettings>(
    key: K,
    value: NotificationSettings[K],
  ) {
    setNotifications((current) => ({ ...current, [key]: value }));
  }

  function toggleRole(role: Role) {
    setNotifications((current) => {
      const selected = current.roles.includes(role)
        ? current.roles.filter((entry) => entry !== role)
        : [...current.roles, role];
      return { ...current, roles: selected.length > 0 ? selected : current.roles };
    });
  }

  async function saveSmtp() {
    setSmtpBusy(true);
    try {
      await api("/api/admin/smtp", {
        method: "PUT",
        body: JSON.stringify({
          enabled: smtp.enabled,
          host: smtp.host,
          port: Number(smtp.port),
          security: smtp.security,
          username: smtp.username,
          password: smtp.password || undefined,
          fromEmail: smtp.fromEmail,
          fromName: smtp.fromName,
          replyTo: smtp.replyTo || undefined,
          rejectUnauthorized: smtp.rejectUnauthorized,
        }),
      });
      setSmtp((current) => ({ ...current, password: "" }));
      push({ tone: "success", title: "SMTP settings saved" });
      router.refresh();
    } catch (error) {
      push({
        tone: "danger",
        title: "Could not save SMTP settings",
        description:
          error instanceof ClientApiError || error instanceof Error
            ? error.message
            : "Unknown error",
      });
    } finally {
      setSmtpBusy(false);
    }
  }

  async function sendTest() {
    setTestBusy(true);
    try {
      const result = await api<{ ok: true; message: string }>(
        "/api/admin/smtp/test",
        {
          method: "POST",
          body: JSON.stringify({ to: testTo }),
        },
      );
      push({ tone: "success", title: "Test email sent", description: result.message });
      const refreshed = await api<{ ok: true; emails: EmailLogEntry[] }>(
        "/api/admin/smtp",
      );
      setEmails(refreshed.emails);
    } catch (error) {
      push({
        tone: "danger",
        title: "SMTP test failed",
        description: error instanceof Error ? error.message : "Unknown error",
      });
    } finally {
      setTestBusy(false);
    }
  }

  async function saveNotifications() {
    setNotificationBusy(true);
    try {
      const result = await api<{
        ok: true;
        notifications: NotificationSettings;
      }>("/api/admin/notifications", {
        method: "PUT",
        body: JSON.stringify({
          enabled: notifications.enabled,
          intervalMinutes: Number(notifications.intervalMinutes),
          roles: notifications.roles,
          extraRecipients: notifications.extraRecipients,
          events: notifications.events,
        }),
      });
      setNotifications(result.notifications);
      const refreshed = await api<{
        ok: true;
        recipients: string[];
        lastCheck: string | null;
        emails: EmailLogEntry[];
      }>("/api/admin/notifications");
      setRecipients(refreshed.recipients);
      setLastCheck(refreshed.lastCheck);
      setEmails(refreshed.emails);
      push({ tone: "success", title: "Notification settings saved" });
      router.refresh();
    } catch (error) {
      push({
        tone: "danger",
        title: "Could not save notifications",
        description: error instanceof Error ? error.message : "Unknown error",
      });
    } finally {
      setNotificationBusy(false);
    }
  }

  async function runCheck() {
    setCheckBusy(true);
    try {
      const result = await api<{
        ok: true;
        check: HealthCheckResult;
        emails: EmailLogEntry[];
      }>("/api/admin/notifications/check", { method: "POST" });
      setCheckResult(result.check);
      setEmails(result.emails);
      setLastCheck(result.check.checkedAt ?? lastCheck);
      push({
        tone: result.check.ok ? "success" : "warning",
        title: result.check.ok
          ? result.check.caddyUp
            ? "Health check completed"
            : "Caddy is unreachable"
          : "Health check skipped",
        description: result.check.skipped
          ? `Reason: ${result.check.skipped}`
          : `${result.check.notificationsSent} notification email(s) sent.`,
      });
      router.refresh();
    } catch (error) {
      push({
        tone: "danger",
        title: "Health check failed",
        description: error instanceof Error ? error.message : "Unknown error",
      });
    } finally {
      setCheckBusy(false);
    }
  }

  return (
    <div className="mt-6 space-y-6">
      <Card>
        <CardHeader
          title="SMTP"
          description="Outgoing mail server used for alerts and test messages."
          action={
            <Badge tone={initialSmtp.source === "database" ? "info" : "muted"}>
              {initialSmtp.source === "database"
                ? "Database"
                : initialSmtp.source === "env"
                  ? "Environment"
                  : "Not configured"}
            </Badge>
          }
        />
        <div className="space-y-5 p-4">
          <div className="flex items-start justify-between gap-4 rounded-[3px] border border-line bg-cloud/40 p-3">
            <div>
              <p className="flex items-center gap-1.5 text-sm font-bold text-ink">
                <Mail className="h-4 w-4 text-primary-ink" aria-hidden />
                Enable email delivery
              </p>
              <p className="mt-0.5 text-xs text-muted">
                Tests and health alerts use these settings. The password is encrypted.
              </p>
            </div>
            <Toggle
              checked={smtp.enabled}
              onChange={(next) => updateSmtp("enabled", next)}
              label=""
              ariaLabel="Enable SMTP"
            />
          </div>

          <div className="grid gap-4 sm:grid-cols-[1fr_110px_150px]">
            <Field label="SMTP host" htmlFor="smtpHost">
              <Input
                id="smtpHost"
                value={smtp.host}
                onChange={(event) => updateSmtp("host", event.target.value)}
                placeholder="smtp.example.com"
                spellCheck={false}
              />
            </Field>
            <Field label="Port" htmlFor="smtpPort">
              <Input
                id="smtpPort"
                type="number"
                min={1}
                max={65535}
                value={smtp.port}
                onChange={(event) => updateSmtp("port", event.target.value)}
              />
            </Field>
            <Field label="Security" htmlFor="smtpSecurity">
              <Select
                id="smtpSecurity"
                value={smtp.security}
                onChange={(event) =>
                  updateSmtp("security", event.target.value as SmtpForm["security"])
                }
              >
                <option value="starttls">STARTTLS</option>
                <option value="tls">Implicit TLS</option>
                <option value="none">No TLS</option>
              </Select>
            </Field>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Username" htmlFor="smtpUsername" optional>
              <Input
                id="smtpUsername"
                value={smtp.username}
                onChange={(event) => updateSmtp("username", event.target.value)}
                autoComplete="off"
                spellCheck={false}
              />
            </Field>
            <Field
              label="Password"
              htmlFor="smtpPassword"
              optional
              hint={initialSmtp.hasPassword ? "Stored. Leave blank to keep." : undefined}
            >
              <Input
                id="smtpPassword"
                type="password"
                autoComplete="new-password"
                value={smtp.password}
                onChange={(event) => updateSmtp("password", event.target.value)}
                placeholder={initialSmtp.hasPassword ? "••••••••" : "Password"}
              />
            </Field>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="From email" htmlFor="smtpFromEmail">
              <Input
                id="smtpFromEmail"
                type="email"
                value={smtp.fromEmail}
                onChange={(event) => updateSmtp("fromEmail", event.target.value)}
                placeholder="caddyweb@example.com"
              />
            </Field>
            <Field label="From name" htmlFor="smtpFromName">
              <Input
                id="smtpFromName"
                value={smtp.fromName}
                onChange={(event) => updateSmtp("fromName", event.target.value)}
                placeholder="CaddyWeb"
              />
            </Field>
          </div>

          <Field label="Reply-to" htmlFor="smtpReplyTo" optional>
            <Input
              id="smtpReplyTo"
              type="email"
              value={smtp.replyTo}
              onChange={(event) => updateSmtp("replyTo", event.target.value)}
              placeholder="admin@example.com"
            />
          </Field>

          <Toggle
            checked={smtp.rejectUnauthorized}
            onChange={(next) => updateSmtp("rejectUnauthorized", next)}
            label="Verify TLS certificates"
            description="Disable only for a self-signed SMTP relay you trust."
          />

          <div className="flex flex-wrap items-end justify-between gap-3 border-t border-line pt-4">
            <div className="flex flex-wrap items-end gap-2">
              <Field label="Send test to" htmlFor="smtpTestTo">
                <Input
                  id="smtpTestTo"
                  type="email"
                  value={testTo}
                  onChange={(event) => setTestTo(event.target.value)}
                  placeholder="you@example.com"
                />
              </Field>
              <Button variant="outline" onClick={sendTest} disabled={testBusy}>
                {testBusy ? <Spinner /> : <Send className="h-4 w-4" aria-hidden />}
                Test
              </Button>
            </div>
            <Button onClick={saveSmtp} disabled={smtpBusy}>
              {smtpBusy ? <Spinner /> : <Save className="h-4 w-4" aria-hidden />}
              Save SMTP
            </Button>
          </div>
        </div>
      </Card>

      <Card>
        <CardHeader
          title="Health alerts"
          description="Background monitor for Caddy and reverse-proxy upstreams."
          action={
            <Badge tone={notifications.enabled ? "success" : "muted"}>
              {notifications.enabled ? "Enabled" : "Disabled"}
            </Badge>
          }
        />
        <div className="space-y-5 p-4">
          <div className="flex items-start justify-between gap-4 rounded-[3px] border border-line bg-cloud/40 p-3">
            <div>
              <p className="flex items-center gap-1.5 text-sm font-bold text-ink">
                <Activity className="h-4 w-4 text-primary-ink" aria-hidden />
                Send email alerts
              </p>
              <p className="mt-0.5 text-xs text-muted">
                Only state changes are emailed, not every check.
              </p>
            </div>
            <Toggle
              checked={notifications.enabled}
              onChange={(next) => updateNotifications("enabled", next)}
              label=""
              ariaLabel="Enable health alerts"
            />
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Check interval" htmlFor="notificationInterval" hint="Minutes between checks.">
              <Input
                id="notificationInterval"
                type="number"
                min={1}
                max={1440}
                value={notifications.intervalMinutes}
                onChange={(event) =>
                  updateNotifications("intervalMinutes", Number(event.target.value))
                }
              />
            </Field>
            <Field
              label="Extra recipients"
              htmlFor="notificationExtra"
              hint="Comma separated email addresses."
            >
              <Input
                id="notificationExtra"
                value={notifications.extraRecipients.join(", ")}
                onChange={(event) =>
                  updateNotifications(
                    "extraRecipients",
                    event.target.value
                      .split(/[\s,]+/)
                      .map((value) => value.trim())
                      .filter(Boolean),
                  )
                }
                placeholder="oncall@example.com"
              />
            </Field>
          </div>

          <div>
            <p className="mb-2 text-xs font-bold tracking-wide text-ink-soft uppercase">
              Notify users with roles
            </p>
            <div className="flex flex-wrap gap-2">
              {roles.map((role) => {
                const selected = notifications.roles.includes(role);
                return (
                  <button
                    key={role}
                    type="button"
                    onClick={() => toggleRole(role)}
                    className={
                      selected
                        ? "rounded-[3px] border border-primary bg-primary/10 px-2.5 py-1.5 text-xs font-bold text-primary-ink"
                        : "rounded-[3px] border border-line px-2.5 py-1.5 text-xs font-semibold text-muted hover:bg-cloud"
                    }
                  >
                    {roleLabels[role]}
                  </button>
                );
              })}
            </div>
            <p className="mt-1.5 text-xs text-muted">
              Users need an email and notifications enabled in their profile. Currently{" "}
              {recipients.length} recipient{recipients.length === 1 ? "" : "s"}.
            </p>
          </div>

          <div className="grid gap-3 border-t border-line pt-4 sm:grid-cols-2">
            <Toggle
              checked={notifications.events.caddyUnreachable}
              onChange={(next) =>
                updateNotifications("events", {
                  ...notifications.events,
                  caddyUnreachable: next,
                })
              }
              label="Caddy unreachable"
              description="Caddy Admin API stops responding."
            />
            <Toggle
              checked={notifications.events.caddyRecovered}
              onChange={(next) =>
                updateNotifications("events", {
                  ...notifications.events,
                  caddyRecovered: next,
                })
              }
              label="Caddy recovered"
              description="Admin API responds again."
            />
            <Toggle
              checked={notifications.events.upstreamDown}
              onChange={(next) =>
                updateNotifications("events", {
                  ...notifications.events,
                  upstreamDown: next,
                })
              }
              label="Upstream unhealthy"
              description="A reverse-proxy upstream reports failures."
            />
            <Toggle
              checked={notifications.events.upstreamRecovered}
              onChange={(next) =>
                updateNotifications("events", {
                  ...notifications.events,
                  upstreamRecovered: next,
                })
              }
              label="Upstream recovered"
              description="Failures return to zero."
            />
          </div>

          {checkResult ? (
            <Notice
              tone={checkResult.ok ? (checkResult.caddyUp ? "success" : "warning") : "warning"}
              title={
                checkResult.skipped
                  ? `Check skipped (${checkResult.skipped})`
                  : checkResult.caddyUp
                    ? "Caddy is reachable"
                    : "Caddy is unreachable"
              }
            >
              {checkResult.ok ? (
                <span>
                  {checkResult.upstreams.length} upstream
                  {checkResult.upstreams.length === 1 ? "" : "s"} checked ·{" "}
                  {checkResult.notificationsSent} email
                  {checkResult.notificationsSent === 1 ? "" : "s"} sent ·{" "}
                  {checkResult.recipients} recipient
                  {checkResult.recipients === 1 ? "" : "s"}
                </span>
              ) : null}
            </Notice>
          ) : null}

          <div className="flex flex-wrap items-center justify-between gap-3 border-t border-line pt-4">
            <p className="text-xs text-muted">
              Last check:{" "}
              {lastCheck ? formatDateTime(lastCheck) : "never"}
            </p>
            <div className="flex gap-2">
              <Button variant="outline" onClick={runCheck} disabled={checkBusy}>
                {checkBusy ? <Spinner /> : <Play className="h-4 w-4" aria-hidden />}
                Run check now
              </Button>
              <Button onClick={saveNotifications} disabled={notificationBusy}>
                {notificationBusy ? <Spinner /> : <Save className="h-4 w-4" aria-hidden />}
                Save alerts
              </Button>
            </div>
          </div>
        </div>
      </Card>

      <Card>
        <CardHeader
          title="Recent emails"
          description="Last 10 delivery attempts, including failures."
          action={<Badge tone="muted">{emails.length}</Badge>}
        />
        {emails.length === 0 ? (
          <p className="p-4 text-sm text-muted">No email has been sent yet.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[620px] text-left text-sm">
              <thead className="border-b border-line bg-cloud/50 text-[10px] font-bold tracking-[0.1em] text-muted uppercase">
                <tr>
                  <th className="px-4 py-2.5 font-bold">Recipient</th>
                  <th className="px-3 py-2.5 font-bold">Subject</th>
                  <th className="px-3 py-2.5 font-bold">Status</th>
                  <th className="px-4 py-2.5 font-bold">Time</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {emails.map((email) => (
                  <tr key={email.id}>
                    <td className="px-4 py-2.5 text-xs text-ink-soft">{email.recipient}</td>
                    <td className="max-w-[280px] truncate px-3 py-2.5 text-xs text-ink-soft">
                      {email.subject}
                    </td>
                    <td className="px-3 py-2.5">
                      {email.status === "sent" ? (
                        <Badge tone="success">
                          <CheckCircle2 className="h-3 w-3" aria-hidden />
                          Sent
                        </Badge>
                      ) : (
                        <Badge tone="danger">
                          <TriangleAlert className="h-3 w-3" aria-hidden />
                          Failed
                        </Badge>
                      )}
                    </td>
                    <td className="px-4 py-2.5 text-xs text-muted">
                      {formatDateTime(email.createdAt)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  );
}
