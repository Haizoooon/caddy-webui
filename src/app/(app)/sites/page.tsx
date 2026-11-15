import type { Metadata } from "next";
import { SitesView } from "@/components/sites/sites-view";

export const metadata: Metadata = { title: "Sites" };

export default function SitesPage() {
  return <SitesView />;
}
