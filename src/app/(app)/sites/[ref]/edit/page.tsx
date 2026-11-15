import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { ArrowLeft } from "lucide-react";
import { getConfig } from "@/lib/caddy/admin";
import { CaddyError } from "@/lib/caddy/errors";
import { findRoute } from "@/lib/caddy/mutate";
import { parseSite, siteToInput } from "@/lib/caddy/parse";
import { decodeRef } from "@/lib/caddy/ref";
import { requirePageRole } from "@/lib/guards";
import { SiteForm } from "@/components/sites/site-form";
import { buttonClass, Notice } from "@/components/ui/primitives";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Edit site" };

export default async function EditSitePage({
  params,
}: {
  params: Promise<{ ref: string }>;
}) {
  await requirePageRole(["admin", "editor"]);
  const encodedRef = (await params).ref;
  const ref = decodeRef(encodedRef);
  if (!ref) notFound();

  let config;
  try {
    config = await getConfig();
  } catch (error) {
    return (
      <div>
        <Link href="/sites" className={buttonClass("outline", "sm")}>
          <ArrowLeft className="h-3.5 w-3.5" aria-hidden />
          Back to sites
        </Link>
        <Notice tone="danger" title="Caddy is unreachable" className="mt-4">
          {error instanceof CaddyError
            ? error.message
            : "The Caddy Admin API did not answer."}
        </Notice>
      </div>
    );
  }

  const found = findRoute(config, ref);
  if (!found) notFound();

  const site = parseSite(config, found.serverName, found.server, found.index);

  return (
    <SiteForm
      mode="edit"
      siteRef={encodedRef}
      initialInput={siteToInput(site, found.route)}
      managed={site.managed}
      hadAuth={site.auth}
      serverName={found.serverName}
    />
  );
}
