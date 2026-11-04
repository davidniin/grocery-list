// PostgreSQL: la lista (grocery_item), el historial de compras (grocery_trip), lo aprendido para las sugerencias
// (grocery_product) y un número de versión (grocery_state) que sube con cada cambio.
// El esquema está en server/migrations/NNN_nombre.sql y se aplica al arrancar (ver migrate()).
import { readdir, readFile } from 'node:fs/promises';
import postgres from 'postgres';
import { CONFIG } from './config.js';
import { CATALOG, STORES, CATS, CAT_ORDER } from './catalog.js';
import { setStoreIds } from './validate.js';

export const sql = postgres(CONFIG.databaseUrl, { max: 5, onnotice: () => {} });

const MIGRATIONS_DIR = new URL('../migrations/', import.meta.url);

// Aplica, en orden y una sola vez, las migraciones que falten. Cada una en su transacción; un bloqueo evita que
// dos instancias las apliquen a la vez. Reintenta un rato: al arrancar, PostgreSQL puede ir por detrás.
export async function migrate({ retries = 30 } = {}) {
  for (let i = 1; ; i++) {
    try {
      await sql`select 1`;
      break;
    } catch (e) {
      if (i >= retries) throw e;
      console.warn('[db] PostgreSQL no responde (' + e.message + '), reintento en 2 s');
      await new Promise((r) => setTimeout(r, 2000));
    }
  }

  const files = (await readdir(MIGRATIONS_DIR)).filter((f) => /^\d{3}_[\w-]+\.sql$/.test(f)).sort();
  await sql.begin(async (tx) => {
    await tx`select pg_advisory_xact_lock(hashtext('grocery_migrations'))`;
    await tx`create table if not exists schema_migrations (
      version    integer primary key,
      name       text not null,
      applied_at timestamptz not null default now()
    )`;
    const done = new Set((await tx`select version from schema_migrations`).map((r) => r.version));
    for (const f of files) {
      const version = parseInt(f, 10);
      if (done.has(version)) continue;
      await tx.unsafe(await readFile(new URL(f, MIGRATIONS_DIR), 'utf8'));
      await tx`insert into schema_migrations (version, name) values (${version}, ${f})`;
      console.log('[db] migración aplicada: ' + f);
    }
  });

  const [{ n }] = await sql`select count(*)::int as n from grocery_product`;
  if (!n) {
    const rows = CATALOG.map(([name, cat]) => ({ key: name.toLowerCase(), name, cat }));
    await sql`insert into grocery_product ${sql(rows, 'key', 'name', 'cat')} on conflict do nothing`;
  }
  const [{ s }] = await sql`select count(*)::int as s from grocery_store`;
  if (!s) {
    const rows = STORES.map((x, i) => ({ id: x.id, name: x.name, position: i }));
    await sql`insert into grocery_store ${sql(rows, 'id', 'name', 'position')} on conflict do nothing`;
  }
  await loadStores();
}

// ------------------------------------------------------------ tiendas
// Las tiendas, en su orden. De paso actualiza las que acepta la validación (cleanStore).
export async function loadStores(db = sql) {
  const stores = await db`select id, name from grocery_store order by position, created_at, id`;
  setStoreIds(stores.map((x) => x.id));
  return stores;
}

// Orden de los pasillos por tienda: el de catalog.js, y para las tiendas nuevas el normal (el dashboard lo
// necesita para cada tienda)
export function catOrder(stores) {
  return Object.assign({ all: CATS }, ...stores.map((x) => ({ [x.id]: CAT_ORDER[x.id] || CATS })));
}

// ------------------------------------------------------------ lista
const FIELDS = ['name', 'cat', 'qty', 'store', 'done', 'note'];

export async function readList() {
  const [st] = await sql`select version, updated_at from grocery_state where id = 1`;
  const items = await sql`select id, name, cat, qty, store, done, note from grocery_item order by created_at, id`;
  const templates = await sql`select id, name, items from grocery_template order by lower(name), id`;
  const stores = await sql`select id, name from grocery_store order by position, created_at, id`;
  return { version: st.version, updatedAt: st.updated_at, data: { items, templates, stores } };
}

// Aplica un cambio y sube la versión en la misma transacción. Devuelve la lista nueva.
export async function change(fn) {
  let res;
  await sql.begin(async (tx) => {
    res = await fn(tx);
    await tx`update grocery_state set version = version + 1, updated_at = now() where id = 1`;
  });
  return Object.assign(await readList(), res && typeof res === 'object' ? res : {});
}

// Recuerda nombre, categoría y tienda de lo que se añade (para sugerirlo la próxima vez)
export function learn(tx, it) {
  if (!it || !it.name) return;
  return tx`
    insert into grocery_product (key, name, cat, store, uses, last_used)
    values (${it.name.toLowerCase()}, ${it.name}, ${it.cat || 'Otros'}, ${it.store || null}, 1, now())
    on conflict (key) do update set name = excluded.name, cat = excluded.cat,
      store = coalesce(excluded.store, grocery_product.store), uses = grocery_product.uses + 1, last_used = now()`;
}

export function insertItems(tx, items) {
  if (!items.length) return [];
  return tx`
    insert into grocery_item ${tx(items, 'id', ...FIELDS)}
    on conflict (id) do update set name = excluded.name, cat = excluded.cat, qty = excluded.qty,
      store = excluded.store, done = excluded.done, note = excluded.note, updated_at = now()`;
}
