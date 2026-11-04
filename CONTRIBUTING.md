# Contributing to Grocery list

**English** · [Español](#contribuir-a-la-compra)

Thanks for wanting to help! Bug reports, ideas, translations, docs and code are all welcome, in English or Spanish.

## Before you start

- **Bugs and ideas:** open an [issue](../../issues/new/choose) with the template. Check first that it isn't already
  reported.
- **Bigger changes** (new features, new dependencies, changes to the database schema or the API): open an issue to
  discuss it before writing the code, so your work isn't wasted.
- **Security problems:** never in a public issue. See [SECURITY.md](SECURITY.md).
- Good places to start: issues labelled `good first issue` and `help wanted`, **your supermarket's aisles** and the
  starter catalogue (`server/src/catalog.js`), and an English version of the app (today its texts are in Spanish).

## Set up

You need Node 22+ and Docker (for PostgreSQL).

```sh
npm install                       # repo tooling (ESLint)
npm run dev:db                    # PostgreSQL on 127.0.0.1:5432
cp server/.env.example server/.env
cd server && npm install && npm run dev    # API at http://localhost:8790
cd web && npm install && npm run dev       # web app at http://localhost:5173 (proxies /v1 to the API)
```

Without a server, `cd web && npm run dev:demo` opens the app with made-up data (`web/src/demo.js`). The landing page
and its live demo: `cd web && npm run build:site`, then serve `site/dist/` with any static server.

## Making a change

1. Fork the repo and create a branch: `git checkout -b fix/short-description`.
2. Keep the change focused: one pull request, one topic.
3. Add or update tests in `server/test/` (`node:test`). The API tests need `TEST_DATABASE_URL` and **wipe** that
   database.
4. Check that everything passes:
   ```sh
   npm run lint
   npm test
   cd web && npm run build
   ```
5. Update `README.md` **and** `README.es.md` if behaviour changes (if you only write one language, say so in the PR
   and someone will translate it).
6. Open the pull request and fill in the template.

## Style

- Plain JavaScript (ES modules), Vue 3 `<script setup>`, no TypeScript build step.
- Keep it small: add a dependency only if it saves a lot of code, and pin its version.
- Many code comments are in Spanish; new comments can be in English or Spanish.
- Database changes go in a new `server/migrations/NNN_name.sql`; never edit one that has already been released.
- **Never include real personal data** in code, tests, fixtures or screenshots: no real receipts, names, addresses or
  tokens. Use the demo for screenshots and made-up data in tests.

## Commits

Short, imperative summary (`Add store tabs`, `Fix undo after finishing a trip`). Reference the issue if there is one
(`Fixes #12`).

By contributing you agree that your contribution is licensed under the [MIT License](LICENSE) and that you follow the
[Code of Conduct](CODE_OF_CONDUCT.md).

---

# Contribuir a La compra

[English](#contributing-to-grocery-list) · **Español**

¡Gracias por querer ayudar! Avisos de fallos, ideas, traducciones, documentación y código son bienvenidos, en español o
en inglés.

## Antes de empezar

- **Fallos e ideas:** abre un [issue](../../issues/new/choose) con la plantilla. Mira antes si ya está abierto.
- **Cambios grandes** (funciones nuevas, dependencias nuevas, cambios en el esquema de la base de datos o en la API):
  abre un issue para hablarlo antes de programar, así no pierdes trabajo.
- **Problemas de seguridad:** nunca en un issue público. Mira [SECURITY.md](SECURITY.md).
- Buenos sitios para empezar: los issues con `good first issue` y `help wanted`, **los pasillos de tu supermercado** y
  el catálogo inicial (`server/src/catalog.js`), y una versión en inglés de la app (hoy los textos están en español).

## Preparar el entorno

Necesitas Node 22+ y Docker (para PostgreSQL).

```sh
npm install                       # herramientas del repo (ESLint)
npm run dev:db                    # PostgreSQL en 127.0.0.1:5432
cp server/.env.example server/.env
cd server && npm install && npm run dev    # API en http://localhost:8790
cd web && npm install && npm run dev       # web en http://localhost:5173 (pasa /v1 a la API)
```

Sin servidor, `cd web && npm run dev:demo` abre la app con datos inventados (`web/src/demo.js`). La landing y su demo
en vivo: `cd web && npm run build:site`, y sirve `site/dist/` con cualquier servidor estático.

## Hacer un cambio

1. Haz un fork y crea una rama: `git checkout -b fix/descripcion-corta`.
2. Un pull request, un tema.
3. Añade o actualiza tests en `server/test/` (`node:test`). Los de la API necesitan `TEST_DATABASE_URL` y **borran**
   esa base de datos.
4. Comprueba que todo pasa:
   ```sh
   npm run lint
   npm test
   cd web && npm run build
   ```
5. Actualiza `README.es.md` **y** `README.md` si cambia el comportamiento (si solo escribes en un idioma, dilo en el PR
   y alguien lo traducirá).
6. Abre el pull request y rellena la plantilla.

## Estilo

- JavaScript normal (módulos ES), Vue 3 con `<script setup>`, sin compilar TypeScript.
- Pocas dependencias: añade una solo si ahorra mucho código, y fija su versión.
- Muchos comentarios del código están en español; los nuevos pueden ir en español o en inglés.
- Los cambios de base de datos van en una migración nueva `server/migrations/NNN_nombre.sql`; nunca se edita una que
  ya se ha publicado.
- **Nunca pongas datos personales reales** en código, tests, datos de ejemplo o capturas: ni tickets, ni nombres, ni
  direcciones, ni claves reales. Usa la demo para las capturas y datos inventados en los tests.

## Commits

Resumen corto en imperativo (`Add store tabs`, `Corrige deshacer tras finalizar la compra`). Menciona el issue si lo
hay (`Fixes #12`).

Al contribuir aceptas que tu aportación se publica con la [licencia MIT](LICENSE) y que sigues el
[Código de conducta](CODE_OF_CONDUCT.md).
