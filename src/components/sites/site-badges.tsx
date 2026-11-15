import Link from "next/link";
import { ArrowUpRight, Lock } from "lucide-react";
import { Badge, type Tone } from "@/components/ui/primitives";
import { SITE_KIND_META, type SiteKind, type TlsMode } from "@/lib/caddy/schema";
import { cn } from "@/lib/utils";
import type { SiteSummary } from "@/lib/api-types";

export function KindBadge({ kind }: { kind: SiteKind }) {
  const meta = SITE_KIND_META[kind];
  return <Badge tone={meta.tone as Tone}>{meta.short}</Badge>;
}

export function TlsBadge({ mode }: { mode: TlsMode }) {
  if (mode === "off") return <Badge tone="warning">No TLS</Badge>;

  return mode === "internal" ? (
    <Badge tone="purple">Local CA</Badge>
  ) : (
    <Badge tone="success">Auto TLS</Badge>
  );
}

export function AuthBadge({ enabled }: { enabled: boolean }) {
  if (!enabled) return <span className="text-xs text-muted">—</span>;
  return (
    <span className="inline-flex items-center gap-1 text-xs font-semibold text-ink-soft">
      <Lock className="h-3 w-3 text-muted" aria-hidden />
      Yes
    </span>
  );
}

export function SiteHost({
  site,
  className,
  link = true,
}: {
  site: SiteSummary;
  className?: string;
  link?: boolean;
}) {
  const host = site.hosts[0];
  const extra = Math.max(site.hosts.length - 1, 0);
  const path = site.paths[0] ?? "";
  const linkable = link && Boolean(host && !host.includes("*") && site.kind !== "custom");

  return (
    <div className={cn("min-w-0", className)}>
      <div className="flex items-center gap-1.5">
        {linkable ? (
          <a
            href={`https://${host}${path}`}
            target="_blank"
            rel="noreferrer"
            className="truncate text-sm font-semibold text-ink hover:text-primary-ink hover:underline"
          >
            {host}
          </a>
        ) : (
          <span className="truncate text-sm font-semibold text-ink">
            {host ?? "All hosts"}
          </span>
        )}
        {linkable ? <ArrowUpRight className="h-3 w-3 shrink-0 text-muted" aria-hidden /> : null}
        {extra > 0 ? <Badge tone="muted">+{extra}</Badge> : null}
      </div>
      <p className="mt-0.5 flex items-center gap-2 text-[11px] text-muted">
        {path ? <code className="font-mono">{path}</code> : <span>root</span>}
        <span className="text-line-strong" aria-hidden>
          •
        </span>
        <span>{site.server}</span>
      </p>
    </div>
  );
}

export function EditSiteLink({ siteRef }: { siteRef: string }) {
  return (
    <Link
      href={`/sites/${siteRef}/edit`}
      className="rounded-[2px] px-1.5 py-0.5 text-xs font-bold text-info-ink hover:bg-info/10"
    >
      Edit
    </Link>
  );
}
