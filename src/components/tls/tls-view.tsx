"use client";

import useSWR from "swr";
import { Download, RefreshCw, ShieldCheck, TriangleAlert } from "lucide-react";
import { fetcher } from "@/lib/api-client";
import type { TlsResponse } from "@/lib/api-types";
import {
  Badge,
  Card,
  CardHeader,
  CodeBlock,
  EmptyState,
  Notice,
  PageHeader,
  Skeleton,
  Spinner,
  StatCard,
  buttonClass,
} from "@/components/ui/primitives";
import { useToast } from "@/components/ui/toast";

function downloadPem(pem: string) {
  const blob = new Blob([pem], { type: "application/x-pem-file" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = "caddy-local-ca.crt";
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
}

export function TlsView() {
  const { data, error, isLoading, isValidating, mutate } = useSWR<TlsResponse>(
    "/api/caddy/tls",
    fetcher,
  );
  const { push } = useToast();

  const policies = data?.policies ?? [];
  const localCa = data?.localCa ?? null;
  const certificate = data?.certificates || localCa?.rootCertificate || "";

  return (
    <div>
      <PageHeader
        title="TLS"
        description="Caddy obtains and renews certificates automatically. Use the internal CA for LAN hostnames."
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
        <Notice tone="danger" title="Could not load TLS information" className="mb-6">
          {error instanceof Error ? error.message : "Unknown error"}
        </Notice>
      ) : null}

      <div className="grid gap-3 sm:grid-cols-2">
        <StatCard
          label="Issuance"
          value="Automatic"
          hint="ACME (Let's Encrypt / ZeroSSL) for public names"
          icon={<ShieldCheck className="h-4 w-4" aria-hidden />}
          tone="success"
        />
        <StatCard
          label="Automation policies"
          value={data ? policies.length : <Skeleton className="h-7 w-10" />}
          hint={localCa ? "Local CA provisioned" : "Local CA not provisioned yet"}
          icon={<ShieldCheck className="h-4 w-4" aria-hidden />}
          tone="purple"
        />
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader
            title="Automatic HTTPS"
            description="Enabled by default for every domain Caddy serves."
          />
          <div className="space-y-3 p-4 text-sm leading-relaxed text-muted">
            <p>
              Caddy obtains a publicly trusted certificate for each hostname and renews it in the
              background. Ports <strong className="text-ink-soft">80</strong> and{" "}
              <strong className="text-ink-soft">443</strong> must be reachable from the internet.
            </p>
            <p>
              No certificate settings are needed per site. Choose a different TLS mode in the site
              form only when a public certificate cannot be issued.
            </p>
            <Badge tone="success">Recommended for public domains</Badge>
          </div>
        </Card>

        <Card>
          <CardHeader
            title="Local CA"
            description="Caddy's own certificate authority for internal names."
            action={
              certificate ? (
                <button
                  type="button"
                  onClick={() => {
                    downloadPem(certificate);
                    push({ tone: "success", title: "Root certificate downloaded" });
                  }}
                  className={buttonClass("outline", "sm")}
                >
                  <Download className="h-3.5 w-3.5" aria-hidden />
                  Root cert
                </button>
              ) : null
            }
          />
          {isLoading ? (
            <div className="space-y-2 p-4">
              <Skeleton className="h-4 w-3/4" />
              <Skeleton className="h-4 w-2/3" />
            </div>
          ) : localCa ? (
            <div className="space-y-3 p-4">
              <dl className="text-sm">
                <div className="flex justify-between gap-3 border-b border-line py-1.5">
                  <dt className="text-muted">Authority</dt>
                  <dd className="font-medium text-ink">{localCa.name}</dd>
                </div>
                <div className="flex justify-between gap-3 border-b border-line py-1.5">
                  <dt className="text-muted">Root common name</dt>
                  <dd className="truncate font-mono text-xs text-ink-soft">
                    {localCa.rootCommonName || "—"}
                  </dd>
                </div>
                <div className="flex justify-between gap-3 py-1.5">
                  <dt className="text-muted">Intermediate</dt>
                  <dd className="truncate font-mono text-xs text-ink-soft">
                    {localCa.intermediateCommonName || "—"}
                  </dd>
                </div>
              </dl>
              <p className="text-xs leading-relaxed text-muted">
                Install the root certificate on client devices so browsers trust sites using the
                local CA.
              </p>
            </div>
          ) : (
            <div className="p-4">
              <p className="text-sm leading-relaxed text-muted">
                The local CA is provisioned on demand. Create a site and choose{" "}
                <strong className="text-ink-soft">Internal CA</strong> as its TLS mode to
                activate it.
              </p>
            </div>
          )}
        </Card>
      </div>

      <Card className="mt-6">
        <CardHeader
          title="Automation policies"
          description="Per-host policies tell Caddy which issuer to use."
          action={<Badge tone="purple">{policies.length}</Badge>}
        />
        {isLoading ? (
          <div className="space-y-3 p-4">
            {[0, 1].map((row) => (
              <Skeleton key={row} className="h-9 w-full" />
            ))}
          </div>
        ) : policies.length === 0 ? (
          <EmptyState
            icon={<ShieldCheck className="h-5 w-5" aria-hidden />}
            title="No TLS policies"
            description="Caddy will use automatic public issuance for every configured host."
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[520px] text-left text-sm">
              <thead className="border-b border-line bg-cloud/50 text-[10px] font-bold tracking-[0.1em] text-muted uppercase">
                <tr>
                  <th className="px-4 py-2.5 font-bold">Subjects</th>
                  <th className="px-4 py-2.5 font-bold">Issuers</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {policies.map((policy, index) => (
                  <tr key={`${policy.subjects.join(",")}-${index}`}>
                    <td className="px-4 py-3">
                      <div className="flex flex-wrap gap-1">
                        {policy.subjects.length > 0 ? (
                          policy.subjects.map((subject) => (
                            <Badge key={subject} tone="muted">
                              {subject}
                            </Badge>
                          ))
                        ) : (
                          <span className="text-xs text-muted">All subjects</span>
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex flex-wrap gap-1">
                        {policy.issuers.map((issuer) => (
                          <Badge
                            key={issuer}
                            tone={issuer === "internal" ? "purple" : "info"}
                          >
                            {issuer}
                          </Badge>
                        ))}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      {certificate ? (
        <Card className="mt-6">
          <CardHeader
            title="Root certificate"
            description="PEM encoded certificate chain for the local authority."
            action={
              <button
                type="button"
                onClick={() => {
                  void navigator.clipboard
                    .writeText(certificate)
                    .then(() => push({ tone: "success", title: "Certificate copied" }))
                    .catch(() => push({ tone: "danger", title: "Copy failed" }));
                }}
                className={buttonClass("ghost", "sm")}
              >
                Copy
              </button>
            }
          />
          <div className="p-4">
            <CodeBlock className="max-h-52">{certificate}</CodeBlock>
          </div>
        </Card>
      ) : null}

      <div className="mt-6 flex items-start gap-2 rounded-[3px] border border-warning/40 bg-warning/10 px-4 py-3">
        <TriangleAlert className="mt-0.5 h-4 w-4 shrink-0 text-warning-dark" aria-hidden />
        <p className="text-xs leading-relaxed text-ink-soft">
          Removing a TLS policy does not revoke certificates that Caddy already stored. Use the
          Caddy CLI if you need to manage its certificate storage directly.
        </p>
      </div>
    </div>
  );
}
