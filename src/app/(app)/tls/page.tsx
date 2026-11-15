import type { Metadata } from "next";
import { TlsView } from "@/components/tls/tls-view";

export const metadata: Metadata = { title: "TLS & certificates" };

export default function TlsPage() {
  return <TlsView />;
}
