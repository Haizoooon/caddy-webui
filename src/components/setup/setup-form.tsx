"use client";

import { useState } from "react";
import { CheckCircle2, PlugZap, Save } from "lucide-react";
import { api, ClientApiError } from "@/lib/api-client";
import type { DbConfigSummary } from "@/lib/db-config";
import {
  Badge,
  Button,
  Card,
  CardHeader,
  CodeBlock,
  Notice,
  Spinner,
} from "@/components/ui/primitives";
import { Field, Input, Select } from "@/components/ui/form";

interface FormState {
  host: string;
  port: string;
  database: string;
  user: string;
  password: string;
  sslMode: "disabled" | "required" | "insecure";
}

export function SetupForm({
  initial,
  source,
}: {
  initial: DbConfigSummary | null;
  source: "env" | "file" | "none";
}) {
  const [form, setForm] = useState<FormState>({
    host: initial?.host || "localhost",
    port: String(initial?.port || 3306),
    database: initial?.database || "caddyweb",
    user: initial?.user || "caddyweb",
    password: "",
    sslMode: initial?.ssl
      ? initial.sslRejectUnauthorized
        ? "required"
        : "insecure"
      : "disabled",
  });
  const [busy, setBusy] = useState<"test" | "save" | null>(null);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const readOnly = source === "env";

  function update<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((current) => ({ ...current, [key]: value }));
    setError("");
    setSuccess("");
  }

  function payload() {
    return {
      host: form.host,
      port: Number(form.port),
      database: form.database,
      user: form.user,
      password: form.password || undefined,
      ssl: form.sslMode !== "disabled",
      sslRejectUnauthorized: form.sslMode !== "insecure",
    };
  }

  async function testConnection() {
    setBusy("test");
    setError("");
    setSuccess("");
    try {
      const result = await api<{
        ok: true;
        test: { ok: boolean; version?: string; error?: string };
      }>("/api/setup/test", {
        method: "POST",
        body: JSON.stringify(payload()),
      });

      if (result.test.ok) {
        setSuccess(`Connected successfully${result.test.version ? ` · ${result.test.version}` : ""}.`);
      } else {
        setError(result.test.error ?? "Connection failed.");
      }
    } catch (caught) {
      setError(
        caught instanceof ClientApiError || caught instanceof Error
          ? caught.message
          : "Connection test failed.",
      );
    } finally {
      setBusy(null);
    }
  }

  async function configure() {
    setBusy("save");
    setError("");
    setSuccess("");
    try {
      await api("/api/setup/configure", {
        method: "POST",
        body: JSON.stringify(payload()),
      });
      window.location.href = "/";
    } catch (caught) {
      setError(
        caught instanceof ClientApiError || caught instanceof Error
          ? caught.message
          : "Could not configure the database.",
      );
      setBusy(null);
    }
  }

  return (
    <Card>
      <CardHeader
        title="MySQL / MariaDB connection"
        description="The schema is created automatically and the environment admin is seeded as the first Admin."
        action={
          <Badge tone={source === "env" ? "info" : source === "file" ? "muted" : "warning"}>
            {source === "env" ? "Environment" : source === "file" ? "Saved" : "Not configured"}
          </Badge>
        }
      />

      <div className="space-y-5 p-4">
        {readOnly ? (
          <Notice tone="info" title="Managed by environment variables">
            This deployment uses <code className="font-mono">DATABASE_URL</code> or{" "}
            <code className="font-mono">DB_HOST</code> and related variables. Change those in
            the container environment instead of this form.
          </Notice>
        ) : null}

        <div className="grid gap-4 sm:grid-cols-[1fr_110px]">
          <Field label="Host" htmlFor="setupHost">
            <Input
              id="setupHost"
              value={form.host}
              onChange={(event) => update("host", event.target.value)}
              placeholder="mysql.example.com"
              spellCheck={false}
              disabled={readOnly}
            />
          </Field>
          <Field label="Port" htmlFor="setupPort">
            <Input
              id="setupPort"
              type="number"
              min={1}
              max={65535}
              value={form.port}
              onChange={(event) => update("port", event.target.value)}
              disabled={readOnly}
            />
          </Field>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Database" htmlFor="setupDatabase">
            <Input
              id="setupDatabase"
              value={form.database}
              onChange={(event) => update("database", event.target.value)}
              placeholder="caddyweb"
              spellCheck={false}
              disabled={readOnly}
            />
          </Field>
          <Field label="User" htmlFor="setupUser">
            <Input
              id="setupUser"
              value={form.user}
              onChange={(event) => update("user", event.target.value)}
              placeholder="caddyweb"
              spellCheck={false}
              autoComplete="off"
              disabled={readOnly}
            />
          </Field>
        </div>

        <Field
          label="Password"
          htmlFor="setupPassword"
          hint={
            initial?.hasPassword
              ? "A password is stored. Leave blank to keep it."
              : "The database user needs CREATE/ALTER/INDEX privileges to create the schema."
          }
        >
          <Input
            id="setupPassword"
            type="password"
            autoComplete="new-password"
            value={form.password}
            onChange={(event) => update("password", event.target.value)}
            placeholder={initial?.hasPassword ? "••••••••" : "Password"}
            disabled={readOnly}
          />
        </Field>

        <Field
          label="TLS"
          htmlFor="setupSsl"
          hint="Use required TLS for managed databases. Only disable certificate verification for a trusted self-signed server."
        >
          <Select
            id="setupSsl"
            value={form.sslMode}
            onChange={(event) =>
              update("sslMode", event.target.value as FormState["sslMode"])
            }
            disabled={readOnly}
          >
            <option value="disabled">Disabled</option>
            <option value="required">Required + verify certificate</option>
            <option value="insecure">Required, allow self-signed</option>
          </Select>
        </Field>

        <Notice tone="info" title="What happens on save">
          CaddyWeb tests the connection, creates its tables if they do not exist and writes
          the encrypted connection file.
          <code className="mt-2 block font-mono text-[11px]">
            CREATE TABLE IF NOT EXISTS users, api_tokens, settings, audit_log, email_log
          </code>
        </Notice>

        {success ? (
          <Notice tone="success" title="Connection OK" action={<CheckCircle2 className="h-4 w-4 text-success-ink" />}>
            {success}
          </Notice>
        ) : null}

        {error ? (
          <Notice tone="danger" title="Database error">
            {error}
          </Notice>
        ) : null}

        {!readOnly ? (
          <div className="flex flex-wrap items-center justify-between gap-3 border-t border-line pt-4">
            <p className="text-xs leading-relaxed text-muted">
              Connection settings are stored in <code className="font-mono">database.json</code>{" "}
              with an encrypted password.
            </p>
            <div className="flex gap-2">
              <Button
                variant="outline"
                onClick={testConnection}
                disabled={busy !== null}
              >
                {busy === "test" ? <Spinner /> : <PlugZap className="h-4 w-4" aria-hidden />}
                Test connection
              </Button>
              <Button onClick={configure} disabled={busy !== null}>
                {busy === "save" ? <Spinner /> : <Save className="h-4 w-4" aria-hidden />}
                Save &amp; create schema
              </Button>
            </div>
          </div>
        ) : null}

        <CodeBlock>{`# Docker Compose environment alternative
DATABASE_URL=mysql://caddyweb:password@mysql:3306/caddyweb
# or
DB_HOST=mysql
DB_PORT=3306
DB_NAME=caddyweb
DB_USER=caddyweb
DB_PASSWORD=password`}</CodeBlock>
      </div>
    </Card>
  );
}
