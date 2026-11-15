"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { AlertTriangle, ArrowRight, Lock, User } from "lucide-react";
import { api, ClientApiError } from "@/lib/api-client";
import { Button } from "@/components/ui/primitives";
import { Field, Input } from "@/components/ui/form";

export function LoginForm({ defaultUsername = "" }: { defaultUsername?: string }) {
  const router = useRouter();
  const [username, setUsername] = useState(defaultUsername);
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const canSubmit = username.trim().length > 0 && password.length > 0;

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setBusy(true);

    try {
      await api<{ ok: true }>("/api/auth/login", {
        method: "POST",
        body: JSON.stringify({ username, password }),
      });
      router.replace("/");
      router.refresh();
    } catch (caught) {
      setError(
        caught instanceof ClientApiError
          ? caught.message
          : "Could not sign in. Please try again.",
      );
      setBusy(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="space-y-4">
      <Field label="Username" htmlFor="username">
        <div className="relative">
          <User
            aria-hidden
            className="pointer-events-none absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-muted"
          />
          <Input
            id="username"
            name="username"
            type="text"
            autoComplete="username"
            autoCapitalize="none"
            spellCheck={false}
            required
            autoFocus={!defaultUsername}
            value={username}
            onChange={(event) => setUsername(event.target.value)}
            placeholder="admin"
            className="pl-9"
          />
        </div>
      </Field>

      <Field
        label="Password"
        htmlFor="password"
        hint="Credentials are configured with APP_USERNAME and APP_PASSWORD."
      >
        <div className="relative">
          <Lock
            aria-hidden
            className="pointer-events-none absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-muted"
          />
          <Input
            id="password"
            name="password"
            type="password"
            autoComplete="current-password"
            required
            autoFocus={Boolean(defaultUsername)}
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            placeholder="Enter your password"
            className="pl-9"
          />
        </div>
      </Field>

      {error ? (
        <div className="flex items-start gap-2 rounded-[3px] border border-danger/30 bg-danger/10 px-3 py-2.5 text-sm text-danger-ink">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
          <span>{error}</span>
        </div>
      ) : null}

      <Button type="submit" className="w-full" disabled={busy || !canSubmit}>
        {busy ? "Signing in…" : "Sign in"}
        {!busy ? <ArrowRight className="h-4 w-4" aria-hidden /> : null}
      </Button>
    </form>
  );
}
