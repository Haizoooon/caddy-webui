import type { ReactNode } from "react";
import { redirect } from "next/navigation";
import { requirePageUser } from "@/lib/guards";
import { dbHealthy } from "@/lib/db";
import { isDbConfigured } from "@/lib/db-config";
import { startMonitor } from "@/lib/monitor";
import { AppShell } from "@/components/layout/app-shell";
import { ToastProvider } from "@/components/ui/toast";

export const dynamic = "force-dynamic";

export default async function AppLayout({ children }: { children: ReactNode }) {
  startMonitor();
  const user = await requirePageUser();

  if (!isDbConfigured()) redirect("/setup");
  if (!(await dbHealthy())) redirect("/setup");

  return (
    <ToastProvider>
      <AppShell user={user}>{children}</AppShell>
    </ToastProvider>
  );
}
