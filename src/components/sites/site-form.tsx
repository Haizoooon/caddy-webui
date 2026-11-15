"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  AlertTriangle,
  ArrowLeft,
  Check,
  ChevronDown,
  Eye,
  EyeOff,
  Save,
  ShieldCheck,
} from "lucide-react";
import { cn, hostLabel } from "@/lib/utils";
import {
  SITE_KIND_META,
  emptySiteInput,
  formatZodError,
  parseHostList,
  siteInputSchema,
  siteKinds,
  type SiteInput,
  type SiteKind,
} from "@/lib/caddy/schema";
import { buildRoute } from "@/lib/caddy/handlers";
import { api, ClientApiError } from "@/lib/api-client";
import type { CaddyWarningSummary } from "@/lib/api-types";
import {
  Badge,
  Button,
  Card,
  CardHeader,
  CodeBlock,
  KeyValue,
  Notice,
  PageHeader,
  Spinner,
  buttonClass,
} from "@/components/ui/primitives";
import { Field, Input, Select, Textarea, Toggle } from "@/components/ui/form";
import { useToast } from "@/components/ui/toast";
import { KindIcon } from "@/components/sites/kind-icon";

interface SiteFormProps {
  mode: "create" | "edit";
  initialInput: SiteInput;
  initialKind?: SiteKind;
  siteRef?: string;
  managed?: boolean;
  hadAuth?: boolean;
  serverName?: string;
}

export function SiteForm({
  mode,
  initialInput,
  siteRef,
  managed = true,
  hadAuth = false,
  serverName,
}: SiteFormProps) {
  const router = useRouter();
  const { push } = useToast();

  const [input, setInput] = useState<SiteInput>(initialInput);
  const [hostsText, setHostsText] = useState(initialInput.hosts.join(", "));
  const [upstreamText, setUpstreamText] = useState(initialInput.upstreams.join("\n"));
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  function update<K extends keyof SiteInput>(key: K, value: SiteInput[K]) {
    setInput((current) => ({ ...current, [key]: value }));
  }

  function updateAuth(key: "username" | "password", value: string) {
    setInput((current) => ({ ...current, auth: { ...current.auth, [key]: value } }));
  }

  function selectKind(kind: SiteKind) {
    setErrors({});
    setInput((current) => ({
      ...current,
      kind,
      browse: kind === "filemanager" ? true : current.browse,
      auth:
        kind === "filemanager"
          ? { ...current.auth, enabled: true }
          : current.auth,
      root:
        (kind === "file_server" || kind === "filemanager") && !current.root
          ? "/srv/www"
          : current.root,
      customHandlers:
        kind === "custom" && !current.customHandlers
          ? emptySiteInput("custom").customHandlers
          : current.customHandlers,
    }));

    if (kind === "reverse_proxy" && !upstreamText.trim()) {
      setUpstreamText("localhost:3000");
    }
  }

  const normalizedInput = useMemo<SiteInput>(
    () => ({
      ...input,
      hosts: parseHostList(hostsText),
      upstreams: upstreamText
        .split("\n")
        .map((line) => line.trim())
        .filter(Boolean),
    }),
    [input, hostsText, upstreamText],
  );

  const previewText = useMemo(() => {
    const candidate: SiteInput = {
      ...normalizedInput,
      hosts: normalizedInput.hosts.length ? normalizedInput.hosts : ["app.example.com"],
      upstreams: normalizedInput.upstreams.length
        ? normalizedInput.upstreams
        : ["localhost:3000"],
    };

    try {
      const route = buildRoute(candidate, {
        id: "preview",
        passwordHash: candidate.auth.enabled
          ? "$2a$10$previewpreviewpreviewpreviewpreviewpreviewpreview"
          : undefined,
      });
      return JSON.stringify(route, null, 2);
    } catch (error) {
      return `// ${error instanceof Error ? error.message : "Invalid route"}`;
    }
  }, [normalizedInput]);

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setErrors({});

    const parsed = siteInputSchema.safeParse(normalizedInput);
    if (!parsed.success) {
      const issues = formatZodError(parsed.error);
      setErrors(issues);
      push({
        tone: "danger",
        title: "Please check the form",
        description: Object.values(issues)[0] ?? "Some fields need attention.",
      });
      return;
    }

    const payload = parsed.data;

    if (payload.auth.enabled && !payload.auth.password) {
      const needsPassword = mode === "create" || !hadAuth;
      if (needsPassword) {
        setErrors({ "auth.password": "Choose a password for basic auth." });
        push({ tone: "danger", title: "Password required" });
        return;
      }
    }

    setBusy(true);

    try {
      const result = await api<{ ok: true; warnings?: CaddyWarningSummary[] }>(
        mode === "create" ? "/api/caddy/sites" : `/api/caddy/sites/${siteRef}`,
        {
          method: mode === "create" ? "POST" : "PUT",
          body: JSON.stringify(payload),
        },
      );

      push({
        tone: "success",
        title: mode === "create" ? "Site created" : "Site updated",
        description: `${hostLabel(payload.hosts)} is live in Caddy.`,
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

      router.push("/sites");
      router.refresh();
    } catch (caught) {
      if (caught instanceof ClientApiError) {
        if (caught.issues) setErrors(caught.issues);
        if (caught.status === 409 && !caught.issues) {
          setErrors({ hosts: caught.message });
        }
        push({
          tone: "danger",
          title: "Could not save the site",
          description: caught.message,
        });
      } else {
        push({
          tone: "danger",
          title: "Could not save the site",
          description: caught instanceof Error ? caught.message : "Unknown error",
        });
      }
      setBusy(false);
    }
  }

  const saveLabel = mode === "create" ? "Create site" : "Save changes";

  return (
    <form id="site-form" onSubmit={onSubmit} className="pb-12">
      <PageHeader
        title={mode === "create" ? "New site" : "Edit site"}
        description={
          mode === "create"
            ? "Create a subdomain and pick what Caddy should serve."
            : "Update this route. Changes are applied without downtime."
        }
        actions={
          <>
            <Link href="/sites" className={buttonClass("outline", "md")}>
              <ArrowLeft className="h-4 w-4" aria-hidden />
              Cancel
            </Link>
            <Button type="submit" disabled={busy}>
              {busy ? <Spinner /> : <Save className="h-4 w-4" aria-hidden />}
              {saveLabel}
            </Button>
          </>
        }
      />

      {!managed ? (
        <Notice tone="warning" title="Imported route" className="mb-5">
          This route was not created by CaddyWeb. Saving replaces its handler chain with the
          settings below, so any extra handlers will be lost.
        </Notice>
      ) : null}

      <div className="grid gap-6 lg:grid-cols-[1.55fr_1fr]">
        <div className="space-y-6">
          <Card>
            <CardHeader title="Type" description="What should this subdomain serve?" />
            <div className="grid gap-2 p-4 sm:grid-cols-2">
              {siteKinds.map((kind) => {
                const meta = SITE_KIND_META[kind];
                const selected = input.kind === kind;
                return (
                  <button
                    key={kind}
                    type="button"
                    onClick={() => selectKind(kind)}
                    className={cn(
                      "flex items-start gap-3 rounded-[3px] border p-3 text-left transition-colors",
                      selected
                        ? "border-primary bg-primary/5"
                        : "border-line hover:border-line-strong hover:bg-cloud/40",
                    )}
                    aria-pressed={selected}
                  >
                    <span
                      className={cn(
                        "flex h-8 w-8 shrink-0 items-center justify-center rounded-[3px]",
                        selected ? "bg-primary text-white" : "bg-cloud text-ink-soft",
                      )}
                    >
                      <KindIcon kind={kind} />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="flex items-center gap-1.5 text-sm font-bold text-ink">
                        {meta.label}
                        {selected ? (
                          <Check className="h-3.5 w-3.5 text-primary-ink" aria-hidden />
                        ) : null}
                      </span>
                      <span className="mt-0.5 block text-xs leading-relaxed text-muted">
                        {meta.description}
                      </span>
                    </span>
                  </button>
                );
              })}
            </div>
          </Card>

          <Card>
            <CardHeader
              title="Routing"
              description="Caddy matches these hostnames and paths before serving the route."
            />
            <div className="space-y-4 p-4">
              <Field
                label="Hostnames"
                htmlFor="hosts"
                error={errors.hosts}
                hint="Comma or space separated. DNS must already point to this server."
                required
              >
                <Input
                  id="hosts"
                  value={hostsText}
                  onChange={(event) => setHostsText(event.target.value)}
                  placeholder="app.example.com, www.example.com"
                  spellCheck={false}
                  autoCapitalize="none"
                />
              </Field>

              <Field
                label="Path matcher"
                htmlFor="path"
                error={errors.path}
                optional
                hint="Limit this route to a path, for example /api/*. Leave empty for the whole host."
              >
                <Input
                  id="path"
                  value={input.path}
                  onChange={(event) => update("path", event.target.value)}
                  placeholder="/"
                  spellCheck={false}
                  className="font-mono"
                />
              </Field>
            </div>
          </Card>

          <Card>
            <CardHeader
              title="Target"
              description="Where requests should be sent."
            />
            <div className="space-y-4 p-4">
              {input.kind === "reverse_proxy" ? (
                <Field
                  label="Upstreams"
                  htmlFor="upstreams"
                  error={errors.upstreams}
                  hint="One address per line. Caddy balances between them. WebSockets work automatically."
                >
                  <Textarea
                    id="upstreams"
                    rows={4}
                    value={upstreamText}
                    onChange={(event) => setUpstreamText(event.target.value)}
                    placeholder={"localhost:3000\n10.0.0.5:8080"}
                    spellCheck={false}
                    className="font-mono"
                  />
                </Field>
              ) : null}

              {input.kind === "file_server" || input.kind === "filemanager" ? (
                <>
                  <Field
                    label="Root folder"
                    htmlFor="root"
                    error={errors.root}
                    hint="Absolute path on the machine running Caddy, for example /srv/www."
                  >
                    <Input
                      id="root"
                      value={input.root}
                      onChange={(event) => update("root", event.target.value)}
                      placeholder="/srv/www"
                      spellCheck={false}
                      className="font-mono"
                    />
                  </Field>

                  {input.kind === "file_server" ? (
                    <>
                      <Toggle
                        checked={input.browse}
                        onChange={(next) => update("browse", next)}
                        label="Directory listing"
                        description="Show a file index when a folder has no index.html."
                      />
                      <Toggle
                        checked={input.spaFallback}
                        onChange={(next) => update("spaFallback", next)}
                        label="Single-page app fallback"
                        description="Serve /index.html for paths that do not match a file."
                      />
                    </>
                  ) : (
                    <Notice tone="warning" title="Directory browsing is always on">
                      The file manager serves a browsable index. Keep basic auth enabled unless
                      the folder is intentionally public.
                    </Notice>
                  )}
                </>
              ) : null}

              {input.kind === "redirect" ? (
                <div className="grid gap-4 sm:grid-cols-[1fr_140px]">
                  <Field
                    label="Destination"
                    htmlFor="redirectTo"
                    error={errors.redirectTo}
                    hint="Use {http.request.uri} to keep the original path."
                  >
                    <Input
                      id="redirectTo"
                      value={input.redirectTo}
                      onChange={(event) => update("redirectTo", event.target.value)}
                      placeholder="https://example.com{http.request.uri}"
                      spellCheck={false}
                    />
                  </Field>
                  <Field label="Status" htmlFor="redirectCode">
                    <Select
                      id="redirectCode"
                      value={input.redirectCode}
                      onChange={(event) => update("redirectCode", Number(event.target.value))}
                    >
                      <option value={301}>301 Permanent</option>
                      <option value={302}>302 Found</option>
                      <option value={307}>307 Temporary</option>
                      <option value={308}>308 Permanent</option>
                    </Select>
                  </Field>
                </div>
              ) : null}

              {input.kind === "respond" ? (
                <>
                  <Field label="Status code" htmlFor="respondStatus" error={errors.respondStatus}>
                    <Input
                      id="respondStatus"
                      type="number"
                      min={200}
                      max={599}
                      value={input.respondStatus}
                      onChange={(event) => update("respondStatus", Number(event.target.value))}
                    />
                  </Field>
                  <Field
                    label="Body"
                    htmlFor="respondBody"
                    error={errors.respondBody}
                    hint="HTML is served as text/html, everything else as plain text."
                  >
                    <Textarea
                      id="respondBody"
                      rows={6}
                      value={input.respondBody}
                      onChange={(event) => update("respondBody", event.target.value)}
                      placeholder="<h1>Down for maintenance</h1>"
                      className="font-mono"
                    />
                  </Field>
                </>
              ) : null}

              {input.kind === "custom" ? (
                <Field
                  label="Handler array (JSON)"
                  htmlFor="customHandlers"
                  error={errors.customHandlers}
                  hint="A JSON array passed straight to Caddy as the route handle chain."
                >
                  <Textarea
                    id="customHandlers"
                    rows={12}
                    value={input.customHandlers}
                    onChange={(event) => update("customHandlers", event.target.value)}
                    spellCheck={false}
                    className="font-mono text-xs"
                  />
                </Field>
              ) : null}
            </div>
          </Card>

          <Card>
            <CardHeader title="Options" description="TLS, compression and access control." />
            <div className="space-y-5 p-4">
              <Field
                label="TLS"
                htmlFor="tls"
                hint="Automatic uses Let's Encrypt/ZeroSSL. Local CA is best for LAN names. No certificate serves the site over plain HTTP only."
              >
                <Select
                  id="tls"
                  value={input.tls}
                  onChange={(event) => update("tls", event.target.value as SiteInput["tls"])}
                >
                  <option value="auto">Automatic HTTPS (public certificate)</option>
                  <option value="internal">Internal CA (Caddy local authority)</option>
                  <option value="off">No certificate (HTTP only)</option>
                </Select>
              </Field>

              {input.tls === "off" ? (
                <Notice tone="warning" title="No certificate will be issued">
                  The route is placed on Caddy's HTTP listener (port 80 by default,
                  or <code className="font-mono">CADDY_HTTP_PORT</code>). Browsers will
                  mark the site as not secure, and credentials should not be sent over
                  plain HTTP.
                </Notice>
              ) : null}

              <div className="border-t border-line pt-4">
                <Toggle
                  checked={input.encode}
                  onChange={(next) => update("encode", next)}
                  label="Compression"
                  description="Enable gzip and zstd response compression."
                />
              </div>

              <div className="border-t border-line pt-4">
                <Toggle
                  checked={input.auth.enabled}
                  onChange={(next) =>
                    update("auth", { ...input.auth, enabled: next })
                  }
                  label="HTTP basic auth"
                  description="Require a username and password before Caddy serves this site."
                />

                {input.auth.enabled ? (
                  <div className="mt-4 grid gap-4 sm:grid-cols-2">
                    <Field
                      label="Username"
                      htmlFor="authUser"
                      error={errors["auth.username"]}
                    >
                      <Input
                        id="authUser"
                        value={input.auth.username}
                        onChange={(event) => updateAuth("username", event.target.value)}
                        autoComplete="off"
                        spellCheck={false}
                      />
                    </Field>

                    <Field
                      label="Password"
                      htmlFor="authPassword"
                      error={errors["auth.password"]}
                      hint={
                        mode === "edit" && hadAuth
                          ? "Leave blank to keep the current password."
                          : undefined
                      }
                    >
                      <div className="relative">
                        <Input
                          id="authPassword"
                          type={showPassword ? "text" : "password"}
                          value={input.auth.password}
                          onChange={(event) => updateAuth("password", event.target.value)}
                          autoComplete="new-password"
                          className="pr-10"
                          placeholder={mode === "edit" && hadAuth ? "••••••••" : "Password"}
                        />
                        <button
                          type="button"
                          onClick={() => setShowPassword((current) => !current)}
                          className="absolute top-1/2 right-2 -translate-y-1/2 rounded-[2px] p-1 text-muted hover:bg-cloud hover:text-ink"
                          aria-label={showPassword ? "Hide password" : "Show password"}
                        >
                          {showPassword ? (
                            <EyeOff className="h-3.5 w-3.5" />
                          ) : (
                            <Eye className="h-3.5 w-3.5" />
                          )}
                        </button>
                      </div>
                    </Field>
                  </div>
                ) : input.kind === "filemanager" ? (
                  <div className="mt-4">
                    <Notice tone="warning" title="This folder would be public">
                      Basic auth is disabled. Anyone who can reach the hostname can browse and
                      download the folder contents.
                    </Notice>
                  </div>
                ) : null}
              </div>
            </div>
          </Card>
        </div>

        <aside className="space-y-6">
          <Card className="lg:sticky lg:top-20">
            <CardHeader title="Summary" />
            <div className="p-4">
              <dl>
                <KeyValue label="Type">{SITE_KIND_META[input.kind].label}</KeyValue>
                <KeyValue label="Hosts">
                  <span className="text-right">
                    {normalizedInput.hosts.length
                      ? hostLabel(normalizedInput.hosts)
                      : "Not set"}
                  </span>
                </KeyValue>
                <KeyValue label="TLS">
                  {input.tls === "auto"
                    ? "Automatic"
                    : input.tls === "internal"
                      ? "Local CA"
                      : "None (HTTP)"}
                </KeyValue>
                <KeyValue label="Server">{serverName ?? "Auto"}</KeyValue>
              </dl>

              <div className="mt-4 flex flex-wrap items-center gap-2">
                {input.encode ? <Badge tone="info">gzip + zstd</Badge> : null}
                {input.auth.enabled ? <Badge tone="purple">Basic auth</Badge> : null}
                {input.tls === "internal" ? (
                  <Badge tone="purple">
                    <ShieldCheck className="h-3 w-3" aria-hidden />
                    Local CA
                  </Badge>
                ) : null}
                {input.tls === "off" ? <Badge tone="warning">No TLS</Badge> : null}
              </div>

              <Button type="submit" className="mt-5 w-full" disabled={busy}>
                {busy ? <Spinner /> : <Save className="h-4 w-4" aria-hidden />}
                {saveLabel}
              </Button>
              <Link
                href="/sites"
                className={cn(buttonClass("ghost", "md"), "mt-2 w-full")}
              >
                Cancel
              </Link>

              <p className="mt-3 flex items-start gap-1.5 text-[11px] leading-relaxed text-muted">
                <AlertTriangle className="mt-0.5 h-3 w-3 shrink-0" aria-hidden />
                Saving writes to the live Caddy config. Existing traffic keeps running.
              </p>
            </div>
          </Card>

          <Card>
            <details className="group">
              <summary className="flex cursor-pointer list-none items-center justify-between gap-2 px-4 py-3 [&::-webkit-details-marker]:hidden">
                <span>
                  <span className="block text-sm font-bold tracking-wide text-ink uppercase">
                    Route preview
                  </span>
                  <span className="mt-0.5 block text-xs text-muted">
                    The Caddy JSON this form generates.
                  </span>
                </span>
                <ChevronDown
                  className="h-4 w-4 text-muted transition-transform group-open:rotate-180"
                  aria-hidden
                />
              </summary>
              <div className="border-t border-line p-3">
                <CodeBlock className="max-h-[32rem]">{previewText}</CodeBlock>
              </div>
            </details>
          </Card>
        </aside>
      </div>
    </form>
  );
}
