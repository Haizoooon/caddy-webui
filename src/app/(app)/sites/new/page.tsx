import type { Metadata } from "next";
import { SiteForm } from "@/components/sites/site-form";
import {
  emptySiteInput,
  siteKinds,
  type SiteKind,
} from "@/lib/caddy/schema";
import { getPreferences } from "@/lib/preferences-server";
import { requirePageRole } from "@/lib/guards";

export const metadata: Metadata = { title: "New site" };

export default async function NewSitePage({
  searchParams,
}: {
  searchParams: Promise<{ kind?: string }>;
}) {
  await requirePageRole(["admin", "editor"]);
  const params = await searchParams;
  const preferences = await getPreferences();
  const requestedKind = siteKinds.find((candidate) => candidate === params.kind);
  const kind: SiteKind = requestedKind ?? preferences.defaultKind;

  const initialInput = emptySiteInput(kind);
  initialInput.tls = preferences.defaultTls;
  initialInput.encode = preferences.defaultEncode;

  return <SiteForm mode="create" initialKind={kind} initialInput={initialInput} />;
}
