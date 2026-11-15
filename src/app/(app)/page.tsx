import type { Metadata } from "next";
import { DashboardView } from "@/components/dashboard/dashboard-view";
import { requirePageUser } from "@/lib/guards";

export const metadata: Metadata = { title: "Dashboard" };

export default async function DashboardPage() {
  const user = await requirePageUser();
  return <DashboardView role={user.role} />;
}
