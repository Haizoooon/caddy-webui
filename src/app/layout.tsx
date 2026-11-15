import type { Metadata } from "next";
import { getPreferences } from "@/lib/preferences-server";
import "./globals.css";

export const metadata: Metadata = {
  title: "CaddyWeb — Caddy control panel",
  description:
    "A simple, flat-design web UI for the Caddy Admin API. Create subdomains backed by reverse proxies, static files, redirects and more.",
};

export const dynamic = "force-dynamic";

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const preferences = await getPreferences();

  return (
    <html
      lang="en"
      className={preferences.theme === "dark" ? "dark" : undefined}
      data-theme={preferences.theme}
      data-density={preferences.density}
      suppressHydrationWarning
    >
      <body>{children}</body>
    </html>
  );
}
