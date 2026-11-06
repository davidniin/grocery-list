// Tests de la API contra un PostgreSQL de verdad. Solo con TEST_DATABASE_URL (BORRA sus tablas: nunca apuntes
// a la base de datos buena). En local: docker compose -f compose.dev.yml up -d y
//   TEST_DATABASE_URL=postgres://grocery:grocery@localhost:5432/grocery_test npm test
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';

const URL_ = process.env.TEST_DATABASE_URL;
const TOKEN = 't'.repeat(32);
const skip = URL_ ? false : 'sin TEST_DATABASE_URL';

let app, sql;
const auth = { Authorization: 'Bearer ' + TOKEN };
const req = (method, path, body, headers = {}) => app.request(path, {
  method,
  headers: { ...auth, ...(body === undefined ? {} : { 'Content-Type': 'application/json' }), ...headers },
  body: body === undefined ? undefined : JSON.stringify(body),
});

before(async () => {
  if (skip) return;
  process.env.DATABASE_URL = URL_;
  process.env.GROCERY_TOKEN = TOKEN;
  const db = await import('../src/db.js');
  sql = db.sql;
  await sql`drop table if exists grocery_receipt, grocery_trip, grocery_template, grocery_store, grocery_item, grocery_product, grocery_state, schema_migrations cascade`;
  await db.migrate({ retries: 1 });
  await db.migrate({ retries: 1 }); // dos veces: no debe fallar ni repetir nada
  app = (await import('../src/app.js')).createApp();
});
after(async () => { if (sql) await sql.end(); });

test('migraciones: aplicadas una vez y catálogo cargado', { skip }, async () => {
  const rows = await sql`select version from schema_migrations`;
  assert.deepEqual(rows.map((r) => r.version), [1, 2]);
  const r = await req('GET', '/v1/products');
  assert.ok((await r.json()).length > 10);
});

test('sin token: 401; health es público y no da detalles', { skip }, async () => {
  assert.equal((await app.request('/v1/list')).status, 401);
  const h = await app.request('/v1/health');
  assert.deepEqual(await h.json(), { ok: true, db: true });
  assert.ok(h.headers.get('content-security-policy'));
  assert.equal(h.headers.get('x-content-type-options'), 'nosniff');
});

test('lista: añadir, cambiar, tachar, finalizar y deshacer', { skip }, async () => {
  let r = await req('POST', '/v1/list/items', { id: 'a', name: 'Leche', cat: 'Lácteos y huevos', store: 'super' });
  assert.equal(r.status, 201);
  const v1 = (await r.json()).version;
  const leche = { id: 'a', name: 'Leche', cat: 'Lácteos y huevos', store: 'super' };
  r = await req('POST', '/v1/list/items', leche); // reenvío tras un corte: no duplica
  assert.equal((await r.json()).data.items.length, 1);

  r = await req('PATCH', '/v1/list/items/a', { done: true, qty: 2 });
  const doc = await r.json();
  assert.ok(doc.version > v1);
  assert.equal(doc.data.items[0].qty, 2);
  assert.equal((await req('PATCH', '/v1/list/items/nope', { done: true })).status, 404);
  assert.equal((await req('PATCH', '/v1/list/items/a', { name: '' })).status, 400);

  r = await req('POST', '/v1/list/finish', { id: 't1', store: 'super', total: '23,40' });
  assert.equal((await r.json()).data.items.length, 0);
  await req('POST', '/v1/list/finish', { id: 't1', store: 'super' }); // otra vez: no hace nada
  const trips = await (await req('GET', '/v1/trips')).json();
  assert.equal(trips.length, 1);
  assert.equal(trips[0].total, 23.4);

  r = await req('POST', '/v1/trips/t1/undo');
  assert.equal((await r.json()).data.items[0].done, true);
  assert.equal((await (await req('GET', '/v1/trips')).json()).length, 0);
});

test('PUT /list (dashboard) y límites', { skip }, async () => {
  let r = await req('PUT', '/v1/list', { data: { items: [{ id: 'x', name: 'Pan', store: 'inventada' }] } });
  const items = (await r.json()).data.items;
  assert.deepEqual(items.map((x) => [x.id, x.store]), [['x', null]]);
  assert.equal((await req('PUT', '/v1/list', { nope: 1 })).status, 400);
  r = await req('PUT', '/v1/list', { data: { items: Array.from({ length: 1001 }, (_, i) => ({ name: 'p' + i })) } });
  assert.equal(r.status, 400);
  r = await req('POST', '/v1/list/items', { name: 'x', note: 'n'.repeat(600 * 1024) });
  assert.equal(r.status, 413);
  assert.equal((await req('POST', '/v1/list/clear-done?store=inventada')).status, 400);
});

test('ticket: solo imágenes de verdad, y se sirve con su tipo', { skip }, async () => {
  await req('PUT', '/v1/list', { data: { items: [{ id: 'r', name: 'Huevos', done: true }] } });
  await req('POST', '/v1/list/finish', { id: 't2' });
  const upload = (bytes, type) => {
    const fd = new FormData();
    fd.append('file', new Blob([bytes], { type }), 'ticket');
    return app.request('/v1/trips/t2/receipt', { method: 'POST', headers: auth, body: fd });
  };
  // Un HTML que dice ser JPEG: fuera
  assert.equal((await upload(Buffer.from('<html><script>alert(1)</script>'), 'image/jpeg')).status, 400);
  const jpeg = Buffer.concat([Buffer.from([0xff, 0xd8, 0xff, 0xe0]), Buffer.alloc(100)]);
  assert.equal((await upload(jpeg, 'text/html')).status, 200);
  const r = await req('GET', '/v1/trips/t2/receipt');
  assert.equal(r.status, 200);
  assert.equal(r.headers.get('content-type'), 'image/jpeg');
  assert.equal((await app.request('/v1/trips/t2/receipt?token=' + TOKEN)).status, 401);
});

test('plantillas', { skip }, async () => {
  let r = await req('PUT', '/v1/templates/p1', { name: 'Barbacoa', items: [{ name: 'Carbón', qty: 2 }, { name: '' }] });
  assert.deepEqual((await r.json()).data.templates[0].items, [{ name: 'Carbón', cat: 'Otros', qty: 2, store: null }]);
  r = await req('DELETE', '/v1/templates/p1');
  assert.equal((await r.json()).data.templates.length, 0);
});

test('tiendas: crear, renombrar, borrar; la lista y /meta las llevan', { skip }, async () => {
  let r = await req('GET', '/v1/meta');
  let meta = await r.json();
  assert.deepEqual(meta.stores.map((s) => s.id), ['super', 'bonpreu']);
  assert.deepEqual(Object.keys(meta.catOrder).sort(), ['all', 'bonpreu', 'super']);

  r = await req('PUT', '/v1/stores/lidl-1', { name: '  Lidl   Centro ' });
  assert.equal(r.status, 200);
  assert.deepEqual((await r.json()).data.stores.at(-1), { id: 'lidl-1', name: 'Lidl Centro' });
  r = await req('PUT', '/v1/stores/lidl-1', { name: 'Lidl Centro' }); // reintento: no duplica
  assert.equal((await r.json()).data.stores.length, 3);
  meta = await (await req('GET', '/v1/meta')).json();
  assert.deepEqual(meta.catOrder['lidl-1'], meta.cats); // el dashboard necesita un orden para cada tienda

  assert.equal((await req('PUT', '/v1/stores/otra', { name: 'lidl centro' })).status, 409);
  assert.equal((await req('PUT', '/v1/stores/Mal%20Id', { name: 'X' })).status, 400);
  assert.equal((await req('PUT', '/v1/stores/x', { name: ' ' })).status, 400);

  // Ya se puede usar en la lista; al borrarla, lo suyo se queda sin tienda
  r = await req('POST', '/v1/list/items', { id: 'st1', name: 'Pan', store: 'lidl-1' });
  assert.equal((await r.json()).item.store, 'lidl-1');
  r = await req('PUT', '/v1/stores/lidl-1', { name: 'Lidl' });
  assert.equal((await r.json()).data.stores.at(-1).name, 'Lidl');
  r = await req('DELETE', '/v1/stores/lidl-1');
  const doc = await r.json();
  assert.equal(doc.data.stores.length, 2);
  assert.equal(doc.data.items.find((x) => x.id === 'st1').store, null);
  r = await req('POST', '/v1/list/items', { id: 'st2', name: 'Leche', store: 'lidl-1' });
  assert.equal((await r.json()).item.store, null);
  assert.equal((await req('DELETE', '/v1/stores/lidl-1')).status, 404);

  // Siempre queda al menos una
  await req('DELETE', '/v1/stores/bonpreu');
  assert.equal((await req('DELETE', '/v1/stores/super')).status, 400);
  await req('PUT', '/v1/stores/bonpreu', { name: 'Bonpreu' });
  await req('DELETE', '/v1/list/items/st1');
  await req('DELETE', '/v1/list/items/st2');
});

test('los errores internos no se cuentan al cliente', { skip }, async () => {
  await sql`alter table grocery_template rename to grocery_template_x`;
  try {
    const r = await req('GET', '/v1/list');
    assert.equal(r.status, 500);
    assert.deepEqual(await r.json(), { error: 'error interno' });
  } finally {
    await sql`alter table grocery_template_x rename to grocery_template`;
  }
});
