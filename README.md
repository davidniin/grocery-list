# Grocery list

🇪🇸 [Leer en español](README.es.md)

[![Live demo](https://img.shields.io/badge/live%20demo-try%20it-2f7d5b)](https://davidniin.github.io/grocery-list/)
[![License: MIT](https://img.shields.io/badge/license-MIT-blue)](LICENSE)
[![Buy me a coffee](https://img.shields.io/badge/buy%20me%20a%20coffee-☕-ffdd00)](https://buymeacoffee.com/davidniin)

Shared grocery list: a web app you install on your phone (PWA) to use at the supermarket, with the same list shown in
the **Shopping** section of a tablet dashboard. Runs on a home server behind Cloudflare Tunnel + Access
(see [`deploy/README.md`](deploy/README.md)); every push to `main` deploys automatically after CI passes.

- **Front end** (`web/`, Vue 3 + Vite). List grouped by aisle with a progress bar. Tap or swipe right to move an item
  to the cart, swipe left to delete, long-press (or `⋯`) to edit. Add items at the bottom: `milk x2`, several at once
  separated by commas (`bread, eggs x12`), suggestions and **usual items**, which learn from what you buy. Works
  **offline**: changes show up instantly, are stored on the phone and sent when the connection comes back.
  **✓ Compra finalizada** (shopping done) saves what's in the cart to the history, with optional amount and receipt
  photo. **🧾 Historial** has past trips, **templates** (lists you repeat) and **stats** (spend per month and store,
  how often you shop, what you buy most). **🔁 Se te suele acabar** suggests what you buy regularly and is due again.
- **Back end** (`server/`, Node + Hono). Serves the `/v1` API and the built web app from a single container.
- **Database:** PostgreSQL. The schema lives in `server/migrations/` and is applied on startup. Receipt photos are
  stored in the database (resized on the phone to ~1600 px), so they are part of the backups.

```
Phone (PWA) ──▶ Cloudflare Access ──▶ tunnel ──▶ grocery :8790 ──▶ PostgreSQL
Tablet (dashboard) ──(tunnel network, GROCERY_TOKEN)──┘
```

## Repository layout

```
server/
  src/index.js        startup: config check, migrations, HTTP server
  src/app.js          HTTP app: security headers, limits, access check, routes, static web
  src/auth.js         access control (shared token and/or Cloudflare Access JWT)
  src/routes/         /v1 endpoints (list, trips, templates)
  src/validate.js     input validation (pure functions)
  src/catalog.js      stores, aisles, usual items, starter catalogue
  migrations/         NNN_name.sql, applied once each, in order
  test/               node:test (unit + API against a real PostgreSQL)
web/                  Vue 3 PWA
deploy/               production compose file, deploy / backup / restore scripts
compose.dev.yml       PostgreSQL for local development
```

## Local development

Requires Node 22+ and Docker.

```sh
npm install                       # repo tooling (ESLint)
npm run dev:db                    # PostgreSQL on 127.0.0.1:5432 (DEV_DB_PORT=55432 npm run dev:db if it's taken)
cp server/.env.example server/.env
cd server && npm install && npm run dev    # API at http://localhost:8790
cd web && npm install && npm run dev       # web app at http://localhost:5173 (proxies /v1 to the API)
```

Checks (the same ones CI runs):

```sh
npm run lint
npm test        # server tests; the API tests need TEST_DATABASE_URL (in server/.env). They WIPE that database.
```

## Landing page and live demo

`site/` is a landing page with the app running inside a phone: **https://davidniin.github.io/grocery-list/**
(the demo alone at `/demo/`). The demo is the same web app built with `--mode demo`: made-up data from
`web/src/demo.js`, no server and no token, and changes stay in that browser tab. It is published to GitHub Pages by
`.github/workflows/pages.yml` on every push to `main` that touches `site/`, `web/` or the screenshots.

```sh
cd web && npm run dev:demo      # the demo, locally, without a server
cd web && npm run build:site    # builds site/dist (landing + demo)
```

## Access control

Every `/v1` endpoint except `/v1/health` needs one of:

- `Authorization: Bearer <GROCERY_TOKEN>` (24+ characters). The phone asks for it once, or open the app once as
  `https://<host>/#token=<GROCERY_TOKEN>`: it goes in the URL fragment, which browsers never send to the server.
- A valid **Cloudflare Access** JWT (`Cf-Access-Jwt-Assertion`, added by Cloudflare), when `CF_ACCESS_TEAM_DOMAIN`
  and `CF_ACCESS_AUD` are set. The signature, audience, issuer and expiry are checked, so going around Access
  doesn't get anyone in.

With neither configured, the server refuses to start (`ALLOW_NO_AUTH=1` exists for local development only).

## API `/v1`

An item is `{ id, name, cat, qty, store, done, note }`; the list is returned as
`{ version, updatedAt, data: { items, templates } }`, and `version` increases with every change. Clients set the
`id` of what they create, so retries after a network drop don't duplicate anything.

| Route | Purpose |
|---|---|
| `GET /v1/health` | status and database connection (public) |
| `GET /v1/meta` | stores, aisles and their order per store, starter usual items |
| `GET /v1/products` | known products (suggestions and usual items), most used first |
| `GET /v1/list` | the list |
| `PUT /v1/list` | the whole list (dashboard); anything not included is deleted |
| `POST /v1/list/items` | add an item |
| `PATCH /v1/list/items/:id` | update individual fields |
| `DELETE /v1/list/items/:id` | delete |
| `POST /v1/list/clear-done[?store=]` | empty the cart (checked-off items) |
| `POST /v1/list/finish` | shopping done: `{ id, store?, total? }`, cart → history |
| `GET /v1/trips[?limit=]` | history, newest first |
| `PATCH /v1/trips/:id` | set the amount: `{ total }` |
| `DELETE /v1/trips/:id` | delete a trip |
| `POST /v1/trips/:id/undo` | undo: items go back to the cart |
| `POST/GET/DELETE /v1/trips/:id/receipt` | receipt photo (multipart field `file`, JPEG/PNG/WebP/HEIC, 8 MB max) |
| `PUT/DELETE /v1/templates/:id` | templates: `{ name, items }` |

Stores, aisles and the starter catalogue live in `server/src/catalog.js` (names in Spanish).

**Known limitation:** the dashboard saves the whole list (`PUT`). If, within the same ~10 s, someone adds something
from the phone and someone else changes something on the tablet, the phone's change may be lost. The phone updates
item by item and doesn't have this problem.

## Security

See [SECURITY.md](SECURITY.md). Found a vulnerability? Please report it privately, never in a public issue.

## Contributing

Ideas, bug reports and pull requests are welcome, in English or Spanish. Read [CONTRIBUTING.md](CONTRIBUTING.md)
and the [Code of Conduct](CODE_OF_CONDUCT.md).

## Support

This app is free and always will be. If it's useful to you, you can
**[buy me a coffee ☕](https://buymeacoffee.com/davidniin)** — thank you!

## License

[MIT](LICENSE)
