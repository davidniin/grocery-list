// La aplicación HTTP: API /v1 (ver README.md) y la web del móvil compilada. Sin arrancar nada: lo hace index.js
// (así los tests pueden usarla con app.request()).
import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { bodyLimit } from 'hono/body-limit';
import { secureHeaders } from 'hono/secure-headers';
import { serveStatic } from '@hono/node-server/serve-static';
import { CONFIG } from './config.js';
import { CATS, USUALS } from './catalog.js';
import { sql, loadStores, catOrder } from './db.js';
import { accessCheck } from './auth.js';
import { list } from './routes/list.js';
import { trips } from './routes/trips.js';
import { templates } from './routes/templates.js';
import { stores } from './routes/stores.js';

const JSON_MAX_BYTES = 512 * 1024;

export function createApp(config = CONFIG) {
  const app = new Hono();

  // Cabeceras de seguridad en todo (API y web). La web solo carga cosas de su propio origen;
  // las fotos de los tickets se muestran como blob: (se descargan con fetch, con credenciales).
  app.use('*', secureHeaders({
    contentSecurityPolicy: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'"],
      styleSrc: ["'self'"],
      imgSrc: ["'self'", 'blob:', 'data:'],
      connectSrc: ["'self'"],
      workerSrc: ["'self'"],
      manifestSrc: ["'self'"],
      objectSrc: ["'none'"],
      baseUri: ["'none'"],
      formAction: ["'self'"],
      frameAncestors: ["'none'"],
    },
    referrerPolicy: 'no-referrer',
    permissionsPolicy: { camera: ['self'], microphone: [], geolocation: [] },
  }));

  const api = new Hono();
  if (config.corsOrigins.length) api.use('*', cors({ origin: config.corsOrigins }));
  // Límite de tamaño para todo menos la foto del ticket, que tiene el suyo
  const jsonLimit = bodyLimit({ maxSize: JSON_MAX_BYTES, onError: (c) => c.json({ error: 'petición demasiado grande' }, 413) });
  api.use('*', (c, next) => (c.req.method === 'POST' && c.req.path.endsWith('/receipt') ? next() : jsonLimit(c, next)));
  api.use('*', accessCheck(config));
  api.use('*', async (c, next) => { await next(); c.header('Cache-Control', c.res.headers.get('Cache-Control') || 'no-store'); });

  // El detalle del error va al log, nunca al cliente
  api.onError((e, c) => {
    console.error('[api] ' + c.req.method + ' ' + c.req.path + ': ' + (e.stack || e.message));
    return c.json({ error: 'error interno' }, 500);
  });
  api.notFound((c) => c.json({ error: 'no existe' }, 404));

  api.get('/health', async (c) => {
    try {
      await sql`select 1`;
      return c.json({ ok: true, db: true });
    } catch (e) {
      console.error('[health] ' + e.message);
      return c.json({ ok: false, db: false }, 503);
    }
  });
  api.get('/meta', async (c) => {
    const st = await loadStores();
    return c.json({ stores: st, cats: CATS, catOrder: catOrder(st), usuals: USUALS });
  });
  api.get('/products', async (c) => c.json(await sql`
    select name, cat, store, uses from grocery_product order by uses desc, last_used desc nulls last, name`));
  api.route('/', list);
  api.route('/', trips);
  api.route('/', templates);
  api.route('/', stores);

  app.route('/v1', api);

  // ------------------------------------------------------------ web (PWA)
  if (config.staticDir) {
    const root = config.staticDir;
    // Los ficheros de assets/ llevan hash en el nombre: caché larga. El resto (index, sw.js, manifest) siempre fresco.
    app.use('/*', serveStatic({
      root,
      onFound: (p, c) => c.header('Cache-Control', p.includes('/assets/') ? 'public, max-age=31536000, immutable' : 'no-cache'),
    }));
    app.get('*', serveStatic({ root, path: 'index.html', onFound: (p, c) => c.header('Cache-Control', 'no-cache') }));
  }
  return app;
}
