// Tiendas: crear, renombrar y borrar. El id lo pone el cliente (como en las plantillas): si se reenvía tras un
// corte de red, no se duplica. Viajan en el documento de la lista (data.stores) y en /v1/meta.
import { Hono } from 'hono';
import { change, loadStores } from '../db.js';
import { cleanId, cleanStoreName, LIMITS } from '../validate.js';
import { readJson } from './util.js';

export const stores = new Hono();

const ID = /^[a-z0-9][a-z0-9_-]*$/;

stores.put('/stores/:id', async (c) => {
  const id = cleanId(c.req.param('id')).toLowerCase();
  const name = cleanStoreName(((await readJson(c)) || {}).name);
  if (!ID.test(id)) return c.json({ error: 'id no válido' }, 400);
  if (!name) return c.json({ error: 'falta name' }, 400);
  const all = await loadStores();
  if (all.some((s) => s.id !== id && s.name.toLowerCase() === name.toLowerCase())) return c.json({ error: 'ya existe una tienda con ese nombre' }, 409);
  if (!all.some((s) => s.id === id) && all.length >= LIMITS.stores) return c.json({ error: 'demasiadas tiendas' }, 400);
  const res = await change((tx) => tx`
    insert into grocery_store (id, name, position)
    values (${id}, ${name}, (select coalesce(max(position) + 1, 0) from grocery_store))
    on conflict (id) do update set name = excluded.name`);
  await loadStores();
  return c.json(res);
});

// Lo que estaba en esa tienda se queda en la lista, sin tienda (sale en "Todas"). Siempre queda al menos una.
stores.delete('/stores/:id', async (c) => {
  const id = cleanId(c.req.param('id'));
  const all = await loadStores();
  if (!all.some((s) => s.id === id)) return c.json({ error: 'no existe' }, 404);
  if (all.length === 1) return c.json({ error: 'tiene que quedar al menos una tienda' }, 400);
  const res = await change(async (tx) => {
    await tx`update grocery_item set store = null, updated_at = now() where store = ${id}`;
    await tx`update grocery_product set store = null where store = ${id}`;
    await tx`delete from grocery_store where id = ${id}`;
  });
  await loadStores();
  return c.json(res);
});
