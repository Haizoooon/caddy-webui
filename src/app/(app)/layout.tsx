import type { ReactNode } from "react";
import { requirePageUser } from "@/lib/guards";
import { startMonitor } from "@/lib/monitor";
import { AppShell } from "@/components/layout/app-shell";
import { ToastProvider } from "@/components/ui/toast";

export const dynamic = "force-dynamic";

export default async function AppLayout({ children }: { children: ReactNode }) {
  startMonitor();
  const user = await requirePageUser();

  return (
    <ToastProvider>
      <AppShell user={user}>{children}</AppShell>
    </ToastProvider>
  );
}
