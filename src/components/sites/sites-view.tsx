"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import useSWR from "swr";
import {
  Globe2,
  Pencil,
  Plus,
  RefreshCw,
  Search,
  Trash2,
  TriangleAlert,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { api, fetcher, ClientApiError } from "@/lib/api-client";
import type { MutateResponse, SitesResponse, SiteSummary } from "@/lib/api-types";
import { SITE_KIND_META } from "@/lib/caddy/schema";
import { hostLabel } from "@/lib/utils";
import {
  Badge,
  Card,
  EmptyState,
  PageHeader,
  Skeleton,
  Spinner,
  buttonClass,
} from "@/components/ui/primitives";
import { Input } from "@/components/ui/form";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { useToast } from "@/components/ui/toast";
import { KindBadge, SiteHost, TlsBadge } from "@/components/sites/site-badges";

export function SitesView() {
  const { data, error, isLoading, isValidating, mutate } = useSWR<SitesResponse>(
    "/api/caddy/sites",
    fetcher,
    { refreshInterval: 20000 },
  );
  const [query, setQuery] = useState("");
  const [pendingDelete, setPendingDelete] = useState<SiteSummary | null>(null);
  const [deleting, setDeleting] = useState(false);
  const { push } = useToast();

  const sites = data?.sites ?? [];
  const servers = data?.servers ?? [];

  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase();
    if (!needle) return sites;
    return sites.filter((site) =>
      [site.hosts.join(" "), site.target, site.server, SITE_KIND_META[site.kind].label]
        .join(" ")
        .toLowerCase()
        .includes(needle),
    );
  }, [sites, query]);

  async function confirmDelete() {
    if (!pendingDelete) return;
    setDeleting(true);

    try {
      const result = await api<MutateResponse>(`/api/caddy/sites/${pendingDelete.ref}`, {
        method: "DELETE",
      });
      await mutate();
      push({
        tone: "success",
        title: "Site removed",
        description: hostLabel(pendingDelete.hosts),
      });
      if (result.warnings?.length) {
        push({
          tone: "warning",
          title: "Caddy returned warnings",
          description: result.warnings
            .map((warning) => warning.message)
            .filter(Boolean)
            .join(" · "),
        });
      }
      setPendingDelete(null);
    } catch (caught) {
      push({
        tone: "danger",
        title: "Could not remove site",
        description:
          caught instanceof ClientApiError || caught instanceof Error
            ? caught.message
            : "Unknown error",
      });
    } finally {
      setDeleting(false);
    }
  }

  return (
    <div>
      <PageHeader
        title="Sites"
        description="Every route Caddy is currently serving, including routes imported from a Caddyfile."
        actions={
          <>
            <button
              type="button"
              className={buttonClass("outline", "md")}
              onClick={() => void mutate()}
              disabled={isValidating}
            >
              {isValidating ? <Spinner /> : <RefreshCw className="h-4 w-4" aria-hidden />}
              Refresh
            </button>
            <Link href="/sites/new" className={buttonClass("primary", "md")}>
              <Plus className="h-4 w-4" aria-hidden />
              New site
            </Link>
          </>
        }
      />

      {error ? (
        <div className="mb-6 flex items-start gap-2.5 rounded-[3px] border border-danger/30 border-l-4 border-l-danger bg-danger/5 px-4 py-3">
          <TriangleAlert className="mt-0.5 h-4 w-4 shrink-0 text-danger-dark" aria-hidden />
          <div className="text-sm">
            <p className="font-semibold text-ink">Could not load sites</p>
            <p className="mt-1 text-muted">
              {error instanceof Error ? error.message : "Unknown error"}
            </p>
          </div>
        </div>
      ) : null}

      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div className="relative w-full max-w-sm">
          <Search
            className="pointer-events-none absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-muted"
            aria-hidden
          />
          <Input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Filter by host, target or type"
            className="pl-9"
            aria-label="Filter sites"
          />
        </div>
        <p className="text-xs font-semibold text-muted">
          {data
            ? `${sites.length} site${sites.length === 1 ? "" : "s"} · ${servers.length} server${
                servers.length === 1 ? "" : "s"
              }`
            : "Loading configuration…"}
        </p>
      </div>

      <Card className="overflow-hidden">
        {isLoading ? (
          <div className="space-y-3 p-4">
            {[0, 1, 2, 3, 4].map((row) => (
              <Skeleton key={row} className="h-11 w-full" />
            ))}
          </div>
        ) : sites.length === 0 ? (
          <EmptyState
            icon={<Globe2 className="h-5 w-5" aria-hidden />}
            title="No sites configured"
            description="Add a subdomain and Caddy will serve it instantly, including automatic HTTPS."
            action={
              <Link href="/sites/new" className={buttonClass("primary", "md")}>
                <Plus className="h-4 w-4" aria-hidden />
                Create your first site
              </Link>
            }
          />
        ) : filtered.length === 0 ? (
          <EmptyState
            icon={<Search className="h-5 w-5" aria-hidden />}
            title="No matching sites"
            description={`Nothing matches “${query}”. Try a different host or target.`}
            action={
              <button
                type="button"
                className={buttonClass("outline", "md")}
                onClick={() => setQuery("")}
              >
                Clear filter
              </button>
            }
          />
        ) : (
          <>
            <div className="hidden overflow-x-auto md:block">
              <table className="w-full min-w-[760px] text-left text-sm">
                <thead className="border-b border-line bg-cloud/50 text-[10px] font-bold tracking-[0.1em] text-muted uppercase">
                  <tr>
                    <th className="px-4 py-2.5 font-bold">Host</th>
                    <th className="px-3 py-2.5 font-bold">Type</th>
                    <th className="px-3 py-2.5 font-bold">Target</th>
                    <th className="px-3 py-2.5 font-bold">TLS</th>
                    <th className="px-3 py-2.5 font-bold">Auth</th>
                    <th className="px-4 py-2.5 text-right font-bold">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-line">
                  {filtered.map((site) => (
                    <tr key={site.ref} className="transition-colors hover:bg-cloud/30">
                      <td className="max-w-[260px] px-4 py-3">
                        <SiteHost site={site} />
                        {!site.managed ? (
                          <Badge tone="warning" className="mt-1">
                            Imported
                          </Badge>
                        ) : null}
                      </td>
                      <td className="px-3 py-3">
                        <KindBadge kind={site.kind} />
                      </td>
                      <td className="max-w-[220px] px-3 py-3">
                        <span
                          className="block truncate font-mono text-xs text-ink-soft"
                          title={site.target}
                        >
                          {site.target}
                        </span>
                      </td>
                      <td className="px-3 py-3">
                        <TlsBadge mode={site.tls} />
                      </td>
                      <td className="px-3 py-3 text-xs font-semibold text-ink-soft">
                        {site.auth ? site.authUser || "Yes" : "—"}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center justify-end gap-1">
                          <Link
                            href={`/sites/${site.ref}/edit`}
                            className={cn(buttonClass("outline", "sm"), "gap-1.5")}
                          >
                            <Pencil className="h-3 w-3" aria-hidden />
                            Edit
                          </Link>
                          <button
                            type="button"
                            onClick={() => setPendingDelete(site)}
                            className="rounded-[3px] border border-transparent p-2 text-muted transition-colors hover:border-danger/30 hover:bg-danger/10 hover:text-danger-dark"
                            aria-label={`Delete ${hostLabel(site.hosts)}`}
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="divide-y divide-line md:hidden">
              {filtered.map((site) => (
                <div key={site.ref} className="p-4">
                  <div className="flex items-start justify-between gap-2">
                    <SiteHost site={site} />
                    <KindBadge kind={site.kind} />
                  </div>

                  <div className="mt-2 flex flex-wrap items-center gap-2">
                    <span className="max-w-full truncate font-mono text-[11px] text-muted">
                      {site.target}
                    </span>
                    <TlsBadge mode={site.tls} />
                    {site.auth ? (
                      <Badge tone="muted">Auth: {site.authUser || "yes"}</Badge>
                    ) : null}
                    {!site.managed ? <Badge tone="warning">Imported</Badge> : null}
                  </div>

                  <div className="mt-3 flex items-center gap-2">
                    <Link
                      href={`/sites/${site.ref}/edit`}
                      className={cn(buttonClass("outline", "sm"), "gap-1.5")}
                    >
                      <Pencil className="h-3 w-3" aria-hidden />
                      Edit
                    </Link>
                    <button
                      type="button"
                      onClick={() => setPendingDelete(site)}
                      className="inline-flex h-8 items-center gap-1.5 rounded-[3px] border border-transparent px-2.5 text-xs font-semibold text-danger-dark transition-colors hover:bg-danger/10"
                    >
                      <Trash2 className="h-3 w-3" aria-hidden />
                      Delete
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </>
        )}
      </Card>

      <p className="mt-4 text-xs leading-relaxed text-muted">
        Wildcard hosts (<code className="font-mono">*.example.com</code>) are supported. DNS must
        already resolve to this server before Caddy can issue a certificate.
      </p>

      <ConfirmDialog
        open={Boolean(pendingDelete)}
        title="Delete this site?"
        description={
          pendingDelete
            ? `This removes the route for ${hostLabel(pendingDelete.hosts)} from Caddy's running configuration. This cannot be undone.`
            : undefined
        }
        confirmLabel="Delete site"
        busy={deleting}
        onCancel={() => setPendingDelete(null)}
        onConfirm={confirmDelete}
      />
    </div>
  );
}
