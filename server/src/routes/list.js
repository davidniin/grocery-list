// La lista. El móvil usa las rutas por elemento (dos personas pueden tocarla a la vez); el dashboard usa
// GET/PUT del documento entero { version, data: { items } }.
import { Hono } from 'hono';
import { sql, readList, change, learn, insertItems } from '../db.js';
import { clean, cleanId, cleanStore, LIMITS } from '../validate.js';
import { readJson } from './util.js';

export const list = new Hono();

list.get('/list', async (c) => c.json(await readList()));

// Documento entero (dashboard): lo que no venga se borra, lo que venga se crea o actualiza
list.put('/list', async (c) => {
  const b = await readJson(c);
  if (!b || !b.data || !Array.isArray(b.data.items)) return c.json({ error: 'falta data.items' }, 400);
  if (b.data.items.length > LIMITS.listItems) return c.json({ error: 'demasiados elementos' }, 400);
  const items = b.data.items.map((x) => clean(x)).filter((x) => x.name);
  return c.json(await change(async (tx) => {
    const ids = items.map((x) => x.id);
    const known = new Set((await tx`select id from grocery_item`).map((r) => r.id));
    await tx`delete from grocery_item where not (id = any(${tx.array(ids, 25)}))`;
    await insertItems(tx, items);
    for (const it of items) if (!known.has(it.id)) await learn(tx, it);
  }));
});

// Un elemento (móvil). El id lo pone el cliente: si se reenvía tras un corte de red, no se duplica.
list.post('/list/items', async (c) => {
  const b = await readJson(c);
  if (!b || !String(b.name ?? '').trim()) return c.json({ error: 'falta name' }, 400);
  const it = clean(b);
  return c.json(await change(async (tx) => {
    await insertItems(tx, [it]);
    await learn(tx, it);
    return { item: it };
  }), 201);
});

list.patch('/list/items/:id', async (c) => {
  const id = cleanId(c.req.param('id')), f = clean((await readJson(c)) || {}, true);
  if (!Object.keys(f).length) return c.json({ error: 'nada que cambiar' }, 400);
  if ('name' in f && !f.name) return c.json({ error: 'falta name' }, 400);
  const [cur] = await sql`select id from grocery_item where id = ${id}`;
  if (!cur) return c.json({ error: 'no existe' }, 404);
  return c.json(await change(async (tx) => {
    const [it] = await tx`update grocery_item set ${tx(f)}, updated_at = now() where id = ${id} returning name, cat, store`;
    if ('name' in f || 'cat' in f || 'store' in f) await learn(tx, it);
  }));
});

list.delete('/list/items/:id', async (c) => {
  const id = cleanId(c.req.param('id'));
  const [cur] = await sql`select id from grocery_item where id = ${id}`;
  if (!cur) return c.json({ error: 'no existe' }, 404);
  return c.json(await change((tx) => tx`delete from grocery_item where id = ${id}`));
});

// Vaciar el carro: borra lo tachado (de la tienda indicada, o de todas)
list.post('/list/clear-done', async (c) => {
  const raw = c.req.query('store'), store = cleanStore(raw);
  if (raw && !store) return c.json({ error: 'tienda desconocida' }, 400);
  return c.json(await change((tx) => store
    ? tx`delete from grocery_item where done and store = ${store}`
    : tx`delete from grocery_item where done`));
});
