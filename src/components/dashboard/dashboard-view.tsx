"use client";

import Link from "next/link";
import useSWR from "swr";
import {
  Activity,
  ArrowRight,
  Globe2,
  Network,
  Plus,
  RefreshCw,
  ServerCog,
  ShieldCheck,
  TriangleAlert,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { fetcher } from "@/lib/api-client";
import type {
  SitesResponse,
  StatusResponse,
  UpstreamsResponse,
} from "@/lib/api-types";
import { SITE_KIND_META } from "@/lib/caddy/schema";
import {
  Badge,
  Card,
  CardHeader,
  EmptyState,
  PageHeader,
  Skeleton,
  StatCard,
  buttonClass,
  Spinner,
} from "@/components/ui/primitives";
import { KindIcon } from "@/components/sites/kind-icon";
import { SiteHost, KindBadge, TlsBadge } from "@/components/sites/site-badges";

const quickStart = [
  {
    kind: "reverse_proxy",
    href: "/sites/new?kind=reverse_proxy",
    title: "Proxy an app",
    copy: "Point a subdomain at localhost:3000 or any IP.",
  },
  {
    kind: "file_server",
    href: "/sites/new?kind=file_server",
    title: "Serve files",
    copy: "Publish a folder with an optional directory index.",
  },
  {
    kind: "filemanager",
    href: "/sites/new?kind=filemanager",
    title: "File manager",
    copy: "Browse files over the web behind a login.",
  },
  {
    kind: "redirect",
    href: "/sites/new?kind=redirect",
    title: "Redirect",
    copy: "Send a host to another URL in one click.",
  },
] as const;

export function DashboardView() {
  const status = useSWR<StatusResponse>("/api/caddy/status", fetcher, {
    refreshInterval: 15000,
  });
  const sites = useSWR<SitesResponse>("/api/caddy/sites", fetcher, {
    refreshInterval: 30000,
  });
  const upstreams = useSWR<UpstreamsResponse>("/api/caddy/upstreams", fetcher, {
    refreshInterval: 20000,
  });

  const connection = status.data;
  const siteList = sites.data?.sites ?? [];
  const serverList = sites.data?.servers ?? [];
  const upstreamList = upstreams.data?.upstreams ?? [];
  const failing = upstreamList.filter((upstream) => upstream.fails > 0).length;
  const listeners = Array.from(new Set(serverList.flatMap((server) => server.listen)));
  const recent = siteList.slice(0, 6);
  const refreshing = status.isValidating || sites.isValidating || upstreams.isValidating;

  function refreshAll() {
    void status.mutate();
    void sites.mutate();
    void upstreams.mutate();
  }

  return (
    <div>
      <PageHeader
        title="Dashboard"
        description="A flat overview of your Caddy configuration. Changes are written to the Admin API immediately."
        actions={
          <>
            <button
              type="button"
              className={cn(buttonClass("outline", "md"), "gap-2")}
              onClick={refreshAll}
              disabled={refreshing}
            >
              {refreshing ? <Spinner /> : <RefreshCw className="h-4 w-4" aria-hidden />}
              Refresh
            </button>
            <Link href="/sites/new" className={buttonClass("primary", "md")}>
              <Plus className="h-4 w-4" aria-hidden />
              New subdomain
            </Link>
          </>
        }
      />

      {connection && !connection.connected ? (
        <div className="mb-6 rounded-[3px] border border-danger/30 border-l-4 border-l-danger bg-danger/5 px-4 py-3">
          <div className="flex items-start gap-2.5">
            <TriangleAlert className="mt-0.5 h-4 w-4 shrink-0 text-danger-dark" aria-hidden />
            <div className="text-sm">
              <p className="font-semibold text-ink">Caddy Admin API is unreachable</p>
              <p className="mt-1 leading-relaxed text-muted">
                {connection.error ?? "The admin endpoint did not answer."}
              </p>
              <ul className="mt-2 list-inside list-disc space-y-0.5 text-xs text-muted">
                <li>
                  Start Caddy with its admin endpoint enabled (default{" "}
                  <code className="font-mono">{connection.adminUrl}</code>).
                </li>
                <li>
                  Check <code className="font-mono">CADDY_ADMIN_URL</code> in{" "}
                  <code className="font-mono">.env.local</code>.
                </li>
                <li>Make sure the panel server can reach that address.</li>
              </ul>
            </div>
          </div>
        </div>
      ) : null}

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          label="Sites"
          value={sites.data ? siteList.length : <Skeleton className="h-7 w-10" />}
          hint={`${serverList.length} HTTP server${serverList.length === 1 ? "" : "s"}`}
          icon={<Globe2 className="h-4 w-4" aria-hidden />}
          tone="info"
        />
        <StatCard
          label="Upstreams"
          value={upstreams.data ? upstreamList.length : <Skeleton className="h-7 w-10" />}
          hint={failing > 0 ? `${failing} reporting failures` : "All upstreams healthy"}
          icon={<Network className="h-4 w-4" aria-hidden />}
          tone={failing > 0 ? "warning" : "success"}
        />
        <StatCard
          label="Listeners"
          value={
            listeners.length > 0 ? (
              <span className="text-lg">{listeners.join(" · ")}</span>
            ) : (
              "—"
            )
          }
          hint="Ports bound by Caddy"
          icon={<ServerCog className="h-4 w-4" aria-hidden />}
          tone="purple"
        />
        <StatCard
          label="Admin API"
          value={connection?.connected ? `${connection.latencyMs ?? 0} ms` : "Offline"}
          hint={
            connection?.connected
              ? `Latest config checked at ${connection.adminUrl.replace(/^https?:\/\//, "")}`
              : "No response from Caddy"
          }
          icon={<Activity className="h-4 w-4" aria-hidden />}
          tone={connection?.connected ? "primary" : "danger"}
        />
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-[1.55fr_1fr]">
        <Card>
          <CardHeader
            title="Sites"
            description="Routes currently served by Caddy."
            action={
              <Link href="/sites" className="text-xs font-bold text-info-dark hover:underline">
                View all
              </Link>
            }
          />
          {sites.isLoading ? (
            <div className="space-y-3 p-4">
              {[0, 1, 2, 3].map((row) => (
                <Skeleton key={row} className="h-10 w-full" />
              ))}
            </div>
          ) : sites.error ? (
            <div className="p-4">
              <p className="text-sm text-danger-dark">
                {sites.error instanceof Error ? sites.error.message : "Could not load sites."}
              </p>
            </div>
          ) : recent.length === 0 ? (
            <EmptyState
              icon={<Globe2 className="h-5 w-5" aria-hidden />}
              title="No sites yet"
              description="Create your first subdomain and Caddy will start serving it right away."
              action={
                <Link href="/sites/new" className={buttonClass("primary", "md")}>
                  <Plus className="h-4 w-4" aria-hidden />
                  Create a site
                </Link>
              }
            />
          ) : (
            <div className="divide-y divide-line">
              {recent.map((site) => (
                <Link
                  key={site.ref}
                  href={`/sites/${site.ref}/edit`}
                  className="flex items-center gap-3 px-4 py-3 transition-colors hover:bg-cloud/50"
                >
                  <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-[3px] bg-cloud text-ink-soft">
                    <KindIcon kind={site.kind} />
                  </span>
                  <SiteHost site={site} className="flex-1" link={false} />
                  <div className="hidden shrink-0 items-center gap-2 sm:flex">
                    <KindBadge kind={site.kind} />
                    <TlsBadge mode={site.tls} />
                  </div>
                  <ArrowRight className="h-4 w-4 shrink-0 text-muted" aria-hidden />
                </Link>
              ))}
            </div>
          )}
        </Card>

        <div className="space-y-6">
          <Card>
            <CardHeader title="Quick start" description="The four most common setups." />
            <div className="grid gap-px bg-line sm:grid-cols-2 lg:grid-cols-1 xl:grid-cols-2">
              {quickStart.map((item) => (
                <Link
                  key={item.kind}
                  href={item.href}
                  className="group flex items-start gap-3 bg-surface p-3.5 transition-colors hover:bg-cloud/50"
                >
                  <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-[3px] bg-primary/10 text-primary-dark">
                    <KindIcon kind={item.kind} />
                  </span>
                  <span className="min-w-0">
                    <span className="block text-sm font-bold text-ink group-hover:text-primary-dark">
                      {item.title}
                    </span>
                    <span className="mt-0.5 block text-xs leading-relaxed text-muted">
                      {item.copy}
                    </span>
                  </span>
                </Link>
              ))}
            </div>
          </Card>

          <Card>
            <CardHeader
              title="TLS"
              description="Caddy issues and renews certificates for you."
              action={<ShieldCheck className="h-4 w-4 text-success-dark" aria-hidden />}
            />
            <div className="space-y-2 p-4 text-sm text-muted">
              <p className="flex items-center justify-between gap-3">
                <span>Public domains</span>
                <Badge tone="success">Automatic</Badge>
              </p>
              <p className="flex items-center justify-between gap-3">
                <span>Custom port</span>
                <span className="font-mono text-xs text-ink-soft">
                  :{connection?.httpsPort ?? "443"}
                </span>
              </p>
              <p className="pt-2 text-xs leading-relaxed">
                For LAN names, choose <strong className="text-ink-soft">Local CA</strong> when
                creating a site.
              </p>
              <Link
                href="/tls"
                className="inline-flex pt-1 text-xs font-bold text-info-dark hover:underline"
              >
                Inspect TLS settings
              </Link>
            </div>
          </Card>
        </div>
      </div>

      {listeners.length === 0 && sites.data ? (
        <Card className="mt-6 p-4">
          <p className="text-xs font-bold tracking-wide text-muted uppercase">Debug</p>
          <p className="mt-1 text-sm text-muted">
            No HTTP servers are configured yet. CaddyWeb will create{" "}
            <code className="font-mono text-ink-soft">srv0</code> on port{" "}
            <code className="font-mono text-ink-soft">:443</code> with your first site.
          </p>
        </Card>
      ) : null}

      <div className="mt-6 grid gap-3 sm:grid-cols-3">
        {(["reverse_proxy", "file_server", "filemanager"] as const).map((kind) => (
          <div key={kind} className="flex items-center gap-2 text-xs text-muted">
            <KindIcon kind={kind} className="h-3.5 w-3.5" />
            <span>{SITE_KIND_META[kind].label}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
