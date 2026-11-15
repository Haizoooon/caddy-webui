import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import type { Metadata } from "next";
import { LockKeyhole, ShieldCheck } from "lucide-react";
import {
  appUsername,
  isAuthEnabled,
  SESSION_COOKIE,
  verifySessionToken,
} from "@/lib/session";
import { APP_VERSION } from "@/lib/version";
import { LoginForm } from "@/components/auth/login-form";
import { CodeBlock, Notice } from "@/components/ui/primitives";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Sign in" };

const highlights = [
  "Create subdomains for reverse proxies, static files and redirects.",
  "Caddy handles certificates automatically — or use its local CA.",
  "Every request is authenticated before it can change Caddy.",
];

export default async function LoginPage() {
  const configured = isAuthEnabled();

  if (configured) {
    const token = (await cookies()).get(SESSION_COOKIE)?.value;
    if (await verifySessionToken(token)) redirect("/");
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-canvas px-4 py-10">
      <div className="grid w-full max-w-4xl overflow-hidden rounded-[3px] border border-line bg-surface md:grid-cols-[1.05fr_1fr]">
        <section className="hidden flex-col justify-between bg-primary p-10 text-white md:flex">
          <div>
            <div className="flex items-center gap-3">
              <img src="/icon.svg" alt="" className="h-10 w-10" />
              <div>
                <p className="text-lg font-bold tracking-tight">CaddyWeb</p>
                <p className="text-xs font-medium text-white/75">Caddy Admin UI</p>
              </div>
            </div>

            <h1 className="mt-12 text-3xl leading-tight font-bold tracking-tight">
              Your Caddy server,
              <br />
              without the JSON.
            </h1>
            <p className="mt-3 max-w-sm text-sm leading-relaxed text-white/85">
              A flat, friendly interface on top of the Caddy Admin API at{" "}
              <code className="rounded-[2px] bg-white/15 px-1 py-0.5 font-mono text-[12px]">
                localhost:2019
              </code>
              .
            </p>
          </div>

          <ul className="mt-10 space-y-4">
            {highlights.map((item) => (
              <li key={item} className="flex items-start gap-3 text-sm text-white/90">
                <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
                <span>{item}</span>
              </li>
            ))}
          </ul>
        </section>

        <section className="p-6 sm:p-10">
          <div className="mb-8 flex items-center gap-3 md:hidden">
            <img src="/icon.svg" alt="" className="h-9 w-9" />
            <div>
              <p className="text-base font-bold tracking-tight text-ink">CaddyWeb</p>
              <p className="text-xs text-muted">Caddy Admin UI</p>
            </div>
          </div>

          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-[11px] font-bold tracking-[0.14em] text-muted uppercase">
                Restricted area
              </p>
              <h2 className="mt-2 text-2xl font-bold tracking-tight text-ink">
                {configured ? "Sign in to continue" : "Panel locked"}
              </h2>
            </div>
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-[3px] bg-ink text-canvas">
              <LockKeyhole className="h-4 w-4" aria-hidden />
            </span>
          </div>

          {configured ? (
            <>
              <p className="mt-1 mb-7 text-sm text-muted">
                Enter the credentials configured for this panel. Sessions last seven days.
              </p>
              <LoginForm defaultUsername={appUsername()} />
            </>
          ) : (
            <div className="mt-4 space-y-4">
              <Notice tone="danger" title="Configuration required">
                The panel refuses to run without a password. Set{" "}
                <code className="font-mono text-[11px]">APP_PASSWORD</code> and restart the
                container. Until then, every page and API call stays locked.
              </Notice>

              <CodeBlock>{`APP_USERNAME=admin
APP_PASSWORD=choose-a-strong-password
AUTH_SECRET=$(openssl rand -hex 32)`}</CodeBlock>

              <p className="text-xs leading-relaxed text-muted">
                With Docker Compose the password is required by the service definition. After
                editing <code className="font-mono">.env</code>, recreate the container:
              </p>
              <CodeBlock>{`docker compose up -d --force-recreate caddyweb`}</CodeBlock>
            </div>
          )}

          <p className="mt-8 border-t border-line pt-4 text-xs leading-relaxed text-muted">
            CaddyWeb {APP_VERSION} · credentials are read from the container environment and never
            stored in the browser.
          </p>
        </section>
      </div>
    </main>
  );
}
