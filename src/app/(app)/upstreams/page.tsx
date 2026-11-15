import type { Metadata } from "next";
import { UpstreamsView } from "@/components/upstreams/upstreams-view";

export const metadata: Metadata = { title: "Upstreams" };

export default function UpstreamsPage() {
  return <UpstreamsView />;
}
