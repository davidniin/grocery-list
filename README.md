# Grocery list — the shopping list for the whole house

**English** · [Español](README.es.md)

[![Live demo](https://img.shields.io/badge/live%20demo-try%20it-b3274b)](https://davidniin.github.io/grocery-list/)
[![License: MIT](https://img.shields.io/badge/license-MIT-blue)](LICENSE)
[![Buy me a coffee](https://img.shields.io/badge/buy%20me%20a%20coffee-☕-ffdd00)](https://buymeacoffee.com/davidniin)

One shared list for everyone at home, sorted in the order you walk the supermarket. It's a web app you install on
your phone (PWA), it works with no signal, and you **host it yourself**: your list lives on your server.

**▶ [Try the live demo](https://davidniin.github.io/grocery-list/)**: made-up data, nothing to install, nothing is
saved.

<p align="center">
  <img src="docs/screenshots/en/list.png" width="200" alt="List sorted by aisle with a progress bar" />
  <img src="docs/screenshots/en/add.png" width="200" alt="Adding a new item and choosing its aisle" />
  <img src="docs/screenshots/en/stats.png" width="200" alt="Spending per month and store" />
  <img src="docs/screenshots/en/dark-list.png" width="200" alt="Dark mode" />
</p>

## Features

- **By aisle and by store.** The list groups itself by aisle in the order of each supermarket, with a tab per store
  and a progress bar. **Add your own stores**, rename them or delete them.
- **One thumb.** Tap or swipe right to put an item in the cart, swipe left to delete it, long-press (or `⋯`) to
  edit it. Everything can be undone.
- **Add in seconds.** `milk x2`, several at once (`bread, eggs x12`), suggestions as you type and your **usual
  items** one tap away. A **new item** shows a small card to choose its aisle (one is suggested) and store before
  adding it; next time it's remembered. The panel closes with **Done**, by tapping outside, with Enter on an empty
  box or by lowering the keyboard.
- **Works with no signal.** Changes show up instantly, are kept on the phone and are sent when the connection comes
  back.
- **Shared.** Everyone sees the same list within seconds, also on a tablet dashboard (`PUT /v1/list`).
- **History and receipts.** **Shopping done** saves what's in the cart, with the amount and a photo of the receipt
  (both optional). Repeat a past trip or save it as a **template**.
- **About to run out.** It learns how often you buy each thing and suggests it when it's due.
- **Stats.** Spend per month and store, how often you go shopping, what you buy most.
- **English and Spanish.** The app follows the phone's language, and you can switch it at the bottom of the list.
- **Private.** No account, no ads, no analytics. Access with a token or Cloudflare Access.

## Install yours

One Docker container (web app + API) next to PostgreSQL: at home, on a NAS, a Raspberry Pi or a VPS. You need HTTPS
to install it on the phone (Cloudflare Tunnel, Caddy, Tailscale…).

```sh
git clone https://github.com/davidniin/grocery-list.git && cd grocery-list
docker build -t grocery-list .
docker run -d -p 8790:8790 \
  -e DATABASE_URL=postgres://user:password@your-db:5432/grocery \
  -e GROCERY_TOKEN="$(openssl rand -hex 24)" \
  grocery-list
```

The database schema is created on start. Then open it on the phone, enter the token once and use **Add to Home
Screen**. The full production setup (compose file, Cloudflare Access, automatic deploys, backups) is in
[`deploy/README.md`](deploy/README.md).

## How it works

```
Phone (PWA) ──▶ HTTPS (e.g. Cloudflare Access + tunnel) ──▶ grocery :8790 ──▶ PostgreSQL
Tablet (dashboard) ──(GROCERY_TOKEN)──┘
```

- **Web app** (`web/`, Vue 3 + Vite). Every change is applied on the phone first and queued; the queue is sent in
  order when there's a connection, and the list is refreshed every 5 s when nothing is pending.
- **Server** (`server/`, Node + Hono). Serves the `/v1` API and the built web app from a single container.
- **Database:** PostgreSQL. The schema lives in `server/migrations/` and is applied on start. Receipt photos are
  stored in the database (resized on the phone to ~1600 px), so they are part of the backups.

## Languages

The app is in **Spanish and English** (`web/src/i18n/es.js` and `en.js`, same keys; `npm run test:web` checks that
none is missing). It picks the phone's language, it can be switched at the bottom of the list, and `?lang=en` /
`?lang=es` in the address forces one (that's how the landing page opens the demo).

What is **not** translated: your **items** and your **stores**, because they're your household's data. Aisles are
stored in Spanish (that's what the tablet dashboard reads) and only their label is translated (`cat.*` keys).

To add a language: copy `en.js` to e.g. `fr.js`, translate the values, and add it to `DICTS` and `LANGS` in
`web/src/i18n/index.js` and to the test in `web/test/i18n.test.js`.

## Repository layout

```
server/
  src/index.js        startup: config check, migrations, HTTP server
  src/app.js          HTTP app: security headers, limits, access check, routes, static web
  src/auth.js         access control (shared token and/or Cloudflare Access JWT)
  src/routes/         /v1 endpoints (list, trips, templates, stores)
  src/validate.js     input validation (pure functions)
  src/catalog.js      default stores, aisles, usual items, starter catalogue
  migrations/         NNN_name.sql, applied once each, in order
  test/               node:test (unit + API against a real PostgreSQL)
web/
  src/                Vue 3 PWA (App.vue, sheets, sync.js = offline queue)
  src/i18n/           translations (es, en)
  src/demo.js         made-up data for the live demo
  test/               translation checks
site/                 landing page (GitHub Pages)
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
cd web && npm run dev:demo                 # or: the demo, with made-up data and no server
```

Checks (the same ones CI runs):

```sh
npm run lint
npm test        # translations + server tests; the API tests need TEST_DATABASE_URL (in server/.env). They WIPE it.
```

### Landing page and live demo

`site/` is the landing page, with the app running inside a phone: **https://davidniin.github.io/grocery-list/**
(the demo alone at `/demo/`). The demo is the same web app built with `--mode demo`: made-up data from
`web/src/demo.js`, no server and no token, changes stay in that browser tab, and none of it ends up in the normal
build. `.github/workflows/pages.yml` publishes it on every push to `main` that touches `site/`, `web/` or the
screenshots (`docs/screenshots/en` and `es`).

```sh
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
`{ version, updatedAt, data: { items, templates, stores } }`, and `version` increases with every change. Clients set
the `id` of what they create, so retries after a network drop don't duplicate anything.

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
| `PUT /v1/stores/:id` | create or rename a store: `{ name }` (`id`: lowercase letters, digits, `-`, `_`) |
| `DELETE /v1/stores/:id` | delete a store; its items stay on the list without a store. At least one always remains |

The default stores (created the first time), aisles and the starter catalogue live in `server/src/catalog.js`
(names in Spanish). A store added later uses the default aisle order.

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
