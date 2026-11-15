# CaddyWeb

A small, flat-design control panel for the [Caddy](https://caddyserver.com) Admin API.
Create subdomains for reverse proxies, static folders, redirects and maintenance
pages without writing JSON or a Caddyfile.

[![CI](https://github.com/Haizoooon/caddy-webui/actions/workflows/ci.yml/badge.svg)](https://github.com/Haizoooon/caddy-webui/actions/workflows/ci.yml)

> Repository: [github.com/Haizoooon/caddy-webui](https://github.com/Haizoooon/caddy-webui)

- **Next.js 15** (App Router, TypeScript, React 19)
- **Tailwind CSS 4** with a custom Flat UI theme (light + dark)
- **Caddy Admin API** at `localhost:2019` (or `caddy:2019` in Docker)
- **Username + password login** — mandatory, there is no open mode
- **No database** — Caddy's running configuration is the source of truth

---

## Features

| Area | What you get |
| --- | --- |
| Login | Username + password, optional OIDC/OAuth (Authentik), signed HttpOnly sessions, rate limiting |
| Accounts | Database-backed users with Admin, Editor and Viewer roles |
| Profile | Display name, avatar, email, password and email-notification opt-in |
| Email alerts | SMTP settings plus background monitoring for Caddy and upstream health |
| API | Bearer-token `POST /api/v1/subdomains` endpoint for automation |
| Database | MySQL / MariaDB with a first-run setup wizard and encrypted connection file |
| Preferences | Light / dark / system theme, table density, new-site defaults, stored in a cookie |
| Sites | List, search, create, edit and delete every route Caddy serves |
| Reverse proxy | One or more `host:port` upstreams, automatic WebSocket support |
| Static site | `file_server` with a configurable root, directory listing and SPA fallback |
| File manager | Directory browsing protected by Caddy basic auth |
| Redirect | 301 / 302 / 307 / 308 with placeholder support |
| Respond | Fixed status code and body, e.g. a maintenance page |
| Custom | Paste any Caddy handler array |
| TLS | Automatic public certificates, per-host internal CA, or no certificate (plain HTTP) |
| Extras | gzip/zstd compression, basic auth, path matchers, wildcard hosts |
| Upstreams | Live request/failure counters straight from Caddy |
| Raw config | JSON editor plus Caddyfile import through `/adapt` |

The design is intentionally flat: solid colours, hairline borders, 3px radii,
no shadows or gradients, with palettes for light and dark mode:

`#1ABC9C` `#3498DB` `#2ECC71` `#F1C40F` `#E74C3C` `#9B59B6` `#2C3E50` `#ECF0F1`

---

## Requirements

- Node.js **24 or newer** (matches the Docker image and CI)
- MySQL 8.0+ or MariaDB 10.5+, reachable from the panel
- A database and user with schema-creation privileges (`CREATE`, `ALTER`, `INDEX`)
- A running Caddy 2 instance whose admin endpoint the app can reach
- DNS records for the hostnames you create (a wildcard `*.example.com` is easiest)

---

## Quick start

```bash
git clone https://github.com/Haizoooon/caddy-webui.git
cd caddy-webui
cp .env.example .env.local
```

Edit `.env.local`:

```dotenv
CADDY_ADMIN_URL=http://localhost:2019
APP_USERNAME=admin
APP_PASSWORD=pick-a-strong-password
AUTH_SECRET=paste-output-of-openssl-rand-hex-32
```

Then:

```bash
npm install
npm run dev
```

Open <http://localhost:3000>. Sign in with `APP_USERNAME` and `APP_PASSWORD`.

If no database connection is configured, CaddyWeb redirects to `/setup` after
login. Enter your MySQL/MariaDB host, database, user and password there; the
schema is created automatically.

The panel **fails closed**: if `APP_PASSWORD` is unset, the login page shows
setup instructions and every page and API route stays locked. There is no
unauthenticated mode.

### Build for production

```bash
npm run build
npm start
```

---

## Database setup (MySQL / MariaDB)

CaddyWeb uses an external MySQL or MariaDB database. SQLite is no longer
supported.

### First run / setup wizard

1. Start CaddyWeb with `APP_PASSWORD` and `AUTH_SECRET` set, but no `DB_*` or
   `DATABASE_URL` variables.
2. Sign in with the environment admin (`APP_USERNAME` / `APP_PASSWORD`).
3. You are redirected to `/setup`. Enter:
   - host and port (usually `3306`)
   - database name
   - database user and password
   - TLS mode (disabled, required, or required with self-signed certificates)
4. **Test connection**, then **Save & create schema**.

CaddyWeb creates `users`, `api_tokens`, `settings`, `audit_log` and
`email_log`, seeds the environment admin, and writes `database.json` in
`CADDYWEB_CONFIG_DIR` (mode `0600`). The password is encrypted with
`AUTH_SECRET`.

The database user needs permission to create tables. Existing empty tables with
the same names are reused; data is not copied from SQLite.

### Environment configuration

Alternatively, configure the connection with variables. They take precedence
over the setup wizard and make `/setup` read-only:

```dotenv
DATABASE_URL=mysql://caddyweb:password@mysql:3306/caddyweb
# or
DB_HOST=mysql
DB_PORT=3306
DB_NAME=caddyweb
DB_USER=caddyweb
DB_PASSWORD=password
DB_SSL=false
DB_SSL_REJECT_UNAUTHORIZED=true
```

### Change the connection later

Admins can open **Settings → Database → Change connection** (`/setup?edit=1`).
Saving a different connection points CaddyWeb at another database; existing
data is not migrated automatically.

## Accounts, roles and the database

Users live in MySQL/MariaDB. On setup CaddyWeb seeds an Admin account from
`APP_USERNAME` / `APP_PASSWORD`. The environment admin also remains a
break-glass login.

| Role | Capabilities |
| --- | --- |
| Admin | Everything: sites, raw config, users, API tokens, OAuth, SMTP and database |
| Editor | Create, edit and delete sites; adapt Caddyfiles; read dashboard/upstreams/TLS |
| Viewer | Read-only access to routes, upstreams and TLS |

Manage accounts and API tokens under **Users**. Settings → Database shows the
engine, host, database, user, size, schema version and counts.

OAuth users are provisioned on first login with a configurable default role
(Viewer or Editor). Existing users are matched by OIDC subject, email or
username, and their role is taken from the database.

Keep the Docker data volume mounted (`caddyweb_data:/app/data`); otherwise users,
tokens and dashboard-managed OAuth settings disappear when the container is
recreated.

## Profile and avatars

Click your name at the bottom of the sidebar to open **Profile**. Every user can:

- change the display name and contact email
- upload an avatar (resized to 256×256 and stored in the database)
- opt in or out of email health alerts
- set or change a local password

Roles, usernames and account state are managed by Admins under **Users**.

## SMTP and health alerts

Admins configure email in **Settings → SMTP** and **Settings → Health alerts**.

- SMTP host, port, STARTTLS / implicit TLS / plain, username, password,
  from name/address, reply-to and TLS certificate verification.
- **Send test** validates the connection and logs the result.
- The monitor checks Caddy every configured number of minutes and emails on
  state transitions only:
  - Caddy Admin API unreachable / reachable again
  - reverse-proxy upstream reports failures / recovers
- Recipients are active users whose role is selected and who have an email with
  notifications enabled in their profile, plus optional extra addresses.
- **Run check now** triggers a check immediately; **Recent emails** shows the
  last delivery attempts, including failures.

The monitor starts when the panel receives a request. The Docker healthcheck
(`/login` every 30 seconds) keeps it running in containers; without a
healthcheck, the first visit starts it.

## Subdomain API

Create a bearer token under **Users & API tokens**, then:

```bash
curl -X POST https://caddy.example.com/api/v1/subdomains \
  -H "Authorization: Bearer cw_..." \
  -H "Content-Type: application/json" \
  -d '{
    "subdomain": "app",
    "type": "reverse_proxy",
    "target": "http://localhost:3000",
    "tls": "auto"
  }'
```

- `subdomain` is combined with `CADDYWEB_BASE_DOMAIN` (or the `domain` field);
  use `host` / `hosts` for full hostnames.
- `type`: `reverse_proxy`, `file_server`, `filemanager`, `redirect`, `respond`
  or `custom`.
- Other fields: `target`, `upstreams`, `root`, `redirectTo`, `status`, `body`,
  `handlers`, `path`, `tls`, `browse`, `spa`, `compress`, `basicAuth`.
- Tokens inherit their user's role: editor/admin tokens can create routes,
  viewer tokens receive `403`.
- `GET /api/v1/subdomains` lists the current routes.

---

## Running Caddy for the panel

The panel writes to Caddy's **Admin API**, so Caddy should treat the API as the
source of truth. Do not run `caddy run --watch` with a Caddyfile while using the
panel: file reloads would overwrite changes made through the API.

Start Caddy with no config (it then serves an empty config and exposes the admin
endpoint on `localhost:2019`):

```bash
caddy run
```

Caddy saves every API change to its autosave file. After a restart, restore it
with:

```bash
caddy run --resume
```

### Ports and privileges

Binding `:80` and `:443` requires elevated privileges (or `setcap` on Linux).
CaddyWeb creates new HTTP servers on the ports configured by
`CADDY_HTTP_PORT` / `CADDY_HTTPS_PORT`. For local experiments without root:

```dotenv
CADDY_HTTP_PORT=8080
CADDY_HTTPS_PORT=8443
```

Public ACME certificates still require ports 80/443 to be reachable. For LAN
names use the site's **Internal CA** TLS mode instead. When the ports differ
from 80/443, CaddyWeb also sets Caddy's global `http_port` / `https_port` (if
the config does not define them) so automatic HTTPS and redirects keep working.

### TLS modes

Each site chooses one of three modes:

| Mode | Behaviour |
| --- | --- |
| Automatic HTTPS | Public certificate through ACME (Let's Encrypt / ZeroSSL). |
| Internal CA | Per-host policy using Caddy's local authority. Install the root certificate on client devices. |
| No certificate | The route is placed on an HTTP-only server on `CADDY_HTTP_PORT` (default 80). Caddy disables automatic HTTPS for that server, so no certificate is requested. Use only on trusted networks. |

No-TLS sites are served over plain HTTP. Browsers mark them as not secure, so
never send credentials over them.

### DNS

Caddy can only issue a certificate for a name that resolves to the server.
Create the DNS record **before** adding the site, then check:

```bash
dig +short app.example.com
```

A wildcard record `*.example.com → 203.0.113.10` plus `example.com` covers every
subdomain you create through the panel.

---

## Single sign-on (OIDC)

CaddyWeb can authenticate through Authentik or any OpenID Connect provider.
Password login always stays available; OAuth is an additional method and appears
on the login page only when it is configured.

Configure it in **Settings → Single sign-on (OIDC)** as an Admin. The client
secret is encrypted at rest with `AUTH_SECRET`. The environment variables below
are an initial/fallback configuration and are overridden by the dashboard form.
New OAuth users are provisioned with the configured default role; manage roles
under **Users**.

### Authentik setup

1. In Authentik, create an **OAuth2/OpenID Provider** (confidential client).
2. Register `https://caddy.example.com/api/auth/oauth/callback` as the redirect URI.
3. Enable the `openid`, `profile` and `email` scopes. Add a `groups` claim if you
   want group-based access control.
4. Bind the provider to an application and restrict its policy to the intended
   users or groups.
5. Configure CaddyWeb:

```dotenv
APP_URL=https://caddy.example.com
OIDC_ISSUER_URL=https://auth.example.com/application/o/caddyweb/
OIDC_CLIENT_ID=your-client-id
OIDC_CLIENT_SECRET=your-client-secret
OIDC_PROVIDER_NAME=Authentik
OIDC_SCOPES=openid profile email
```

6. Restart the container. The login page then shows **Continue with Authentik**
   above the password form.

Use `OIDC_ALLOWED_USERS` (email, username or subject) and/or
`OIDC_ALLOWED_GROUPS` to restrict access inside CaddyWeb as well. If both lists
are empty, any account the IdP authenticates can use the panel — restrict the
application in Authentik itself.

The callback validates a signed, HttpOnly state cookie, PKCE, the ID-token
signature through JWKS, the issuer, the audience and the nonce. Tokens are never
stored. Behind a reverse proxy, set `APP_URL` (or `OIDC_REDIRECT_URI`) to the
public HTTPS URL so the callback matches the provider configuration.

---

## Environment variables

| Variable | Default | Purpose |
| --- | --- | --- |
| `CADDY_ADMIN_URL` | `http://localhost:2019` | Admin API base URL, server-side only |
| `CADDY_ADMIN_USER` | – | Optional basic-auth user for a proxied admin endpoint |
| `CADDY_ADMIN_PASSWORD` | – | Optional basic-auth password |
| `CADDY_ADMIN_ORIGIN` | `http://127.0.0.1:2019` | `Origin` header sent to the Admin API (for `enforce_origin`) |
| `CADDY_HTTP_PORT` | `80` | Port used when CaddyWeb creates a Caddy server |
| `CADDY_HTTPS_PORT` | `443` | TLS port used when CaddyWeb creates a Caddy server |
| `CADDYWEB_CONFIG_DIR` | `./data` (`/app/data` in Docker) | Directory for encrypted `database.json` |
| `CADDYWEB_BASE_DOMAIN` | – | Base domain for `subdomain` in the API |
| `DATABASE_URL` | – | MySQL URL, e.g. `mysql://user:pass@host:3306/db` |
| `DB_HOST` | – | MySQL/MariaDB host |
| `DB_PORT` | `3306` | MySQL/MariaDB port |
| `DB_NAME` | – | Database name |
| `DB_USER` | – | Database user |
| `DB_PASSWORD` | – | Database password |
| `DB_SSL` | `false` | Enable TLS to the database |
| `DB_SSL_REJECT_UNAUTHORIZED` | `true` | Verify the database TLS certificate |
| `APP_USERNAME` | `admin` | Login username |
| `APP_PASSWORD` | – | Login password; **required**, the panel stays locked without it |
| `AUTH_SECRET` | `APP_PASSWORD` | Signing key for the session cookie |
| `COOKIE_SECURE` | auto | Force the Secure cookie flag; otherwise HTTPS is auto-detected |
| `APP_URL` | request origin | Public panel URL used to build OAuth callback URLs |
| `OIDC_ISSUER_URL` | – | OIDC issuer; enables SSO together with a client ID |
| `OIDC_CLIENT_ID` | – | OAuth client ID |
| `OIDC_CLIENT_SECRET` | – | OAuth client secret |
| `OIDC_PROVIDER_NAME` | `SSO` | Login-button label, e.g. `Authentik` |
| `OIDC_SCOPES` | `openid profile email` | Scopes requested from the provider |
| `OIDC_ALLOWED_USERS` | – | Comma-separated users, emails or subjects |
| `OIDC_ALLOWED_GROUPS` | – | Comma-separated groups from the `groups` claim |
| `OIDC_TOKEN_AUTH_METHOD` | `basic` | Token endpoint auth: `basic` or `post` |
| `OIDC_REDIRECT_URI` | `${APP_URL}/api/auth/oauth/callback` | Explicit callback URL |
| `SMTP_HOST` | – | Fallback SMTP host |
| `SMTP_PORT` | `587` | Fallback SMTP port |
| `SMTP_SECURITY` | `starttls` | `starttls`, `tls` or `none` |
| `SMTP_USER` / `SMTP_PASSWORD` | – | Fallback SMTP credentials |
| `SMTP_FROM_EMAIL` | – | Fallback sender address |
| `SMTP_FROM_NAME` | `CaddyWeb` | Fallback sender name |
| `SMTP_REJECT_UNAUTHORIZED` | `true` | Verify SMTP TLS certificates |
| `CADDYWEB_PORT` | `18080` | Host port published by Docker Compose (container port is 18080) |

Generate a secret with `openssl rand -hex 32`.

---

## How it works

```
Browser ──► Next.js UI ──► /api/caddy/* route handlers ──► Caddy Admin API
                │                    │
        session cookie        allow-listed calls only
```

- The Admin API URL and credentials never reach the browser.
- The server reads `GET /config/`, applies a change in memory, and writes it back
  with `POST /load`. The config is re-read before writing and the operation is
  retried if Caddy's `ETag` changed, which avoids most lost updates.
- Every route created by CaddyWeb gets an `@id` of the form `caddyweb_<id>`, so
  later edits and deletes address the route directly instead of an array index.
- New routes are inserted before the first catch-all route, so a host matcher is
  never shadowed.
- Routes created elsewhere (e.g. from a Caddyfile) appear as **Imported** and can
  be edited or deleted from the same table.

### File manager caveat

The **File Manager** site type is Caddy's native `file_server` with `browse`
enabled, wrapped in HTTP basic auth. It lets visitors browse and download files;
it does **not** upload, rename or delete. If you need a full file manager, run
[File Browser](https://filebrowser.org) and expose it with a **Reverse Proxy**
site instead.

---

## Development without Caddy

A mock Admin API is included for UI work:

```bash
npm run mock:caddy     # listens on 127.0.0.1:2019
npm run dev
```

The mock keeps its configuration in memory and implements `/config/`, `/load`,
`/reverse_proxy/upstreams`, `/adapt` and the local PKI endpoints.

For OAuth development, a mock OpenID Connect provider is included:

```bash
npm run mock:oidc      # listens on 127.0.0.1:4010

OIDC_ISSUER_URL=http://localhost:4010/ \
OIDC_CLIENT_ID=caddyweb \
OIDC_CLIENT_SECRET=secret \
OIDC_PROVIDER_NAME=Authentik \
OIDC_ALLOWED_GROUPS=caddy-admins \
APP_URL=http://localhost:3000 \
npm run dev
```

It signs ID tokens with a generated RSA key, implements discovery, authorization,
token and JWKS endpoints, and validates PKCE.

To exercise health alerts, start the Caddy mock with failing upstreams:

```bash
MOCK_UPSTREAM_FAILS=2 npm run mock:caddy
# then use Run check now in Settings → Health alerts
```

---

## Docker

```bash
export APP_PASSWORD='pick-a-strong-password'
export APP_USERNAME='admin'                          # optional, defaults to admin
export AUTH_SECRET="$(openssl rand -hex 32)"
docker compose up --build
```

The panel listens on **18080** inside the container and Compose publishes it on
`http://localhost:18080`. The host port is configurable:

```bash
CADDYWEB_PORT=28080 docker compose up -d
```

Compose mounts the `caddyweb_data` volume at `/app/data` for the encrypted
database connection file; users, settings and tokens live in MySQL/MariaDB.
Back up both the volume and your database.

Published image:

```bash
docker pull docker-registry.evoxy.de/caddyweb:0.8.0
docker run -d --name caddyweb -p 18080:18080 \
  -e APP_USERNAME=admin \
  -e APP_PASSWORD='pick-a-strong-password' \
  -e AUTH_SECRET="$(openssl rand -hex 32)" \
  -e CADDY_ADMIN_URL='http://<caddy-host>:2019' \
  docker-registry.evoxy.de/caddyweb:0.8.0
```

Caddy's admin endpoint is bound inside the compose network only and is **not**
published to the host. The image is built for `linux/amd64`.

Do not publish `2019` publicly. Anyone who can reach the admin endpoint controls
the server.

---

## Security notes

- Authentication is always required. An unset `APP_PASSWORD` locks the panel
  instead of exposing it.
- Keep the panel bound to localhost or put it behind an authenticating proxy.
- Set `AUTH_SECRET` to a long random value; otherwise `APP_PASSWORD` is the key.
- Use `COOKIE_SECURE=true` when the panel is served over HTTPS (HTTPS is also
  detected automatically from `X-Forwarded-Proto`).
- Login attempts are rate limited per IP address.
- Passwords are stored as bcrypt hashes. API tokens are stored only as SHA-256
  hashes; the plaintext token is shown once.
- The MySQL/MariaDB database contains password hashes, token hashes, OAuth/SMTP
  settings, avatars and email history. Restrict database access and back it up.
- `database.json` contains the encrypted database password. Keep
  `CADDYWEB_CONFIG_DIR` private and stable; environment variables override it.
- Password login stays enabled when OAuth is configured, so an IdP outage cannot
  lock you out. Restrict access in the IdP app and via the optional OIDC
  allowlists.
- OAuth uses PKCE, a signed state cookie, nonce validation and JWKS signature
  verification. The OAuth client secret is encrypted with `AUTH_SECRET`. Serve
  the panel over HTTPS and set `APP_URL` behind a proxy.
- The panel can rewrite the entire Caddy config, so treat its credentials like
  server root credentials.
- The internal CA is for LAN clients. Install its root certificate only on
  devices you control.

---

## Troubleshooting

| Symptom | Fix |
| --- | --- |
| Login page says **Panel locked** | Set `APP_PASSWORD` (and `APP_USERNAME`) in the container environment, then restart or recreate the container |
| OAuth button is missing | Set both `OIDC_ISSUER_URL` and `OIDC_CLIENT_ID`, or enable and save the provider in Settings → Single sign-on |
| `redirect_uri` mismatch from the IdP | Set `APP_URL` (or `OIDC_REDIRECT_URI`) to the public URL and register the same callback in Authentik |
| `oauth_forbidden` after SSO | The account does not match `OIDC_ALLOWED_USERS` / `OIDC_ALLOWED_GROUPS`; adjust the allowlist or the IdP policy |
| `oauth_state` after SSO | The state cookie expired or was blocked. Finish the flow within 10 minutes and allow cookies for the panel |
| Database unavailable | Check that MySQL/MariaDB is reachable, the host/port/user/password are correct and `DB_SSL` matches the server. Use `/setup?edit=1` after signing in with the environment admin |
| Setup wizard does not appear | A database is already configured (environment or `database.json`). Open `/setup?edit=1` to change it |
| Database setup fails with access denied | Grant the database user `CREATE`, `ALTER`, `INDEX`, `SELECT`, `INSERT`, `UPDATE`, `DELETE` on the database |
| `database.json` password cannot be decrypted | `AUTH_SECRET` or `APP_PASSWORD` changed. Re-enter the database password in `/setup?edit=1` |
| SMTP test fails | Check host/port/security, credentials and `SMTP_REJECT_UNAUTHORIZED`; view the error in Recent emails |
| No alert emails | Enable Health alerts, select a role with users that have an email and notifications enabled, or add an extra recipient |
| Profile avatar is missing in the sidebar | Save the profile and reload; avatars are stored in the database |
| API token returns 401 | Create a new token under Users & API tokens; check it was not revoked or expired |
| API token returns 403 | The token's user has the Viewer role; change the role to Editor or Admin |
| Users page is missing | Only Admins can manage users and tokens |
| Port 18080 already in use | Publish another host port: `-p 28080:18080`, or set `CADDYWEB_PORT=28080` for Compose |
| `failed to read dockerfile: open Dockerfile: no such file or directory` | Build from the repository root and make sure `.dockerignore` does not exclude `Dockerfile`. This is fixed in 0.3.0 |
| Dashboard says **Caddy offline** | Start Caddy, verify `CADDY_ADMIN_URL`, and make sure the admin endpoint is not bound to a different address |
| `HTTP 403` from the admin API | The endpoint enforces origins. Set `CADDY_ADMIN_ORIGIN` to an allowed origin (default `http://127.0.0.1:2019`), or configure `admin { origins ... }` in Caddy |
| `permission denied` when binding 443 | Run Caddy with the required capabilities, or set `CADDY_HTTPS_PORT=8443` |
| Certificate not issued | Check DNS, ports 80/443, and Caddy's logs. Use Internal CA for names that are not publicly resolvable |
| Duplicate host error | Another route already matches that hostname. Edit or remove it first |
| Changes reverted after restart | Start Caddy with `--resume`; without a Caddyfile, Caddy restores its autosave file |

---

## Project structure

```
src/app/(app)/          dashboard, sites, upstreams, TLS, config, settings
src/app/api/caddy/      server-side proxy to the Caddy Admin API
src/app/api/auth/       password login, logout and OAuth start/callback
src/app/api/v1/         bearer-token subdomain API
src/app/api/admin/      users, API tokens, OAuth, SMTP and database endpoints
src/app/api/me/         profile and password endpoints
src/lib/oauth.ts        OIDC discovery, PKCE, token exchange and verification
src/app/setup/           first-run MySQL/MariaDB setup wizard
src/lib/db.ts           MySQL/MariaDB pool, schema and seeding
src/lib/db-config.ts    connection config, encryption and setup
src/lib/users.ts        accounts, roles, profiles and API tokens
src/lib/mailer.ts       SMTP transport and email log
src/lib/monitor.ts      background Caddy/upstream health monitor
src/lib/oauth-settings.ts  database-backed OAuth configuration
src/lib/smtp-settings.ts   database-backed SMTP configuration
src/components/         flat UI primitives, forms, site builder, views
src/lib/caddy/          admin client, schema, route builder/parser, mutations
src/lib/session.ts      signed cookie helpers (shared with middleware)
src/lib/preferences.ts  theme, density and site-default preferences
src/components/settings preferences card and account controls
public/                 app icon, PNG icons and manifest assets
scripts/mock-caddy.mjs  mock Admin API for local development
scripts/mock-oidc.mjs   mock OIDC provider for local development
```

---

## Scripts

| Command | Description |
| --- | --- |
| `npm run dev` | Start the development server |
| `npm run build` | Production build |
| `npm start` | Serve the production build |
| `npm run typecheck` | TypeScript check without emitting |
| `npm run mock:caddy` | Mock Caddy Admin API on port 2019 |
| `npm run mock:oidc` | Mock OIDC provider on port 4010 |

---

## Contributing

Issues and pull requests are welcome. Please run `npm run typecheck` and
`npm run build` before opening a PR. For security issues, follow
[SECURITY.md](SECURITY.md) instead of opening a public issue.

## License

MIT — see [LICENSE](LICENSE).
