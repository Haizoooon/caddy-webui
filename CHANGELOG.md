# Changelog

All notable changes to CaddyWeb are documented here.

## 0.3.0 — 2026-11-15

### Added

- Preferences on the Settings page:
  - Light, dark and system theme with a full dark palette.
  - Comfortable or compact table density.
  - Default site type, TLS mode and compression for the site builder.
- Preferences are stored in a cookie and applied server-side, so there is no
  theme flash on reload.
- Theme-aware scrollbars, inputs, badges, notices and code blocks.

### Fixed

- Docker builds failed with `failed to read dockerfile: open Dockerfile: no
  such file or directory` because `.dockerignore` excluded the Dockerfile.

## 0.2.1 — 2026-11-14

### Fixed

- Send an `Origin` header with every Caddy Admin API request so the panel works
  when the admin endpoint enables `enforce_origin`. Defaults to
  `http://127.0.0.1:2019` and can be overridden with `CADDY_ADMIN_ORIGIN`.

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
