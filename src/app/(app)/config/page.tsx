import type { Metadata } from "next";
import { ConfigView } from "@/components/config/config-view";

export const metadata: Metadata = { title: "Raw config" };

export default function ConfigPage() {
  return <ConfigView />;
}
