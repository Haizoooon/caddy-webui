import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "CaddyWeb",
    short_name: "CaddyWeb",
    description:
      "Flat-design control panel for the Caddy Admin API: reverse proxies, static sites, redirects and TLS.",
    start_url: "/",
    display: "standalone",
    background_color: "#f4f8f9",
    theme_color: "#1abc9c",
    icons: [
      { src: "/icon-192.png", sizes: "192x192", type: "image/png" },
      { src: "/icon-512.png", sizes: "512x512", type: "image/png" },
      { src: "/icon.svg", sizes: "any", type: "image/svg+xml" },
    ],
  };
}
