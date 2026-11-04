# Lista de la compra

🇬🇧 [Read in English](README.md)

[![Demo en vivo](https://img.shields.io/badge/demo%20en%20vivo-pru%C3%A9bala-2f7d5b)](https://davidniin.github.io/grocery-list/)
[![Licencia: MIT](https://img.shields.io/badge/licencia-MIT-blue)](LICENSE)
[![Invítame a un café](https://img.shields.io/badge/inv%C3%ADtame%20a%20un%20caf%C3%A9-☕-ffdd00)](https://buymeacoffee.com/davidniin)

Lista de la compra compartida: una web que se instala en el móvil (PWA) para usarla en el súper, con la misma lista en
la sección **Compra** del dashboard de la tablet. Funciona en el servidor de casa detrás de Cloudflare Tunnel + Access
(ver [`deploy/README.md`](deploy/README.md)); cada push a `main` se despliega solo después de pasar la CI.

- **Web** (`web/`, Vue 3 + Vite). Lista agrupada por pasillos con barra de progreso. Toca o desliza a la derecha para
  pasar algo al carro, a la izquierda para borrarlo, mantén pulsado (o `⋯`) para editarlo. Se añade abajo: `leche x2`,
  varios a la vez separados por comas (`pan, huevos x12`), sugerencias y **habituales**, que aprenden de lo que compras.
  Funciona **sin cobertura**: los cambios se ven al momento, se guardan en el móvil y se envían cuando vuelve la red.
  **✓ Compra finalizada** guarda lo del carro en el historial, con importe y foto del ticket opcionales.
  **🧾 Historial** tiene las compras pasadas, las **plantillas** (listas que repites) y las **estadísticas** (gasto por
  mes y tienda, cada cuánto compras, lo que más compras). **🔁 Se te suele acabar** sugiere lo que toca volver a comprar.
- **Servidor** (`server/`, Node + Hono). Sirve la API `/v1` y la web compilada en un solo contenedor.
- **Base de datos:** PostgreSQL. El esquema está en `server/migrations/` y se aplica al arrancar. Las fotos de los
  tickets van en la base de datos (reducidas en el móvil a ~1600 px), así que entran en las copias de seguridad.

```
Móvil (PWA) ──▶ Cloudflare Access ──▶ túnel ──▶ grocery :8790 ──▶ PostgreSQL
Tablet (dashboard) ──(red del túnel, GROCERY_TOKEN)──┘
```

## Estructura

```
server/
  src/index.js        arranque: comprueba la configuración, migraciones, servidor HTTP
  src/app.js          la app HTTP: cabeceras de seguridad, límites, control de acceso, rutas, web
  src/auth.js         control de acceso (clave compartida y/o JWT de Cloudflare Access)
  src/routes/         rutas /v1 (lista, compras, plantillas)
  src/validate.js     validación de lo que llega (funciones puras)
  src/catalog.js      tiendas, pasillos, habituales y catálogo inicial
  migrations/         NNN_nombre.sql, cada una se aplica una vez y en orden
  test/               node:test (unitarios + API contra un PostgreSQL de verdad)
web/                  PWA en Vue 3
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
```

Comprobaciones (las mismas que la CI):

```sh
npm run lint
npm test        # tests del servidor; los de la API necesitan TEST_DATABASE_URL (en server/.env). BORRAN esa base de datos.
```

## Landing y demo en vivo

`site/` es una landing con la app funcionando dentro de un móvil: **https://davidniin.github.io/grocery-list/**
(la demo sola en `/demo/`). La demo es la misma web compilada con `--mode demo`: datos inventados de `web/src/demo.js`,
sin servidor ni clave, y los cambios se quedan en esa pestaña. La publica en GitHub Pages
`.github/workflows/pages.yml` en cada push a `main` que toque `site/`, `web/` o las capturas.

```sh
cd web && npm run dev:demo      # la demo en local, sin servidor
cd web && npm run build:site    # genera site/dist (landing + demo)
```

## Control de acceso

Todas las rutas `/v1` menos `/v1/health` necesitan una de estas dos cosas:

- `Authorization: Bearer <GROCERY_TOKEN>` (24 caracteres o más). El móvil la pide la primera vez, o abre la app una
  vez como `https://<servidor>/#token=<GROCERY_TOKEN>`: va en el fragmento (#), que el navegador nunca envía al servidor.
- Un JWT válido de **Cloudflare Access** (`Cf-Access-Jwt-Assertion`, lo añade Cloudflare), si están puestas
  `CF_ACCESS_TEAM_DOMAIN` y `CF_ACCESS_AUD`. Se comprueban la firma, la audiencia, el emisor y la caducidad: saltarse
  Access no sirve para entrar.

Sin ninguna de las dos, el servidor no arranca (`ALLOW_NO_AUTH=1` existe solo para desarrollo en local).

## API `/v1`

Un elemento es `{ id, name, cat, qty, store, done, note }`; la lista se devuelve como
`{ version, updatedAt, data: { items, templates } }` y `version` sube con cada cambio. El `id` de lo que se crea lo
pone el cliente: si se reenvía tras un corte de red, no se duplica.

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
| `POST /v1/trips/:id/undo` | deshacer: los productos vuelven al carro |
| `POST/GET/DELETE /v1/trips/:id/receipt` | foto del ticket (multipart, campo `file`, JPEG/PNG/WebP/HEIC, máx. 8 MB) |
| `PUT/DELETE /v1/templates/:id` | plantillas: `{ name, items }` |

Tiendas, pasillos y catálogo inicial: `server/src/catalog.js`.

**Limitación conocida:** el dashboard guarda la lista entera (`PUT`). Si en los mismos ~10 s alguien añade algo desde
el móvil y otra persona cambia algo en la tablet, el cambio del móvil se puede perder. El móvil cambia elemento a
elemento y no tiene este problema.

## Seguridad

Ver [SECURITY.md](SECURITY.md). ¿Has encontrado una vulnerabilidad? Avisa en privado, nunca en un issue público.

## Contribuir

Ideas, avisos de fallos y pull requests son bienvenidos, en español o en inglés. Lee
[CONTRIBUTING.md](CONTRIBUTING.md) y el [Código de conducta](CODE_OF_CONDUCT.md).

## Apoyar el proyecto

Esta app es gratis y lo seguirá siendo. Si te resulta útil, puedes **[invitarme a un café ☕](https://buymeacoffee.com/davidniin)**.

## Licencia

[MIT](LICENSE)
