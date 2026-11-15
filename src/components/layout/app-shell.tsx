"use client";

import { useEffect, useState, type ReactNode } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import useSWR from "swr";
import {
  Braces,
  CircleDot,
  Globe,
  LayoutDashboard,
  LogOut,
  Menu,
  Network,
  Plus,
  Settings,
  ShieldCheck,
  X,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { fetcher } from "@/lib/api-client";
import type { StatusResponse } from "@/lib/api-types";
import { useToast } from "@/components/ui/toast";
import { buttonClass, Spinner } from "@/components/ui/primitives";

const navigation = [
  { href: "/", label: "Dashboard", icon: LayoutDashboard },
  { href: "/sites", label: "Sites", icon: Globe },
  { href: "/upstreams", label: "Upstreams", icon: Network },
  { href: "/tls", label: "TLS", icon: ShieldCheck },
  { href: "/config", label: "Config", icon: Braces },
  { href: "/settings", label: "Settings", icon: Settings },
];

function pageTitle(pathname: string): string {
  if (pathname === "/") return "Dashboard";
  if (pathname.startsWith("/sites/new")) return "New site";
  if (pathname.startsWith("/sites/") && pathname.endsWith("/edit")) return "Edit site";
  if (pathname.startsWith("/sites")) return "Sites";
  if (pathname.startsWith("/upstreams")) return "Upstreams";
  if (pathname.startsWith("/tls")) return "TLS";
  if (pathname.startsWith("/config")) return "Raw config";
  if (pathname.startsWith("/settings")) return "Settings";
  return "CaddyWeb";
}

function isActive(pathname: string, href: string): boolean {
  if (href === "/") return pathname === "/";
  return pathname === href || pathname.startsWith(`${href}/`);
}

export function AppShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const [menuOpen, setMenuOpen] = useState(false);
  const [signingOut, setSigningOut] = useState(false);
  const { push } = useToast();
  const { data: status, isLoading } = useSWR<StatusResponse>("/api/caddy/status", fetcher, {
    refreshInterval: 15000,
    revalidateOnFocus: true,
  });

  useEffect(() => {
    setMenuOpen(false);
  }, [pathname]);

  async function signOut() {
    setSigningOut(true);
    try {
      await fetch("/api/auth/logout", { method: "POST" });
      window.location.href = "/login";
    } catch {
      push({ tone: "danger", title: "Could not sign out" });
      setSigningOut(false);
    }
  }

  return (
    <div className="min-h-screen bg-canvas">
      {menuOpen ? (
        <button
          type="button"
          aria-label="Close navigation"
          className="fixed inset-0 z-40 bg-black/50 lg:hidden"
          onClick={() => setMenuOpen(false)}
        />
      ) : null}

      <aside
        className={cn(
          "fixed inset-y-0 left-0 z-50 flex w-64 flex-col border-r border-line bg-surface transition-transform lg:translate-x-0",
          menuOpen ? "translate-x-0" : "-translate-x-full",
        )}
      >
        <div className="flex items-center justify-between gap-2 border-b border-line px-4 py-4">
          <Link href="/" className="flex items-center gap-3">
            <img src="/icon.svg" alt="" className="h-9 w-9" />
            <span>
              <span className="block text-sm font-bold tracking-tight text-ink">CaddyWeb</span>
              <span className="block text-[11px] font-medium text-muted">
                Caddy Admin UI
              </span>
            </span>
          </Link>
          <button
            type="button"
            className="rounded-[3px] p-1.5 text-muted hover:bg-cloud hover:text-ink lg:hidden"
            onClick={() => setMenuOpen(false)}
            aria-label="Close navigation"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <nav className="flex-1 space-y-1 overflow-y-auto px-3 py-4">
          <p className="px-2 pb-2 text-[10px] font-bold tracking-[0.14em] text-muted uppercase">
            Manage
          </p>
          {navigation.map((item) => {
            const active = isActive(pathname, item.href);
            const Icon = item.icon;
            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  "flex items-center gap-2.5 rounded-[3px] border px-2.5 py-2 text-sm font-semibold transition-colors",
                  active
                    ? "border-primary/20 bg-primary/10 text-primary-ink"
                    : "border-transparent text-ink-soft hover:bg-cloud",
                )}
              >
                <Icon className="h-4 w-4 shrink-0" aria-hidden />
                {item.label}
                {active ? (
                  <span className="ml-auto h-1.5 w-1.5 rounded-full bg-primary" aria-hidden />
                ) : null}
              </Link>
            );
          })}

          <div className="pt-4">
            <p className="px-2 pb-2 text-[10px] font-bold tracking-[0.14em] text-muted uppercase">
              Shortcut
            </p>
            <Link
              href="/sites/new"
              className={cn(buttonClass("outline", "sm"), "w-full justify-start")}
            >
              <Plus className="h-3.5 w-3.5" aria-hidden />
              New subdomain
            </Link>
          </div>
        </nav>

        <div className="space-y-3 border-t border-line px-4 py-4">
          <Link
            href="/settings"
            className="flex items-center gap-2 text-xs font-medium text-muted hover:text-ink"
          >
            <CircleDot
              className={cn("h-3.5 w-3.5", status?.connected ? "text-success" : "text-danger")}
              aria-hidden
            />
            {isLoading ? "Checking Caddy…" : status?.connected ? "Admin API connected" : "Admin API offline"}
          </Link>
          <code className="block truncate font-mono text-[10.5px] text-muted">
            {status?.adminUrl ?? "localhost:2019"}
          </code>
          {status && !status.authEnabled ? null : (
            <button
              type="button"
              onClick={signOut}
              disabled={signingOut}
              className="flex w-full items-center gap-2 rounded-[3px] border border-transparent px-2 py-1.5 text-xs font-semibold text-muted hover:border-line hover:bg-cloud hover:text-ink disabled:opacity-50"
            >
              {signingOut ? (
                <Spinner className="h-3.5 w-3.5" />
              ) : (
                <LogOut className="h-3.5 w-3.5" />
              )}
              Sign out
            </button>
          )}
        </div>
      </aside>

      <div className="lg:pl-64">
        <header className="sticky top-0 z-30 border-b border-line bg-canvas">
          <div className="mx-auto flex h-14 w-full max-w-6xl items-center justify-between gap-3 px-4 sm:px-6 lg:px-8">
            <div className="flex min-w-0 items-center gap-2">
              <button
                type="button"
                className="rounded-[3px] border border-line bg-surface p-1.5 text-ink-soft hover:bg-cloud lg:hidden"
                onClick={() => setMenuOpen(true)}
                aria-label="Open navigation"
              >
                <Menu className="h-4 w-4" />
              </button>
              <div className="flex min-w-0 items-baseline gap-2">
                <span className="hidden text-xs font-semibold tracking-wide text-muted uppercase sm:inline">
                  CaddyWeb
                </span>
                <span className="hidden text-muted sm:inline">/</span>
                <span className="truncate text-sm font-bold text-ink">{pageTitle(pathname)}</span>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <span
                className={cn(
                  "inline-flex items-center gap-1.5 rounded-[3px] border px-2.5 py-1.5 text-[11px] font-bold whitespace-nowrap",
                  status?.connected
                    ? "border-success/30 bg-success/10 text-success-ink"
                    : "border-danger/30 bg-danger/10 text-danger-ink",
                )}
                title={status?.error ?? status?.adminUrl}
              >
                <span
                  className={cn(
                    "h-1.5 w-1.5 rounded-full",
                    status?.connected ? "bg-success" : "bg-danger",
                  )}
                  aria-hidden
                />
                {isLoading ? "Checking" : status?.connected ? "Online" : "Offline"}
              </span>
              <Link
                href="/sites/new"
                className={cn(buttonClass("primary", "sm"), "hidden sm:inline-flex")}
              >
                <Plus className="h-3.5 w-3.5" aria-hidden />
                New site
              </Link>
            </div>
          </div>
        </header>

        <main className="mx-auto w-full max-w-6xl px-4 py-6 sm:px-6 sm:py-8 lg:px-8">
          {children}
        </main>
      </div>
    </div>
  );
}
