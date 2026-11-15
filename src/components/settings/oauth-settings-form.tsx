"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { KeyRound, Save, ShieldCheck } from "lucide-react";
import type { OAuthSummary } from "@/lib/oauth-settings";
import { api, ClientApiError } from "@/lib/api-client";
import {
  Badge,
  Button,
  Card,
  CardHeader,
  CodeBlock,
  Notice,
  Spinner,
} from "@/components/ui/primitives";
import { Field, Input, Select, Toggle } from "@/components/ui/form";
import { useToast } from "@/components/ui/toast";

interface FormState {
  enabled: boolean;
  issuer: string;
  clientId: string;
  clientSecret: string;
  providerName: string;
  scopes: string;
  allowedUsers: string;
  allowedGroups: string;
  tokenAuthMethod: "basic" | "post";
  defaultRole: "viewer" | "editor";
  autoProvision: boolean;
  redirectUri: string;
}

export function OAuthSettingsForm({
  initial,
  callbackUrl,
}: {
  initial: OAuthSummary;
  callbackUrl: string;
}) {
  const router = useRouter();
  const { push } = useToast();
  const [form, setForm] = useState<FormState>({
    enabled: initial.enabled,
    issuer: initial.issuer,
    clientId: initial.clientId,
    clientSecret: "",
    providerName: initial.providerName,
    scopes: initial.scopes,
    allowedUsers: initial.allowedUsers.join(", "),
    allowedGroups: initial.allowedGroups.join(", "),
    tokenAuthMethod: initial.tokenAuthMethod,
    defaultRole: initial.defaultRole,
    autoProvision: initial.autoProvision,
    redirectUri: initial.redirectUri ?? "",
  });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  function update<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((current) => ({ ...current, [key]: value }));
    setError("");
  }

  async function save() {
    setBusy(true);
    setError("");

    try {
      await api("/api/admin/oauth", {
        method: "PUT",
        body: JSON.stringify({
          enabled: form.enabled,
          issuer: form.issuer,
          clientId: form.clientId,
          clientSecret: form.clientSecret || undefined,
          providerName: form.providerName,
          scopes: form.scopes,
          allowedUsers: form.allowedUsers
            .split(/[\s,]+/)
            .map((value) => value.trim())
            .filter(Boolean),
          allowedGroups: form.allowedGroups
            .split(/[\s,]+/)
            .map((value) => value.trim())
            .filter(Boolean),
          tokenAuthMethod: form.tokenAuthMethod,
          defaultRole: form.defaultRole,
          autoProvision: form.autoProvision,
          redirectUri: form.redirectUri || undefined,
        }),
      });

      setForm((current) => ({ ...current, clientSecret: "" }));
      push({
        tone: "success",
        title: "OAuth settings saved",
        description: form.enabled
          ? "The sign-in button is now available on the login page."
          : "Single sign-on is disabled; password login remains active.",
      });
      router.refresh();
    } catch (caught) {
      setError(
        caught instanceof ClientApiError || caught instanceof Error
          ? caught.message
          : "Could not save the OAuth settings.",
      );
    } finally {
      setBusy(false);
    }
  }

  const callback = form.redirectUri || callbackUrl;

  return (
    <Card className="mt-6">
      <CardHeader
        title="Single sign-on (OIDC)"
        description="Configure Authentik or any OpenID Connect provider. Password login always stays available."
        action={
          <Badge tone={initial.source === "database" ? "info" : initial.source === "env" ? "muted" : "muted"}>
            {initial.source === "database"
              ? "Database"
              : initial.source === "env"
                ? "Environment"
                : "Not configured"}
          </Badge>
        }
      />

      <div className="space-y-5 p-4">
        <div className="flex items-start justify-between gap-4 rounded-[3px] border border-line bg-cloud/40 p-3">
          <div>
            <p className="flex items-center gap-1.5 text-sm font-bold text-ink">
              <KeyRound className="h-4 w-4 text-primary-ink" aria-hidden />
              Enable OAuth sign-in
            </p>
            <p className="mt-0.5 text-xs leading-relaxed text-muted">
              The password form is never disabled. OAuth adds a second login path.
            </p>
          </div>
          <Toggle
            checked={form.enabled}
            onChange={(next) => update("enabled", next)}
            label=""
            ariaLabel="Enable OAuth sign-in"
          />
        </div>

        {error ? (
          <Notice tone="danger" title="Could not save">
            {error}
          </Notice>
        ) : null}

        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Provider name" htmlFor="oauthProviderName" hint="Shown on the login button.">
            <Input
              id="oauthProviderName"
              value={form.providerName}
              onChange={(event) => update("providerName", event.target.value)}
              placeholder="Authentik"
            />
          </Field>

          <Field label="Scopes" htmlFor="oauthScopes" hint="Space separated.">
            <Input
              id="oauthScopes"
              value={form.scopes}
              onChange={(event) => update("scopes", event.target.value)}
              placeholder="openid profile email"
              className="font-mono text-xs"
            />
          </Field>
        </div>

        <Field
          label="Issuer URL"
          htmlFor="oauthIssuer"
          hint="Authentik example: https://auth.example.com/application/o/caddyweb/"
        >
          <Input
            id="oauthIssuer"
            value={form.issuer}
            onChange={(event) => update("issuer", event.target.value)}
            placeholder="https://auth.example.com/application/o/caddyweb/"
            spellCheck={false}
            className="font-mono text-xs"
          />
        </Field>

        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Client ID" htmlFor="oauthClientId">
            <Input
              id="oauthClientId"
              value={form.clientId}
              onChange={(event) => update("clientId", event.target.value)}
              spellCheck={false}
              className="font-mono text-xs"
            />
          </Field>

          <Field
            label="Client secret"
            htmlFor="oauthClientSecret"
            hint={
              initial.hasSecret
                ? "A secret is stored. Leave blank to keep it."
                : "Leave blank for a public client with PKCE."
            }
          >
            <Input
              id="oauthClientSecret"
              type="password"
              autoComplete="new-password"
              value={form.clientSecret}
              onChange={(event) => update("clientSecret", event.target.value)}
              placeholder={initial.hasSecret ? "••••••••" : "Client secret"}
            />
          </Field>
        </div>

        <Field
          label="Redirect URI"
          htmlFor="oauthRedirectUri"
          optional
          hint={`Register this in Authentik: ${callback}`}
        >
          <Input
            id="oauthRedirectUri"
            value={form.redirectUri}
            onChange={(event) => update("redirectUri", event.target.value)}
            placeholder={callback}
            spellCheck={false}
            className="font-mono text-xs"
          />
        </Field>

        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Allowed users" htmlFor="oauthUsers" hint="Comma separated email, username or subject.">
            <Input
              id="oauthUsers"
              value={form.allowedUsers}
              onChange={(event) => update("allowedUsers", event.target.value)}
              placeholder="you@example.com"
            />
          </Field>

          <Field label="Allowed groups" htmlFor="oauthGroups" hint="Matched against the groups claim.">
            <Input
              id="oauthGroups"
              value={form.allowedGroups}
              onChange={(event) => update("allowedGroups", event.target.value)}
              placeholder="caddy-admins"
            />
          </Field>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Token endpoint auth" htmlFor="oauthTokenAuth">
            <Select
              id="oauthTokenAuth"
              value={form.tokenAuthMethod}
              onChange={(event) =>
                update("tokenAuthMethod", event.target.value as "basic" | "post")
              }
            >
              <option value="basic">Client secret basic (default)</option>
              <option value="post">Client secret post</option>
            </Select>
          </Field>

          <Field
            label="Role for new OAuth users"
            htmlFor="oauthDefaultRole"
            hint="Admins can change the role afterwards."
          >
            <Select
              id="oauthDefaultRole"
              value={form.defaultRole}
              onChange={(event) =>
                update("defaultRole", event.target.value as "viewer" | "editor")
              }
            >
              <option value="viewer">Viewer</option>
              <option value="editor">Editor</option>
            </Select>
          </Field>
        </div>

        <div className="border-t border-line pt-4">
          <Toggle
            checked={form.autoProvision}
            onChange={(next) => update("autoProvision", next)}
            label="Create accounts for new OAuth users"
            description="When disabled, only existing users can sign in with OAuth."
          />
        </div>

        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-line pt-4">
          <p className="flex items-start gap-1.5 text-xs leading-relaxed text-muted">
            <ShieldCheck className="mt-0.5 h-3.5 w-3.5 shrink-0 text-success-ink" aria-hidden />
            The client secret is encrypted at rest with AUTH_SECRET.
          </p>
          <Button onClick={save} disabled={busy}>
            {busy ? <Spinner /> : <Save className="h-4 w-4" aria-hidden />}
            Save OAuth settings
          </Button>
        </div>

        <CodeBlock>{`Callback: ${callback}\nIssuer:   ${form.issuer || "—"}\nScopes:   ${form.scopes || "—"}`}</CodeBlock>
      </div>
    </Card>
  );
}
