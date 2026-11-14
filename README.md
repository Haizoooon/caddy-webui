# CaddyWeb

A small, flat-design control panel for the [Caddy](https://caddyserver.com) Admin API.
Create subdomains for reverse proxies, static folders, redirects and maintenance
pages without writing JSON or a Caddyfile.

[![CI](https://github.com/Haizoooon/caddy-webui/actions/workflows/ci.yml/badge.svg)](https://github.com/Haizoooon/caddy-webui/actions/workflows/ci.yml)

> Repository: [github.com/Haizoooon/caddy-webui](https://github.com/Haizoooon/caddy-webui)

- **Next.js 15** (App Router, TypeScript, React 19)
- **Tailwind CSS 4** with a custom Flat UI light theme
- **Caddy Admin API** at `localhost:2019` (or `caddy:2019` in Docker)
- **Username + password login** — mandatory, there is no open mode
- **No database** — Caddy's running configuration is the source of truth

---

## Features

| Area | What you get |
| --- | --- |
| Login | Username + password, signed HttpOnly session, rate limiting, no open mode |
| Sites | List, search, create, edit and delete every route Caddy serves |
| Reverse proxy | One or more `host:port` upstreams, automatic WebSocket support |
| Static site | `file_server` with a configurable root, directory listing and SPA fallback |
| File manager | Directory browsing protected by Caddy basic auth |
| Redirect | 301 / 302 / 307 / 308 with placeholder support |
| Respond | Fixed status code and body, e.g. a maintenance page |
| Custom | Paste any Caddy handler array |
| TLS | Automatic public certificates or per-host internal CA policies |
| Extras | gzip/zstd compression, basic auth, path matchers, wildcard hosts |
| Upstreams | Live request/failure counters straight from Caddy |
| Raw config | JSON editor plus Caddyfile import through `/adapt` |

The design is intentionally flat: solid colours, hairline borders, 3px radii,
no shadows or gradients, and a light-only palette:

`#1ABC9C` `#3498DB` `#2ECC71` `#F1C40F` `#E74C3C` `#9B59B6` `#2C3E50` `#ECF0F1`

---

## Requirements

- Node.js 20 or newer (Node 22/24 recommended)
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

The panel **fails closed**: if `APP_PASSWORD` is unset, the login page shows
setup instructions and every page and API route stays locked. There is no
unauthenticated mode.

### Build for production

```bash
npm run build
npm start
```

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
names use the site's **Internal CA** TLS mode instead.

### DNS

Caddy can only issue a certificate for a name that resolves to the server.
Create the DNS record **before** adding the site, then check:

```bash
dig +short app.example.com
```

A wildcard record `*.example.com → 203.0.113.10` plus `example.com` covers every
subdomain you create through the panel.

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
| `APP_USERNAME` | `admin` | Login username |
| `APP_PASSWORD` | – | Login password; **required**, the panel stays locked without it |
| `AUTH_SECRET` | `APP_PASSWORD` | Signing key for the session cookie |
| `COOKIE_SECURE` | auto | Force the Secure cookie flag; otherwise HTTPS is auto-detected |
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

Published image:

```bash
docker pull docker-registry.evoxy.de/caddyweb:0.2.1
docker run -d --name caddyweb -p 18080:18080 \
  -e APP_USERNAME=admin \
  -e APP_PASSWORD='pick-a-strong-password' \
  -e AUTH_SECRET="$(openssl rand -hex 32)" \
  -e CADDY_ADMIN_URL='http://<caddy-host>:2019' \
  docker-registry.evoxy.de/caddyweb:0.2.1
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
- The panel can rewrite the entire Caddy config, so treat its credentials like
  server root credentials.
- The internal CA is for LAN clients. Install its root certificate only on
  devices you control.

---

## Troubleshooting

| Symptom | Fix |
| --- | --- |
| Login page says **Panel locked** | Set `APP_PASSWORD` (and `APP_USERNAME`) in the container environment, then restart or recreate the container |
| Port 18080 already in use | Publish another host port: `-p 28080:18080`, or set `CADDYWEB_PORT=28080` for Compose |
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
src/app/api/auth/       login and logout
src/components/         flat UI primitives, forms, site builder, views
src/lib/caddy/          admin client, schema, route builder/parser, mutations
src/lib/session.ts      signed cookie helpers (shared with middleware)
scripts/mock-caddy.mjs  mock Admin API for local development
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

---

## Contributing

Issues and pull requests are welcome. Please run `npm run typecheck` and
`npm run build` before opening a PR. For security issues, follow
[SECURITY.md](SECURITY.md) instead of opening a public issue.

## License

MIT — see [LICENSE](LICENSE).
