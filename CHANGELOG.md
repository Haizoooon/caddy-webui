# Changelog

All notable changes to CaddyWeb are documented here.

## 0.2.0 — 2026-11-14

### Added

- Username + password login (`APP_USERNAME` / `APP_PASSWORD`).
- Login rate limiting and session cookies signed with `AUTH_SECRET`.
- "Panel locked" setup screen when credentials are not configured.
- CI workflow for typechecking, building and building the Docker image.
- Security policy and repository housekeeping files.

### Changed

- Authentication is now mandatory. There is no unauthenticated mode; without
  `APP_PASSWORD` every page and API route stays locked.
- The container listens on **18080** instead of 3000 to avoid common conflicts.
  The host port is configurable with `CADDYWEB_PORT`.
- `COOKIE_SECURE` is auto-detected from HTTPS / `X-Forwarded-Proto`, and can
  still be forced.
- Logout clears the cookie with the same security attributes used to set it.

## 0.1.0 — 2026-11-14

### Added

- Flat-UI control panel for the Caddy Admin API.
- Reverse proxy, static site, file manager, redirect, respond and custom routes.
- Automatic HTTPS and internal CA policies.
- Upstream overview, raw JSON editor and Caddyfile import.
- Docker image for `linux/amd64`.
