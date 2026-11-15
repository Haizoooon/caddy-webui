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
| 0.5.x | Yes |
| < 0.5 | No |

## Deployment guidance

- Authentication is mandatory. Never publish a container without
  `APP_PASSWORD`.
- Keep the Caddy admin endpoint (`2019`) on a private network.
- Terminate TLS in front of the panel and enable `COOKIE_SECURE` when possible.
- Treat the panel credentials like server root credentials.
