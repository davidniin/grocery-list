# Security policy / Política de seguridad

**English** · [Español](#política-de-seguridad)

## Reporting a vulnerability

**Please don't open a public issue.** Report it privately through GitHub: **Security → Report a vulnerability** in
this repository
([private vulnerability reporting](https://docs.github.com/en/code-security/security-advisories/guidance-on-reporting-and-writing-information-about-vulnerabilities/privately-reporting-a-security-vulnerability)).

Include what you found, how to reproduce it and the impact you think it has. You'll get an answer as soon as possible;
this is a volunteer project, so please allow a few days. Once fixed, the advisory is published and you're credited if
you want.

## Supported versions

Only the `main` branch (and the image built from it) gets security fixes. Keep your instance updated.

## Scope

The app is self-hosted: each household runs and secures its own instance. Problems in how a specific instance is
configured (a weak `GROCERY_TOKEN`, `ALLOW_NO_AUTH=1` on the internet, no HTTPS) are not vulnerabilities in the
project, but suggestions to make the defaults safer are welcome. The live demo on GitHub Pages has no server and no
real data.

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

---

## Política de seguridad

[English](#security-policy--política-de-seguridad) · **Español**

**Por favor, no abras un issue público.** Avisa en privado desde GitHub: **Security → Report a vulnerability** en este
repositorio.

Explica qué has encontrado, cómo reproducirlo y qué impacto crees que tiene. Se responderá lo antes posible; es un
proyecto de voluntarios, así que puede tardar unos días. Cuando esté arreglado se publica el aviso y, si quieres,
apareces en los créditos.

Solo la rama `main` (y la imagen que se genera de ella) recibe arreglos de seguridad. Cada casa aloja y protege su
propia instancia: una configuración insegura (clave débil, `ALLOW_NO_AUTH=1` en internet, sin HTTPS) no es una
vulnerabilidad del proyecto, aunque las propuestas para que la configuración por defecto sea más segura son
bienvenidas. La demo en vivo de GitHub Pages no tiene servidor ni datos reales.

Cómo está protegido el despliegue: mira la lista de arriba (acceso, secretos, cabeceras HTTP, validación, contenedores
y cadena de suministro).
