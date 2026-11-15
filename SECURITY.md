# Security Policy

CaddyWeb controls a Caddy server's live configuration, so security issues are
treated seriously.

## Reporting a vulnerability

Do **not** open a public issue for a vulnerability.

Use GitHub's private vulnerability reporting on this repository
(Security → Report a vulnerability) or contact the maintainer directly.
Please include:

- the affected version or image tag,
- steps to reproduce,
- the impact you observed,
- any suggested fix.

You can expect an acknowledgement within a few days.

## Supported versions

| Version | Supported |
| --- | --- |
| 0.8.x | Yes |
| < 0.8 | No |

## Deployment guidance

- Authentication is mandatory. Never publish a container without
  `APP_PASSWORD`.
- Keep the Caddy admin endpoint (`2019`) on a private network.
- Terminate TLS in front of the panel and enable `COOKIE_SECURE` when possible.
- Treat the panel credentials like server root credentials.
- SMTP passwords, OAuth client secrets and the database password are encrypted
  with `AUTH_SECRET`. Keep that value stable and private. Restrict access to
  `database.json` and the MySQL/MariaDB database; they contain password/token
  hashes, avatars and email history.
- Grant Admin only to operators who should manage users, OAuth, SMTP and raw
  configuration; Editors can manage routes and Viewers are read-only.
- Health alert emails contain upstream addresses and panel URLs. Use a trusted
  SMTP relay and recipient list.
