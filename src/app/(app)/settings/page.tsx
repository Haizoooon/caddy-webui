import Link from "next/link";
import type { Metadata } from "next";
import { BookOpen, ExternalLink, ShieldCheck, TerminalSquare } from "lucide-react";
import { publicAdminUrl } from "@/lib/caddy/admin";
import { appUsername, isAuthEnabled } from "@/lib/session";
import { getOAuthSummary } from "@/lib/oauth-settings";
import { getPreferences } from "@/lib/preferences-server";
import { requirePageUser } from "@/lib/guards";
import { isAdmin } from "@/lib/roles";
import { APP_VERSION } from "@/lib/version";
import {
  Badge,
  Card,
  CardHeader,
  CodeBlock,
  KeyValue,
  Notice,
  PageHeader,
} from "@/components/ui/primitives";
import { DatabaseCard } from "@/components/settings/database-card";
import { OAuthSettingsForm } from "@/components/settings/oauth-settings-form";
import { PreferencesCard } from "@/components/settings/preferences-card";
import { SignOutButton } from "@/components/settings/sign-out-button";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Settings" };

export default async function SettingsPage() {
  const user = await requirePageUser();
  const admin = isAdmin(user.role);
  const preferences = await getPreferences();
  const authEnabled = isAuthEnabled();
  const username = appUsername();
  const httpPort = process.env.CADDY_HTTP_PORT || "80";
  const httpsPort = process.env.CADDY_HTTPS_PORT || "443";
  const adminUrl = publicAdminUrl();
  const hasAdminAuth = Boolean(process.env.CADDY_ADMIN_USER);
  const oauth = admin ? getOAuthSummary() : null;
  const callbackBase = (process.env.APP_URL || "").trim().replace(/\/+$/, "");
  const oauthCallbackUrl = callbackBase
    ? `${callbackBase}/api/auth/oauth/callback`
    : "/api/auth/oauth/callback";

  return (
    <div>
      <PageHeader
        title="Settings"
        description="Appearance, site defaults and server-side configuration. Preferences are stored in this browser."
        actions={authEnabled ? <SignOutButton /> : undefined}
      />

      <div className="mb-6">
        <PreferencesCard initial={preferences} />
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader
            title="Connection"
            description="How CaddyWeb reaches the Caddy Admin API."
            action={
              <Badge tone={hasAdminAuth ? "success" : "muted"}>
                {hasAdminAuth ? "Auth header" : "No auth header"}
              </Badge>
            }
          />
          <dl className="px-4 py-2">
            <KeyValue label="Admin URL">
              <code className="font-mono text-xs">{adminUrl}</code>
            </KeyValue>
            <KeyValue label="HTTP port">{httpPort}</KeyValue>
            <KeyValue label="HTTPS port">{httpsPort}</KeyValue>
            <KeyValue label="Admin credentials">{hasAdminAuth ? "Configured" : "None"}</KeyValue>
          </dl>
          <div className="border-t border-line px-4 py-3">
            <p className="text-xs leading-relaxed text-muted">
              Change <code className="font-mono text-ink-soft">CADDY_ADMIN_URL</code>,{" "}
              <code className="font-mono text-ink-soft">CADDY_ADMIN_USER</code> and{" "}
              <code className="font-mono text-ink-soft">CADDY_ADMIN_PASSWORD</code> in{" "}
              <code className="font-mono text-ink-soft">.env.local</code>, then restart the app.
            </p>
          </div>
        </Card>

        <Card>
          <CardHeader
            title="Panel security"
            description="Authentication is mandatory for every page and API route."
            action={
              <Badge tone={authEnabled ? "success" : "danger"}>
                {authEnabled ? "Username + password" : "Locked"}
              </Badge>
            }
          />
          <dl className="px-4 py-2">
            <KeyValue label="APP_USERNAME">{username}</KeyValue>
            <KeyValue label="APP_PASSWORD">{authEnabled ? "Configured" : "Not set"}</KeyValue>
            <KeyValue label="Session">
              {authEnabled ? "Signed JWT cookie (7 days, HttpOnly)" : "No access"}
            </KeyValue>
            <KeyValue label="Cookie secure flag">
              {process.env.COOKIE_SECURE === "true" ? "Always" : "Auto-detect HTTPS"}
            </KeyValue>
          </dl>
          {!authEnabled ? (
            <div className="border-t border-line p-4">
              <Notice tone="danger" title="The panel is locked">
                The app has no open mode. Set <code className="font-mono">APP_PASSWORD</code> in
                the container environment and restart it. Until then, the login screen shows the
                setup instructions and all API routes return 503.
              </Notice>
            </div>
          ) : (
            <div className="border-t border-line p-4">
              <p className="flex items-start gap-2 text-xs leading-relaxed text-muted">
                <ShieldCheck className="mt-0.5 h-3.5 w-3.5 shrink-0 text-success-ink" aria-hidden />
                Sessions are HttpOnly and expire after seven days. Failed logins are rate limited
                per IP address. Configure credentials through environment variables only.
              </p>
            </div>
          )}
        </Card>
      </div>

      {admin ? (
        <>
          {oauth ? (
            <OAuthSettingsForm initial={oauth} callbackUrl={oauthCallbackUrl} />
          ) : null}
          <DatabaseCard />
        </>
      ) : (
        <div className="mt-6">
          <Notice tone="info" title="Administrator settings are hidden">
            User accounts, API tokens, OAuth and database settings are available to Admins.
            Your preferences above can still be changed.
          </Notice>
        </div>
      )}

      <div className="mt-6 grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader
            title="Running Caddy"
            description="CaddyWeb expects an admin API it can write to."
            action={<TerminalSquare className="h-4 w-4 text-muted" aria-hidden />}
          />
          <div className="p-4">
            <p className="text-sm leading-relaxed text-muted">
              Start Caddy without a config file so the API is the source of truth. Caddy then
              persists changes to its autosave file.
            </p>
            <CodeBlock className="mt-3">{`# start with an empty, API-managed config
caddy run

# after a restart, reload the autosaved config
caddy run --resume`}</CodeBlock>
            <p className="mt-3 text-xs leading-relaxed text-muted">
              Avoid <code className="font-mono">--watch</code> with a Caddyfile while using this
              panel: file changes would overwrite API changes.
            </p>
          </div>
        </Card>

        <Card>
          <CardHeader
            title="Custom ports"
            description="Useful for local testing without binding privileged ports."
            action={<Badge tone="info">Dev tip</Badge>}
          />
          <div className="p-4">
            <p className="text-sm leading-relaxed text-muted">
              Set <code className="font-mono text-ink-soft">CADDY_HTTPS_PORT</code> before creating
              your first site. New servers are created on that port.
            </p>
            <CodeBlock className="mt-3">{`CADDY_HTTP_PORT=8080
CADDY_HTTPS_PORT=8443`}</CodeBlock>
            <p className="mt-3 text-xs leading-relaxed text-muted">
              Public ACME certificates still require ports 80/443. With custom ports, use the
              internal CA or a DNS challenge.
            </p>
          </div>
        </Card>
      </div>

      <Card className="mt-6">
        <CardHeader title="About CaddyWeb" description="Version and resources." />
        <dl className="px-4 py-2">
          <KeyValue label="Version">{APP_VERSION}</KeyValue>
          <KeyValue label="Framework">Next.js 15 · React 19 · Tailwind CSS 4</KeyValue>
          <KeyValue label="Design">Flat UI · light mode</KeyValue>
        </dl>
        <div className="flex flex-wrap gap-2 border-t border-line px-4 py-3">
          <Link
            href="https://caddyserver.com/docs/api"
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-1.5 rounded-[3px] border border-line-strong px-2.5 py-1.5 text-xs font-bold text-ink-soft hover:border-primary hover:text-primary-ink"
          >
            <BookOpen className="h-3.5 w-3.5" aria-hidden />
            Admin API docs
            <ExternalLink className="h-3 w-3" aria-hidden />
          </Link>
          <Link
            href="https://caddyserver.com/docs/caddyfile"
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-1.5 rounded-[3px] border border-line-strong px-2.5 py-1.5 text-xs font-bold text-ink-soft hover:border-primary hover:text-primary-ink"
          >
            <BookOpen className="h-3.5 w-3.5" aria-hidden />
            Caddyfile docs
            <ExternalLink className="h-3 w-3" aria-hidden />
          </Link>
        </div>
      </Card>
    </div>
  );
}
