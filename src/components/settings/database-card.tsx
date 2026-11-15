import Link from "next/link";
import { Database, Settings2, Users } from "lucide-react";
import { databaseStatus, type DatabaseStatus } from "@/lib/db";
import {
  Badge,
  Card,
  CardHeader,
  KeyValue,
  Notice,
  buttonClass,
} from "@/components/ui/primitives";

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export async function DatabaseCard() {
  const status: DatabaseStatus = await databaseStatus();

  return (
    <Card>
      <CardHeader
        title="Database"
        description="MySQL / MariaDB stores users, roles, API tokens and all dashboard settings."
        action={
          <Badge tone={status.open ? "success" : "danger"}>
            {status.open ? "Connected" : status.configured ? "Unavailable" : "Not configured"}
          </Badge>
        }
      />

      {!status.configured ? (
        <div className="p-4">
          <Notice tone="warning" title="Database setup required">
            CaddyWeb needs a MySQL or MariaDB database. Run the setup wizard to connect
            one and create the schema.
          </Notice>
          <Link href="/setup" className={`${buttonClass("primary", "md")} mt-3`}>
            <Settings2 className="h-4 w-4" aria-hidden />
            Open setup wizard
          </Link>
        </div>
      ) : status.open ? (
        <>
          <dl className="px-4 py-2">
            <KeyValue label="Engine">MySQL / MariaDB</KeyValue>
            <KeyValue label="Version">{status.version || "—"}</KeyValue>
            <KeyValue label="Host">
              <code className="font-mono text-xs">
                {status.host}:{status.port}
              </code>
            </KeyValue>
            <KeyValue label="Database">
              <code className="font-mono text-xs">{status.database}</code>
            </KeyValue>
            <KeyValue label="User">
              <code className="font-mono text-xs">{status.user}</code>
            </KeyValue>
            <KeyValue label="TLS">{status.ssl ? "Enabled" : "Disabled"}</KeyValue>
            <KeyValue label="Source">
              {status.source === "env" ? "Environment" : "Setup wizard"}
            </KeyValue>
            <KeyValue label="Size">{formatBytes(status.sizeBytes)}</KeyValue>
            <KeyValue label="Users">
              {status.users} total · {status.activeUsers} active
            </KeyValue>
            <KeyValue label="API tokens">{status.tokens} active</KeyValue>
            <KeyValue label="Schema version">{status.schemaVersion}</KeyValue>
          </dl>
          <div className="flex flex-wrap items-center gap-2 border-t border-line px-4 py-3">
            <Link href="/users" className={buttonClass("outline", "sm")}>
              <Users className="h-3.5 w-3.5" aria-hidden />
              Manage users
            </Link>
            {status.source === "file" ? (
              <Link href="/setup?edit=1" className={buttonClass("ghost", "sm")}>
                <Settings2 className="h-3.5 w-3.5" aria-hidden />
                Change connection
              </Link>
            ) : null}
          </div>
          <div className="border-t border-line px-4 py-3">
            <p className="flex items-start gap-2 text-xs leading-relaxed text-muted">
              <Database className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden />
              The connection is stored in <code className="font-mono">database.json</code>{" "}
              under <code className="font-mono">CADDYWEB_CONFIG_DIR</code>. The password is
              encrypted with <code className="font-mono">AUTH_SECRET</code>. Environment
              variables override the file.
            </p>
          </div>
        </>
      ) : (
        <div className="p-4">
          <Notice tone="danger" title="Database unavailable">
            {status.error ?? "The configured database could not be reached."}
          </Notice>
          <p className="mt-3 text-xs leading-relaxed text-muted">
            Check that MySQL/MariaDB is running, the credentials are correct and remote
            connections are allowed. The environment admin can still sign in while the
            database is down.
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            <Link href="/setup?edit=1" className={buttonClass("primary", "sm")}>
              <Settings2 className="h-3.5 w-3.5" aria-hidden />
              Fix connection
            </Link>
            <Link href="/setup" className={buttonClass("outline", "sm")}>
              Setup wizard
            </Link>
          </div>
        </div>
      )}
    </Card>
  );
}
