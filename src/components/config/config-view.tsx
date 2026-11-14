"use client";

import { useEffect, useState } from "react";
import useSWR from "swr";
import {
  Braces,
  Check,
  Copy,
  Download,
  FileCode2,
  RefreshCw,
  Upload,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { api, ClientApiError, fetcher } from "@/lib/api-client";
import type {
  AdaptResponse,
  ConfigResponse,
  CaddyWarningSummary,
  MutateResponse,
} from "@/lib/api-types";
import {
  Badge,
  Card,
  CardHeader,
  CodeBlock,
  Notice,
  PageHeader,
  Skeleton,
  Spinner,
  buttonClass,
} from "@/components/ui/primitives";
import { Textarea } from "@/components/ui/form";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { useToast } from "@/components/ui/toast";

type Tab = "json" | "caddyfile";

const CADDYFILE_EXAMPLE = `{
	admin localhost:2019
}

app.example.com {
	reverse_proxy localhost:3000
}

files.example.com {
	root * /srv/www
	file_server browse
}`;

export function ConfigView() {
  const { data, error, isLoading, mutate } = useSWR<ConfigResponse>(
    "/api/caddy/config",
    fetcher,
    { revalidateOnFocus: false },
  );
  const { push } = useToast();

  const [tab, setTab] = useState<Tab>("json");
  const [draft, setDraft] = useState("");
  const [initialized, setInitialized] = useState(false);
  const [feedback, setFeedback] = useState<{ tone: "success" | "danger"; message: string } | null>(
    null,
  );
  const [pending, setPending] = useState<Record<string, unknown> | null>(null);
  const [applying, setApplying] = useState(false);

  const [caddyfile, setCaddyfile] = useState(CADDYFILE_EXAMPLE);
  const [adapted, setAdapted] = useState<Record<string, unknown> | null>(null);
  const [adapting, setAdapting] = useState(false);
  const [adaptError, setAdaptError] = useState("");

  useEffect(() => {
    if (data && !initialized) {
      setDraft(JSON.stringify(data.config, null, 2));
      setInitialized(true);
    }
  }, [data, initialized]);

  async function refresh() {
    setFeedback(null);
    const fresh = await mutate();
    if (fresh) {
      setDraft(JSON.stringify(fresh.config, null, 2));
      setInitialized(true);
    }
  }

  function formatDraft() {
    try {
      const parsed = JSON.parse(draft);
      setDraft(JSON.stringify(parsed, null, 2));
      setFeedback({ tone: "success", message: "Formatted." });
    } catch (caught) {
      setFeedback({
        tone: "danger",
        message: caught instanceof Error ? caught.message : "Invalid JSON.",
      });
    }
  }

  function requestApply() {
    try {
      const parsed = JSON.parse(draft) as unknown;
      if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
        throw new Error("The configuration must be a JSON object.");
      }
      setPending(parsed as Record<string, unknown>);
    } catch (caught) {
      setFeedback({
        tone: "danger",
        message: caught instanceof Error ? caught.message : "Invalid JSON.",
      });
    }
  }

  async function adaptCaddyfile() {
    setAdapting(true);
    setAdaptError("");
    setAdapted(null);

    try {
      const result = await api<AdaptResponse>("/api/caddy/adapt", {
        method: "POST",
        body: JSON.stringify({ caddyfile }),
      });
      setAdapted(result.config);
    } catch (caught) {
      setAdaptError(
        caught instanceof ClientApiError || caught instanceof Error
          ? caught.message
          : "Could not adapt the Caddyfile.",
      );
    } finally {
      setAdapting(false);
    }
  }

  async function applyConfig() {
    if (!pending) return;
    setApplying(true);

    try {
      const result = await api<MutateResponse>("/api/caddy/config", {
        method: "POST",
        body: JSON.stringify({ config: pending }),
      });

      push({
        tone: "success",
        title: "Configuration applied",
        description: "Caddy reloaded without downtime.",
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

      setPending(null);
      setFeedback({ tone: "success", message: "Configuration loaded successfully." });
      await refresh();
    } catch (caught) {
      const message =
        caught instanceof Error ? caught.message : "Could not apply the configuration.";
      setFeedback({ tone: "danger", message });
      push({ tone: "danger", title: "Apply failed", description: message });
      setPending(null);
    } finally {
      setApplying(false);
    }
  }

  async function copyDraft() {
    try {
      await navigator.clipboard.writeText(draft);
      push({ tone: "success", title: "JSON copied" });
    } catch {
      push({ tone: "danger", title: "Copy failed" });
    }
  }

  function downloadDraft() {
    const blob = new Blob([draft], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = "caddy.json";
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    URL.revokeObjectURL(url);
  }

  return (
    <div>
      <PageHeader
        title="Raw config"
        description="Inspect or replace the complete Caddy JSON document, or adapt an existing Caddyfile."
        actions={
          <button
            type="button"
            onClick={() => void refresh()}
            className={buttonClass("outline", "md")}
            disabled={isLoading}
          >
            {isLoading ? <Spinner /> : <RefreshCw className="h-4 w-4" aria-hidden />}
            Reload from Caddy
          </button>
        }
      />

      <div className="mb-4 inline-flex rounded-[3px] border border-line bg-surface p-1">
        {(
          [
            { value: "json", label: "JSON", icon: Braces },
            { value: "caddyfile", label: "Caddyfile import", icon: FileCode2 },
          ] as const
        ).map((item) => {
          const Icon = item.icon;
          return (
            <button
              key={item.value}
              type="button"
              onClick={() => setTab(item.value)}
              className={cn(
                "inline-flex items-center gap-1.5 rounded-[2px] px-3 py-1.5 text-xs font-bold transition-colors",
                tab === item.value
                  ? "bg-primary text-white"
                  : "text-ink-soft hover:bg-cloud",
              )}
            >
              <Icon className="h-3.5 w-3.5" aria-hidden />
              {item.label}
            </button>
          );
        })}
      </div>

      {error ? (
        <Notice tone="danger" title="Could not load the configuration" className="mb-4">
          {error instanceof Error ? error.message : "Unknown error"}
        </Notice>
      ) : null}

      {feedback ? (
        <Notice
          tone={feedback.tone}
          className="mb-4"
          action={
            <button
              type="button"
              onClick={() => setFeedback(null)}
              className="text-xs font-bold text-muted hover:text-ink"
            >
              Dismiss
            </button>
          }
        >
          {feedback.message}
        </Notice>
      ) : null}

      {tab === "json" ? (
        <Card>
          <CardHeader
            title="Caddy JSON"
            description="POST /load replaces the running configuration. Caddy keeps the old config if the new one is invalid."
            action={
              <Badge tone={data?.etag ? "info" : "muted"}>
                {data?.etag ? "ETag tracked" : "No ETag"}
              </Badge>
            }
          />
          <div className="p-4">
            {isLoading ? (
              <Skeleton className="h-[26rem] w-full" />
            ) : (
              <Textarea
                value={draft}
                onChange={(event) => {
                  setDraft(event.target.value);
                  setFeedback(null);
                }}
                spellCheck={false}
                rows={22}
                aria-label="Caddy JSON configuration"
                className="min-h-[26rem] font-mono text-xs leading-relaxed"
              />
            )}

            <div className="mt-3 flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={requestApply}
                disabled={isLoading || !draft}
                className={buttonClass("danger", "md")}
              >
                <Upload className="h-4 w-4" aria-hidden />
                Apply configuration
              </button>
              <button type="button" onClick={formatDraft} className={buttonClass("outline", "md")}>
                <Check className="h-4 w-4" aria-hidden />
                Format
              </button>
              <button type="button" onClick={copyDraft} className={buttonClass("ghost", "md")}>
                <Copy className="h-4 w-4" aria-hidden />
                Copy
              </button>
              <button type="button" onClick={downloadDraft} className={buttonClass("ghost", "md")}>
                <Download className="h-4 w-4" aria-hidden />
                Download
              </button>
            </div>

            <p className="mt-3 text-xs leading-relaxed text-muted">
              Saving here bypasses the site builder. Unknown fields are validated by Caddy and
              rejected as a whole if invalid.
            </p>
          </div>
        </Card>
      ) : (
        <div className="grid gap-6 lg:grid-cols-2">
          <Card>
            <CardHeader
              title="Paste a Caddyfile"
              description="Caddy's /adapt endpoint converts it to JSON without applying it."
            />
            <div className="p-4">
              <Textarea
                value={caddyfile}
                onChange={(event) => {
                  setCaddyfile(event.target.value);
                  setAdapted(null);
                  setAdaptError("");
                }}
                rows={20}
                spellCheck={false}
                aria-label="Caddyfile"
                className="min-h-[22rem] font-mono text-xs leading-relaxed"
              />
              <button
                type="button"
                onClick={() => void adaptCaddyfile()}
                disabled={adapting || !caddyfile.trim()}
                className={cn(buttonClass("primary", "md"), "mt-3")}
              >
                {adapting ? <Spinner /> : <FileCode2 className="h-4 w-4" aria-hidden />}
                Adapt to JSON
              </button>

              {adaptError ? (
                <div className="mt-3">
                  <Notice tone="danger" title="Adapt failed">
                    {adaptError}
                  </Notice>
                </div>
              ) : null}
            </div>
          </Card>

          <Card>
            <CardHeader
              title="Adapted result"
              description="Review the generated JSON, then apply it to the running server."
              action={
                adapted ? (
                  <button
                    type="button"
                    onClick={() => setPending(adapted)}
                    className={buttonClass("danger", "sm")}
                  >
                    <Upload className="h-3.5 w-3.5" aria-hidden />
                    Apply
                  </button>
                ) : null
              }
            />
            <div className="p-4">
              {adapted ? (
                <CodeBlock className="max-h-[26rem]">
                  {JSON.stringify(adapted, null, 2)}
                </CodeBlock>
              ) : (
                <div className="flex h-[22rem] flex-col items-center justify-center text-center">
                  <Braces className="mb-3 h-6 w-6 text-muted" aria-hidden />
                  <p className="text-sm font-semibold text-ink-soft">Nothing adapted yet</p>
                  <p className="mt-1 max-w-xs text-xs leading-relaxed text-muted">
                    Paste your Caddyfile on the left and run the adapter. Your active config is
                    not changed until you press Apply.
                  </p>
                </div>
              )}
            </div>
          </Card>
        </div>
      )}

      <Notice tone="warning" title="This replaces the entire configuration" className="mt-6">
        Applying JSON from this page — or from an adapted Caddyfile — replaces every server,
        route and app Caddy is currently running. Make sure the document includes what you need.
      </Notice>

      <ConfirmDialog
        open={Boolean(pending)}
        title="Replace the running configuration?"
        description="Caddy will validate the document and reload without downtime. If validation fails, the current configuration stays active."
        confirmLabel="Apply"
        busy={applying}
        onCancel={() => setPending(null)}
        onConfirm={() => void applyConfig()}
      />
    </div>
  );
}
