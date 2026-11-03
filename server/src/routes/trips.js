// Compra finalizada e historial (/trips), con importe y foto del ticket opcionales.
import { Hono } from 'hono';
import { bodyLimit } from 'hono/body-limit';
import { sql, readList, change, insertItems } from '../db.js';
import { clean, cleanId, cleanStore, money, imageType } from '../validate.js';
import { readJson } from './util.js';

export const RECEIPT_MAX_BYTES = 8 * 1024 * 1024;

export const trips = new Hono();

// Lo que está en el carro (de la tienda indicada, o de todas) pasa al historial y sale de la lista.
// Lo que no se encontró se queda. El id lo pone el móvil: si se reenvía tras un corte, no se hace dos veces.
trips.post('/list/finish', async (c) => {
  const b = (await readJson(c)) || {};
  const id = cleanId(b.id), store = cleanStore(b.store), total = money(b.total);
  if (!id) return c.json({ error: 'falta id' }, 400);
  const [dup] = await sql`select 1 from grocery_trip where id = ${id}`;
  if (dup) return c.json(await readList());
  return c.json(await change(async (tx) => {
    const items = store
      ? await tx`select id, name, cat, qty, store, note from grocery_item where done and store = ${store} order by created_at`
      : await tx`select id, name, cat, qty, store, note from grocery_item where done order by created_at`;
    if (!items.length) return;
    await tx`insert into grocery_trip (id, store, items, n, total) values (${id}, ${store}, ${tx.json(items)}, ${items.length}, ${total})`;
    await tx`delete from grocery_item where id = any(${tx.array(items.map((x) => x.id), 25)})`;
  }));
});

// Las estadísticas usan todo el historial: por defecto el último año largo de compras
trips.get('/trips', async (c) => {
  const limit = Math.max(1, Math.min(1000, +c.req.query('limit') || 400));
  return c.json(await sql`
    select t.id, t.store, t.items, t.n, t.total::float8 as total, t.finished_at,
      exists (select 1 from grocery_receipt r where r.trip_id = t.id) as receipt
    from grocery_trip t order by t.finished_at desc limit ${limit}`);
});

// Importe (se puede poner después, en casa con el ticket). null = sin importe.
trips.patch('/trips/:id', async (c) => {
  const b = (await readJson(c)) || {};
  await sql`update grocery_trip set total = ${money(b.total)} where id = ${cleanId(c.req.param('id'))}`;
  return c.json(await readList());
});

// Foto del ticket (multipart, campo "file"). Una por compra: subir otra la sustituye.
// El tipo se saca de los propios bytes, no de lo que diga el cliente.
trips.post('/trips/:id/receipt',
  bodyLimit({ maxSize: RECEIPT_MAX_BYTES, onError: (c) => c.json({ error: 'máximo 8 MB' }, 413) }),
  async (c) => {
    let f;
    try { f = (await c.req.parseBody()).file; } catch { return c.json({ error: 'formulario no válido' }, 400); }
    if (!f || typeof f === 'string') return c.json({ error: 'falta la foto' }, 400);
    const data = Buffer.from(await f.arrayBuffer());
    const mime = imageType(data);
    if (!mime) return c.json({ error: 'solo fotos (JPEG, PNG, WebP o HEIC)' }, 400);
    const [t] = await sql`select id from grocery_trip where id = ${cleanId(c.req.param('id'))}`;
    if (!t) return c.json({ error: 'la compra no existe' }, 404);
    await sql`insert into grocery_receipt (trip_id, mime, data) values (${t.id}, ${mime}, ${data})
      on conflict (trip_id) do update set mime = excluded.mime, data = excluded.data, created_at = now()`;
    return c.json({ ok: true });
  });

trips.get('/trips/:id/receipt', async (c) => {
  const [r] = await sql`select mime, data from grocery_receipt where trip_id = ${cleanId(c.req.param('id'))}`;
  if (!r) return c.json({ error: 'no hay ticket' }, 404);
  return c.body(r.data, 200, {
    'Content-Type': r.mime,
    'Content-Disposition': 'inline; filename="ticket"',
    'Cache-Control': 'private, max-age=86400',
  });
});

trips.delete('/trips/:id/receipt', async (c) => {
  await sql`delete from grocery_receipt where trip_id = ${cleanId(c.req.param('id'))}`;
  return c.json(await readList());
});

// Deshacer: los productos vuelven al carro (tachados) y la compra sale del historial
trips.post('/trips/:id/undo', async (c) => {
  const id = cleanId(c.req.param('id'));
  const [t] = await sql`select items from grocery_trip where id = ${id}`;
  if (!t) return c.json(await readList());
  return c.json(await change(async (tx) => {
    await insertItems(tx, t.items.map((x) => ({ ...clean(x), done: true })));
    await tx`delete from grocery_trip where id = ${id}`;
  }));
});

trips.delete('/trips/:id', async (c) => {
  await sql`delete from grocery_trip where id = ${cleanId(c.req.param('id'))}`;
  return c.json(await readList());
});
