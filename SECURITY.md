# Security

## Reporting a vulnerability

Please **don't open a public issue**. Use GitHub's private reporting instead: *Security → Report a vulnerability*
in this repository. I'll answer as soon as I can.

## How the deployment is protected

- **Access:** Cloudflare Access in front, and the app itself verifies the Access JWT (signature, audience, issuer,
  expiry) and/or a shared token. Without access control configured the server refuses to start.
- **Secrets:** only in the server's `.env` (never in the repo or the image). The token never travels in a URL
  query string: requests use the `Authorization` header and the one-time setup link uses the URL fragment.
- **HTTP:** strict Content-Security-Policy (same-origin only), `frame-ancestors 'none'`, `no-referrer`, `nosniff`;
  CORS disabled unless `CORS_ORIGINS` is set; request size limits; internal errors are logged, never returned.
- **Input:** every field is type-checked and length-limited; uploaded receipts are accepted only if their bytes are
  a real JPEG/PNG/WebP/HEIC image, and are served with the detected type.
- **Containers:** non-root user, read-only filesystem, all Linux capabilities dropped, `no-new-privileges`; the
  database is only on an internal network with the app, never published.
- **Supply chain:** GitHub Actions pinned by commit SHA, base image pinned by digest, Dependabot for npm, Docker and
  Actions, `npm audit` in CI. Production deploys only from `main`, only after CI passes, through a protected
  `production` environment.
