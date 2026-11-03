-- Esquema inicial. Todo con "if not exists": las bases de datos creadas antes de que hubiera migraciones
-- numeradas ya tienen estas tablas, y esta migración no las toca.

-- La lista
create table if not exists grocery_item (
  id         text primary key,
  name       text not null,
  cat        text not null default 'Otros',
  qty        integer not null default 1,
  store      text,
  done       boolean not null default false,
  note       text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Lo aprendido para las sugerencias
create table if not exists grocery_product (
  key       text primary key,
  name      text not null,
  cat       text not null,
  store     text,
  uses      integer not null default 0,
  last_used timestamptz
);

-- Número de versión que sube con cada cambio: los clientes solo recargan la lista si ha cambiado
create table if not exists grocery_state (
  id         integer primary key default 1 check (id = 1),
  version    integer not null default 0,
  updated_at timestamptz
);
insert into grocery_state (id) values (1) on conflict do nothing;

-- Compras finalizadas: lo que había en el carro al pulsar "Compra finalizada" (historial)
create table if not exists grocery_trip (
  id          text primary key,
  store       text,
  items       jsonb not null,
  n           integer not null,
  finished_at timestamptz not null default now()
);
alter table grocery_trip add column if not exists total numeric(10,2);

-- Foto del ticket de una compra (reducida en el móvil, ~200 KB): en la base de datos, entra en sus copias
create table if not exists grocery_receipt (
  trip_id    text primary key references grocery_trip(id) on delete cascade,
  mime       text not null,
  data       bytea not null,
  created_at timestamptz not null default now()
);

-- Plantillas: listas que se añaden de golpe ("Barbacoa", "Desayunos"...). Van en el documento de la lista.
create table if not exists grocery_template (
  id         text primary key,
  name       text not null,
  items      jsonb not null default '[]',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
