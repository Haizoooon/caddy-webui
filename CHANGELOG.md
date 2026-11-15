# Changelog

All notable changes to CaddyWeb are documented here.

## 0.8.0 — 2026-11-15

### Added

- MySQL and MariaDB support through `mysql2`; SQLite has been removed.
- First-run setup wizard at `/setup` with connection testing, schema creation,
  admin seeding and encrypted `database.json` storage.
- Environment configuration through `DATABASE_URL` or `DB_HOST`, `DB_PORT`,
  `DB_NAME`, `DB_USER`, `DB_PASSWORD`, `DB_SSL` and
  `DB_SSL_REJECT_UNAUTHORIZED`.
- Database status card shows engine version, host, database, user, size, schema
  version and counts; admins can reconfigure the connection.
- Automatic redirect to the setup wizard when no database is configured or the
  database is unreachable.

### Changed

- All users, API tokens, OAuth/SMTP/notification settings and email history now
  live in MySQL/MariaDB.
- The Docker volume only persists the encrypted database connection file.
- Schema initialization is idempotent and seeds the environment admin.

### Removed

- Embedded SQLite storage, `CADDYWEB_DB_PATH`, and the SQLite backup download.

## 0.7.1 — 2026-11-15

### Fixed

- Login redirect loop (`ERR_TOO_MANY_REDIRECTS`) when the session cookie is
  valid but the database user was deleted or deactivated, or the database was
  temporarily unavailable. The login page now validates the full session
  (including the database user) before redirecting to the dashboard.

## 0.7.0 — 2026-11-15

### Added

- User profile page: display name, avatar upload (stored in SQLite), contact
  email, email-notification opt-in and password changes.
- SMTP configuration in Settings with encrypted password, TLS modes, reply-to,
  test email and a delivery log.
- Background health monitor with email alerts on Caddy unreachable/recovered and
  upstream unhealthy/recovered transitions.
- Notification settings: interval, recipient roles, extra addresses and
  per-event toggles.
- Manual “Run check now” action and a recent-email log in Settings.
- Admin display-name/avatar support in the Users list.
- SMTP environment fallbacks for Docker deployments.

### Changed

- Database schema version 2 adds profile fields and the email log; existing
  databases are migrated automatically.
- Image bump to 0.7.0.

## 0.6.0 — 2026-11-15

### Added

- Embedded SQLite database (Node `node:sqlite`) for users, API tokens and
  dashboard-managed OAuth settings. Docker uses a persistent `caddyweb_data`
  volume at `/app/data`.
- User accounts with **Admin**, **Editor** and **Viewer** roles, password login
  integration, role-aware UI and API enforcement.
- **Users & API tokens** page for creating accounts and bearer tokens.
- Subdomain API: `POST /api/v1/subdomains` and `GET /api/v1/subdomains` with
  bearer-token or session authentication.
- OAuth configuration in the dashboard (issuer, client, secret, scopes,
  allowlists, default role, auto-provisioning). The client secret is encrypted
  with `AUTH_SECRET`; environment variables remain a fallback.
- Database status, backup download and management card in Settings.

### Changed

- Requires Node.js 24 (Docker image and CI updated).
- The environment admin is seeded into the database and remains a break-glass
  login.
- Sessions resolve the current role from the database on every request, so role
  changes take effect immediately.

## 0.5.0 — 2026-11-15

### Added

- Optional OpenID Connect / OAuth2 login, tested against Authentik:
  - Discovery, authorization-code flow and PKCE (S256).
  - Signed HttpOnly state cookie with a 10-minute lifetime.
  - ID-token verification through JWKS, including issuer, audience and nonce.
  - Optional allowlists by user/email/subject or `groups` claim.
  - "Continue with …" button on the login page, shown only when configured.
  - Single sign-on status card on the Settings page.
- Mock OIDC provider (`npm run mock:oidc`) for local development and testing.

### Changed

- Password login remains active when OAuth is configured, by design.
- Docker Compose passes the OIDC and `APP_URL` environment variables.
- Version bumped to 0.5.0.

## 0.4.0 — 2026-11-15

### Added

- A project icon and web app manifest (SVG, 192/512 px and Apple touch icon).
- Page-specific browser titles, e.g. `Dashboard · CaddyWeb`, `Sites · CaddyWeb`
  and `TLS & certificates · CaddyWeb`.
- A third per-site TLS mode: **No certificate (HTTP only)**. The route is served
  from a dedicated HTTP listener and no certificate is requested.
- New-site TLS defaults include the no-certificate option.

### Changed

- The sidebar and login screen use the new icon instead of the letter tile.
- Custom `CADDY_HTTP_PORT` / `CADDY_HTTPS_PORT` values are also applied as
  Caddy's global `http_port` / `https_port` when servers are created.

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
