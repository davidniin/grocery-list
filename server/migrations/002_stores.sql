-- Tiendas: cada casa puede añadir las suyas (antes estaban fijas en catalog.js). Si la tabla está vacía, el
-- servidor la rellena al arrancar con las de catalog.js (STORES), con los mismos id que ya usa la lista.
create table if not exists grocery_store (
  id         text primary key,
  name       text not null,
  position   integer not null default 0,
  created_at timestamptz not null default now()
);
