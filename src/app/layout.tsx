import type { Metadata } from "next";
import { getPreferences } from "@/lib/preferences-server";
import "./globals.css";

export const metadata: Metadata = {
  title: {
    default: "CaddyWeb",
    template: "%s · CaddyWeb",
  },
  description:
    "A simple, flat-design web UI for the Caddy Admin API. Create subdomains backed by reverse proxies, static files, redirects and more.",
  applicationName: "CaddyWeb",
  manifest: "/manifest.webmanifest",
  icons: {
    icon: [
      { url: "/icon.svg", type: "image/svg+xml" },
      { url: "/icon-192.png", sizes: "192x192", type: "image/png" },
      { url: "/icon-512.png", sizes: "512x512", type: "image/png" },
    ],
    apple: [{ url: "/apple-touch-icon.png", sizes: "180x180", type: "image/png" }],
    shortcut: ["/icon.svg"],
  },
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
