import type { Metadata } from "next";
import { SitesView } from "@/components/sites/sites-view";
import { requirePageUser } from "@/lib/guards";

export const metadata: Metadata = { title: "Sites" };

export default async function SitesPage() {
  const user = await requirePageUser();
  return <SitesView role={user.role} />;
}
