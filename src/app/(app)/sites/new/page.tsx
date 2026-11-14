import { SiteForm } from "@/components/sites/site-form";
import {
  emptySiteInput,
  siteKinds,
  type SiteKind,
} from "@/lib/caddy/schema";

export default async function NewSitePage({
  searchParams,
}: {
  searchParams: Promise<{ kind?: string }>;
}) {
  const params = await searchParams;
  const kind =
    siteKinds.find((candidate) => candidate === params.kind) ??
    ("reverse_proxy" as SiteKind);

  return (
    <SiteForm mode="create" initialKind={kind} initialInput={emptySiteInput(kind)} />
  );
}
