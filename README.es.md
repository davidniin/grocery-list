# La compra — la lista de la compra de toda la casa

[English](README.md) · **Español**

[![Demo en vivo](https://img.shields.io/badge/demo%20en%20vivo-pru%C3%A9bala-2f7d5b)](https://davidniin.github.io/grocery-list/)
[![Licencia: MIT](https://img.shields.io/badge/licencia-MIT-blue)](LICENSE)
[![Invítame a un café](https://img.shields.io/badge/inv%C3%ADtame%20a%20un%20caf%C3%A9-☕-ffdd00)](https://buymeacoffee.com/davidniin)

Una sola lista para todos en casa, ordenada como recorres el súper. Es una web que se instala en el móvil (PWA),
funciona sin cobertura y **la alojas tú**: tu lista está en tu servidor.

**▶ [Prueba la demo en vivo](https://davidniin.github.io/grocery-list/)**: datos inventados, sin instalar nada y sin
guardar nada.

<p align="center">
  <img src="docs/screenshots/es/list.png" width="200" alt="Lista por pasillos con barra de progreso" />
  <img src="docs/screenshots/es/add.png" width="200" alt="Añadir un producto nuevo eligiendo su pasillo" />
  <img src="docs/screenshots/es/stats.png" width="200" alt="Gasto por mes y por tienda" />
  <img src="docs/screenshots/es/dark-list.png" width="200" alt="Modo oscuro" />
</p>

## Qué hace

- **Por pasillos y por tienda.** La lista se agrupa por pasillos en el orden de cada súper, con una pestaña por tienda
  y barra de progreso. **Añade tus propias tiendas**, cámbiales el nombre o bórralas.
- **Con un dedo.** Toca o desliza a la derecha para pasar algo al carro, a la izquierda para borrarlo, mantén pulsado
  (o `⋯`) para editarlo. Todo se puede deshacer.
- **Añadir en segundos.** `leche x2`, varios a la vez (`pan, huevos x12`), sugerencias mientras escribes y tus
  **habituales** a un toque. Un **producto nuevo** muestra una ficha para elegir su pasillo (viene uno propuesto) y su
  tienda antes de añadirlo; la próxima vez ya lo recuerda. El panel se cierra con **Listo**, tocando fuera, con Intro
  sin texto o bajando el teclado.
- **Sin cobertura.** Los cambios se ven al momento, se guardan en el móvil y se envían cuando vuelve la red.
- **Compartida.** Todos ven la misma lista en segundos, también en el dashboard de la tablet (`PUT /v1/list`).
- **Historial y tickets.** **Compra finalizada** guarda lo del carro con el importe y la foto del ticket (los dos
  opcionales). Repite una compra pasada o guárdala como **plantilla**.
- **Se te suele acabar.** Aprende cada cuánto compras cada cosa y te la sugiere cuando toca.
- **Estadísticas.** Gasto por mes y tienda, cada cuánto vas a comprar y lo que más compras.
- **Español e inglés.** La app sigue el idioma del móvil y se puede cambiar abajo en la lista.
- **Privada.** Sin cuenta, sin anuncios, sin analítica. Acceso con clave o con Cloudflare Access.

## Instala la tuya

Un contenedor Docker (web + API) junto a PostgreSQL: en casa, en un NAS, una Raspberry Pi o un VPS. Para instalarla
en el móvil hace falta HTTPS (Cloudflare Tunnel, Caddy, Tailscale…).

```sh
git clone https://github.com/davidniin/grocery-list.git && cd grocery-list
docker build -t grocery-list .
docker run -d -p 8790:8790 \
  -e DATABASE_URL=postgres://usuario:clave@tu-bd:5432/grocery \
  -e GROCERY_TOKEN="$(openssl rand -hex 24)" \
  grocery-list
```

El esquema de la base de datos se crea al arrancar. Después ábrela en el móvil, escribe la clave una vez y usa
**Añadir a pantalla de inicio**. La instalación completa de producción (compose, Cloudflare Access, despliegue
automático, copias) está en [`deploy/README.md`](deploy/README.md).

## Cómo funciona

```
Móvil (PWA) ──▶ HTTPS (p. ej. Cloudflare Access + túnel) ──▶ grocery :8790 ──▶ PostgreSQL
Tablet (dashboard) ──(GROCERY_TOKEN)──┘
```

- **Web** (`web/`, Vue 3 + Vite). Cada cambio se aplica primero en el móvil y va a una cola; la cola se envía en
  orden cuando hay conexión, y sin nada pendiente la lista se actualiza cada 5 s.
- **Servidor** (`server/`, Node + Hono). Sirve la API `/v1` y la web compilada en un solo contenedor.
- **Base de datos:** PostgreSQL. El esquema está en `server/migrations/` y se aplica al arrancar. Las fotos de los
  tickets van en la base de datos (reducidas en el móvil a ~1600 px), así que entran en las copias de seguridad.

## Idiomas

La app está en **español e inglés** (`web/src/i18n/es.js` y `en.js`, con las mismas claves; `npm run test:web`
comprueba que no falte ninguna). Elige el idioma del móvil, se puede cambiar abajo en la lista, y `?lang=es` /
`?lang=en` en la dirección fuerza uno (así abre la landing la demo).

Lo que **no** se traduce: tus **productos** y tus **tiendas**, porque son datos de tu casa. Los pasillos se guardan en
español (es lo que lee el dashboard de la tablet) y solo se traduce su nombre en pantalla (claves `cat.*`).

Para añadir un idioma: copia `en.js` como, p. ej., `fr.js`, traduce los valores y añádelo a `DICTS` y `LANGS` en
`web/src/i18n/index.js` y al test de `web/test/i18n.test.js`.

## Estructura

```
server/
  src/index.js        arranque: comprueba la configuración, migraciones, servidor HTTP
  src/app.js          la app HTTP: cabeceras de seguridad, límites, control de acceso, rutas, web
  src/auth.js         control de acceso (clave compartida y/o JWT de Cloudflare Access)
  src/routes/         rutas /v1 (lista, compras, plantillas, tiendas)
  src/validate.js     validación de lo que llega (funciones puras)
  src/catalog.js      tiendas de partida, pasillos, habituales y catálogo inicial
  migrations/         NNN_nombre.sql, cada una se aplica una vez y en orden
  test/               node:test (unitarios + API contra un PostgreSQL de verdad)
web/
  src/                PWA en Vue 3 (App.vue, fichas, sync.js = cola sin conexión)
  src/i18n/           traducciones (es, en)
  src/demo.js         datos inventados para la demo
  test/               comprobación de las traducciones
site/                 landing (GitHub Pages)
deploy/               compose de producción y scripts de despliegue / copia / restauración
compose.dev.yml       PostgreSQL para desarrollo en local
```

## Desarrollo en local

Hace falta Node 22+ y Docker.

```sh
npm install                       # herramientas del repo (ESLint)
npm run dev:db                    # PostgreSQL en 127.0.0.1:5432 (DEV_DB_PORT=55432 npm run dev:db si está ocupado)
cp server/.env.example server/.env
cd server && npm install && npm run dev    # API en http://localhost:8790
cd web && npm install && npm run dev       # web en http://localhost:5173 (pasa /v1 a la API)
cd web && npm run dev:demo                 # o: la demo, con datos inventados y sin servidor
```

Comprobaciones (las mismas que la CI):

```sh
npm run lint
npm test        # traducciones + tests del servidor; los de la API necesitan TEST_DATABASE_URL (en server/.env). La BORRAN.
```

### Landing y demo en vivo

`site/` es la landing, con la app funcionando dentro de un móvil: **https://davidniin.github.io/grocery-list/**
(la demo sola en `/demo/`). La demo es la misma web compilada con `--mode demo`: datos inventados de
`web/src/demo.js`, sin servidor ni clave, los cambios se quedan en esa pestaña y nada de esto entra en la app normal.
La publica `.github/workflows/pages.yml` en cada push a `main` que toque `site/`, `web/` o las capturas
(`docs/screenshots/en` y `es`).

```sh
cd web && npm run build:site    # genera site/dist (landing + demo)
```

## Control de acceso

Todas las rutas `/v1` menos `/v1/health` necesitan una de estas dos cosas:

- `Authorization: Bearer <GROCERY_TOKEN>` (24 caracteres o más). El móvil la pide una vez, o abre la app una vez como
  `https://<host>/#token=<GROCERY_TOKEN>`: va en el fragmento de la URL, que el navegador nunca envía al servidor.
- Un JWT válido de **Cloudflare Access** (`Cf-Access-Jwt-Assertion`, lo añade Cloudflare), si están puestos
  `CF_ACCESS_TEAM_DOMAIN` y `CF_ACCESS_AUD`. Se comprueban firma, audiencia, emisor y caducidad, así que saltarse
  Access no sirve para entrar.

Sin ninguna de las dos configurada, el servidor no arranca (`ALLOW_NO_AUTH=1` existe solo para desarrollo en local).

## API `/v1`

Un elemento es `{ id, name, cat, qty, store, done, note }`; la lista se devuelve como
`{ version, updatedAt, data: { items, templates, stores } }`, y `version` sube con cada cambio. El cliente pone el
`id` de lo que crea, así que los reintentos tras un corte de red no duplican nada.

| Ruta | Para qué |
|---|---|
| `GET /v1/health` | estado y conexión con la base de datos (pública) |
| `GET /v1/meta` | tiendas, pasillos y su orden por tienda, habituales de partida |
| `GET /v1/products` | productos conocidos (sugerencias y habituales), los más usados primero |
| `GET /v1/list` | la lista |
| `PUT /v1/list` | la lista entera (dashboard); lo que no venga se borra |
| `POST /v1/list/items` | añadir un elemento |
| `PATCH /v1/list/items/:id` | cambiar campos sueltos |
| `DELETE /v1/list/items/:id` | borrar |
| `POST /v1/list/clear-done[?store=]` | vaciar el carro (lo tachado) |
| `POST /v1/list/finish` | compra finalizada: `{ id, store?, total? }`, carro → historial |
| `GET /v1/trips[?limit=]` | historial, lo más reciente primero |
| `PATCH /v1/trips/:id` | poner el importe: `{ total }` |
| `DELETE /v1/trips/:id` | borrar una compra |
| `POST /v1/trips/:id/undo` | deshacer: lo comprado vuelve al carro |
| `POST/GET/DELETE /v1/trips/:id/receipt` | foto del ticket (campo multipart `file`, JPEG/PNG/WebP/HEIC, 8 MB máx.) |
| `PUT/DELETE /v1/templates/:id` | plantillas: `{ name, items }` |
| `PUT /v1/stores/:id` | crear o renombrar una tienda: `{ name }` (`id`: minúsculas, números, `-`, `_`) |
| `DELETE /v1/stores/:id` | borrar una tienda; lo suyo se queda en la lista, sin tienda. Siempre queda al menos una |

Las tiendas de partida (se crean la primera vez), los pasillos y el catálogo inicial están en
`server/src/catalog.js`. Una tienda añadida después usa el orden de pasillos normal.

**Limitación conocida:** el dashboard guarda la lista entera (`PUT`). Si en los mismos ~10 s alguien añade algo desde
el móvil y otra persona cambia algo en la tablet, el cambio del móvil se puede perder. El móvil va elemento a elemento
y no tiene este problema.

## Seguridad

Ver [SECURITY.md](SECURITY.md). ¿Has encontrado una vulnerabilidad? Avisa en privado, nunca en un issue público.

## Contribuir

Ideas, avisos de fallos y pull requests son bienvenidos, en español o en inglés. Lee
[CONTRIBUTING.md](CONTRIBUTING.md) y el [Código de conducta](CODE_OF_CONDUCT.md).

## Apoyar el proyecto

Esta app es gratis y lo seguirá siendo. Si te resulta útil, puedes **[invitarme a un café ☕](https://buymeacoffee.com/davidniin)**.

## Licencia

[MIT](LICENSE)
