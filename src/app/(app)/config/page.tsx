import type { Metadata } from "next";
import { ConfigView } from "@/components/config/config-view";
import { requirePageRole } from "@/lib/guards";

export const metadata: Metadata = { title: "Raw config" };

export default async function ConfigPage() {
  await requirePageRole(["admin"]);
  return <ConfigView />;
}
