import Link from "next/link";
import { Database, Download, Users } from "lucide-react";
import { databaseStatus } from "@/lib/db";
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

export function DatabaseCard() {
  const status = databaseStatus();

  return (
    <Card className="mt-6">
      <CardHeader
        title="Database"
        description="Embedded SQLite for users, roles, API tokens and OAuth settings."
        action={
          <Badge tone={status.open ? "success" : "danger"}>
            {status.open ? "Connected" : "Unavailable"}
          </Badge>
        }
      />

      {status.open ? (
        <>
          <dl className="px-4 py-2">
            <KeyValue label="Engine">SQLite (embedded)</KeyValue>
            <KeyValue label="File">
              <code className="font-mono text-xs break-all">{status.path}</code>
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
            <a
              href="/api/admin/database/backup"
              className={buttonClass("ghost", "sm")}
            >
              <Download className="h-3.5 w-3.5" aria-hidden />
              Download backup
            </a>
          </div>
          <div className="border-t border-line px-4 py-3">
            <p className="flex items-start gap-2 text-xs leading-relaxed text-muted">
              <Database className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden />
              The database lives in <code className="font-mono">CADDYWEB_DATA_DIR</code>{" "}
              (default <code className="font-mono">/app/data</code> in Docker). Mount that
              directory as a volume to keep users and settings across container restarts.
            </p>
          </div>
        </>
      ) : (
        <div className="p-4">
          <Notice tone="danger" title="Database unavailable">
            {status.error ??
              "The embedded SQLite database could not be opened. Environment password login still works."}
          </Notice>
          <p className="mt-3 text-xs leading-relaxed text-muted">
            File: <code className="font-mono">{status.path}</code>. Check that the data
            directory is writable and mounted.
          </p>
        </div>
      )}
    </Card>
  );
}
