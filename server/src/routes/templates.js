// Plantillas: listas que se añaden de golpe. Viajan en el documento de la lista (data.templates).
import { Hono } from 'hono';
import { change } from '../db.js';
import { clean, cleanId, LIMITS } from '../validate.js';
import { readJson } from './util.js';

export const templates = new Hono();

templates.put('/templates/:id', async (c) => {
  const b = (await readJson(c)) || {};
  const id = cleanId(c.req.param('id'));
  const name = String(b.name ?? '').trim().slice(0, LIMITS.templateName);
  if (!id) return c.json({ error: 'falta id' }, 400);
  if (!name) return c.json({ error: 'falta name' }, 400);
  const items = (Array.isArray(b.items) ? b.items : []).slice(0, LIMITS.templateItems)
    .map((x) => clean(x, true)).filter((x) => x.name)
    .map(({ name: n, cat, qty, store }) => ({ name: n, cat: cat || 'Otros', qty: qty || 1, store: store || null }));
  return c.json(await change((tx) => tx`
    insert into grocery_template (id, name, items) values (${id}, ${name}, ${tx.json(items)})
    on conflict (id) do update set name = excluded.name, items = excluded.items, updated_at = now()`));
});

templates.delete('/templates/:id', async (c) =>
  c.json(await change((tx) => tx`delete from grocery_template where id = ${cleanId(c.req.param('id'))}`)));
