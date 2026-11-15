import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { Database } from "lucide-react";
import { requirePageUser } from "@/lib/guards";
import {
  getDbConfigSummary,
  loadDbConfig,
  testDbConnection,
} from "@/lib/db-config";
import { APP_VERSION } from "@/lib/version";
import { SetupForm } from "@/components/setup/setup-form";
import { SignOutButton } from "@/components/settings/sign-out-button";
import { Notice } from "@/components/ui/primitives";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Database setup" };

export default async function SetupPage({
  searchParams,
}: {
  searchParams: Promise<{ edit?: string }>;
}) {
  const user = await requirePageUser();
  const params = await searchParams;
  const edit = params.edit === "1";
  const summary = getDbConfigSummary();
  const config = loadDbConfig();

  let healthy = false;
  let connectionError = "";

  if (config) {
    const result = await testDbConnection(config);
    healthy = result.ok;
    connectionError = result.error ?? "";
  }

  if (healthy && !edit) redirect("/");

  return (
    <main className="flex min-h-screen items-center justify-center bg-canvas px-4 py-10">
      <div className="w-full max-w-3xl">
        <div className="mb-5 flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <img src="/icon.svg" alt="" className="h-10 w-10" />
            <div>
              <p className="text-base font-bold tracking-tight text-ink">CaddyWeb setup</p>
              <p className="text-xs text-muted">Signed in as {user.name || user.username}</p>
            </div>
          </div>
          <SignOutButton />
        </div>

        <div className="mb-5 rounded-[3px] border border-line bg-surface p-5">
          <div className="flex items-start gap-3">
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-[3px] bg-primary text-white">
              <Database className="h-4 w-4" aria-hidden />
            </span>
            <div>
              <h1 className="text-xl font-bold tracking-tight text-ink">
                Connect MySQL or MariaDB
              </h1>
              <p className="mt-1 text-sm leading-relaxed text-muted">
                External database accounts, roles, API tokens, OAuth/SMTP settings and
                email history live in MySQL or MariaDB. The embedded SQLite database has
                been removed.
              </p>
            </div>
          </div>
        </div>

        {summary?.source === "file" && healthy ? (
          <div className="mb-5">
            <Notice tone="warning" title="Changing the database">
              Saving a new connection points CaddyWeb at a different database. Existing
              data in the current database is not copied automatically.
            </Notice>
          </div>
        ) : null}

        {config && !healthy ? (
          <div className="mb-5">
            <Notice tone="danger" title="The saved database is unreachable">
              {connectionError || "The connection failed."} Fix the connection below, or
              update the environment variables if this is an environment-managed setup.
            </Notice>
          </div>
        ) : null}

        {!summary ? (
          <div className="mb-5">
            <Notice tone="warning" title="First-run setup">
              No database is configured yet. CaddyWeb is running with the environment admin
              login so you can complete this step. After saving, the schema is created and
              the environment admin is seeded into the database.
            </Notice>
          </div>
        ) : null}

        <SetupForm initial={summary} source={summary?.source ?? "none"} />

        <p className="mt-5 text-center text-xs leading-relaxed text-muted">
          CaddyWeb {APP_VERSION} · MySQL and MariaDB are supported through the same driver.
        </p>
      </div>
    </main>
  );
}
