"use client";

import Link from "next/link";
import useSWR from "swr";
import { Network, Plus, RefreshCw, TriangleAlert } from "lucide-react";
import { fetcher } from "@/lib/api-client";
import type { UpstreamsResponse } from "@/lib/api-types";
import {
  Badge,
  Card,
  CardHeader,
  EmptyState,
  PageHeader,
  Skeleton,
  Spinner,
  buttonClass,
} from "@/components/ui/primitives";

export function UpstreamsView() {
  const { data, error, isLoading, isValidating, mutate } = useSWR<UpstreamsResponse>(
    "/api/caddy/upstreams",
    fetcher,
    { refreshInterval: 10000 },
  );

  const upstreams = data?.upstreams ?? [];

  return (
    <div>
      <PageHeader
        title="Upstreams"
        description="Live status of every reverse-proxy backend Caddy knows about."
        actions={
          <button
            type="button"
            className={buttonClass("outline", "md")}
            onClick={() => void mutate()}
            disabled={isValidating}
          >
            {isValidating ? <Spinner /> : <RefreshCw className="h-4 w-4" aria-hidden />}
            Refresh
          </button>
        }
      />

      {error ? (
        <div className="mb-6 flex items-start gap-2.5 rounded-[3px] border border-danger/30 border-l-4 border-l-danger bg-danger/5 px-4 py-3">
          <TriangleAlert className="mt-0.5 h-4 w-4 shrink-0 text-danger-dark" aria-hidden />
          <div className="text-sm">
            <p className="font-semibold text-ink">Could not reach Caddy</p>
            <p className="mt-1 text-muted">
              {error instanceof Error ? error.message : "Unknown error"}
            </p>
          </div>
        </div>
      ) : null}

      <Card>
        <CardHeader
          title="Upstream pool"
          description="Counts come from Caddy's in-memory reverse proxy state."
          action={
            <Badge tone={upstreams.length > 0 ? "info" : "muted"}>
              {upstreams.length} upstream{upstreams.length === 1 ? "" : "s"}
            </Badge>
          }
        />

        {isLoading ? (
          <div className="space-y-3 p-4">
            {[0, 1, 2].map((row) => (
              <Skeleton key={row} className="h-10 w-full" />
            ))}
          </div>
        ) : upstreams.length === 0 ? (
          <EmptyState
            icon={<Network className="h-5 w-5" aria-hidden />}
            title="No reverse-proxy upstreams"
            description="Upstreams appear here as soon as a reverse proxy site is active."
            action={
              <Link href="/sites/new?kind=reverse_proxy" className={buttonClass("primary", "md")}>
                <Plus className="h-4 w-4" aria-hidden />
                Add a reverse proxy
              </Link>
            }
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[560px] text-left text-sm">
              <thead className="border-b border-line bg-cloud/50 text-[10px] font-bold tracking-[0.1em] text-muted uppercase">
                <tr>
                  <th className="px-4 py-2.5 font-bold">Address</th>
                  <th className="px-3 py-2.5 font-bold">Active requests</th>
                  <th className="px-3 py-2.5 font-bold">Failures</th>
                  <th className="px-4 py-2.5 font-bold">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {upstreams.map((upstream) => (
                  <tr key={upstream.address} className="hover:bg-cloud/30">
                    <td className="px-4 py-3 font-mono text-xs font-semibold text-ink">
                      {upstream.address}
                    </td>
                    <td className="px-3 py-3 font-mono text-xs text-ink-soft">
                      {upstream.num_requests}
                    </td>
                    <td className="px-3 py-3 font-mono text-xs text-ink-soft">
                      {upstream.fails}
                    </td>
                    <td className="px-4 py-3">
                      {upstream.fails === 0 ? (
                        <Badge tone="success">Healthy</Badge>
                      ) : (
                        <Badge tone="warning">Failing</Badge>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      <div className="mt-4 rounded-[3px] border border-line bg-surface px-4 py-3">
        <p className="text-xs leading-relaxed text-muted">
          <strong className="text-ink-soft">Reading the numbers:</strong> active requests are
          connections currently handled per upstream. Failures are remembered by Caddy's passive
          health checks, if enabled. A non-zero failure count alone does not mean an upstream is
          down.
        </p>
      </div>
    </div>
  );
}
