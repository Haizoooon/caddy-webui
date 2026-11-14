import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "CaddyWeb — Caddy control panel",
  description:
    "A simple, flat-design web UI for the Caddy Admin API. Create subdomains backed by reverse proxies, static files, redirects and more.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
