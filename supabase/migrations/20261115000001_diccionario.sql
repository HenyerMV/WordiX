-- WordiX · Migración 1 · Categorías y diccionario
-- Se puede ejecutar más de una vez sin duplicar datos.

-- Normalización para búsquedas: minúsculas y sin tildes (la ñ se conserva).
-- Es IMMUTABLE para poder usarla en columnas generadas e índices.
-- Debe coincidir con normalizeForSearch() de src/lib/game/text.ts.
create or replace function public.wordix_normalize(txt text)
returns text
language sql
immutable
parallel safe
as $$
  select translate(lower(trim(txt)), 'áéíóúü', 'aeiouu');
$$;

create table if not exists public.categories (
  id          smallint generated always as identity primary key,
  slug        text not null unique,
  name        text not null,
  sort_order  smallint not null default 0,
  is_active   boolean not null default true,
  created_at  timestamptz not null default now(),
  constraint categories_slug_format check (slug ~ '^[a-z_]+$')
);

-- Para bases creadas con una versión anterior de este script.
alter table public.categories add column if not exists sort_order smallint not null default 0;

create table if not exists public.word_dictionary (
  id               bigint generated always as identity primary key,
  category_id      smallint not null references public.categories(id) on delete cascade,
  word             text not null,  -- forma original, con tildes, para mostrar
  word_normalized  text generated always as (public.wordix_normalize(word)) stored,
  first_letter     text generated always as (left(public.wordix_normalize(word), 1)) stored,
  source           text not null default 'seed',
  created_at       timestamptz not null default now(),
  constraint word_dictionary_source check (source in ('seed', 'wikidata', 'geonames', 'wiktionary', 'vote')),
  constraint word_dictionary_format check (word ~ '^[a-záéíóúüñ]+( [a-záéíóúüñ]+)*$'),
  -- una palabra puede estar en varias categorías, pero una sola vez en cada una
  constraint word_dictionary_unique unique (category_id, word_normalized)
);

create index if not exists word_dictionary_lookup_idx
  on public.word_dictionary (word_normalized, category_id);
create index if not exists word_dictionary_letter_idx
  on public.word_dictionary (category_id, first_letter);

-- Seguridad: lectura para usuarios con sesión, escritura solo desde el servidor
-- (la clave service_role de Supabase ignora RLS, por eso no hay políticas de escritura).
alter table public.categories enable row level security;
alter table public.word_dictionary enable row level security;

drop policy if exists "categories_read" on public.categories;
create policy "categories_read" on public.categories
  for select using (true);

drop policy if exists "word_dictionary_read" on public.word_dictionary;
create policy "word_dictionary_read" on public.word_dictionary
  for select using (true);

revoke insert, update, delete on public.categories from anon, authenticated;
revoke insert, update, delete on public.word_dictionary from anon, authenticated;

-- Categorías del juego. Son las mismas en todas las rondas y se juegan en este
-- orden (sort_order). Para quitar una del juego: update categories set is_active = false.
insert into public.categories (slug, name, sort_order) values
  ('nombre',      'Nombre',            1),
  ('apellido',    'Apellido',          2),
  ('animal',      'Animal',            3),
  ('pais_ciudad', 'País o ciudad',     4),
  ('fruta',       'Fruta',             5),
  ('color',       'Color',             6),
  ('comida',      'Comida',            7),
  ('objeto',      'Objeto',            8),
  ('profesion',   'Profesión',         9),
  ('pelicula',    'Película o serie', 10),
  ('cuerpo',      'Parte del cuerpo', 11),
  ('personaje',   'Personaje',        12),
  ('cancion',     'Canción',          13),
  ('deporte',     'Deporte',          14)
on conflict (slug) do update
  set name = excluded.name,
      sort_order = excluded.sort_order;

-- Migración: si antes existían las categorías separadas 'pais' y 'ciudad',
-- sus palabras se pasan a 'pais_ciudad' y las categorías viejas se eliminan.
-- En una instalación nueva no hace nada.
do $$
declare
  new_id smallint;
begin
  select id into new_id from public.categories where slug = 'pais_ciudad';

  insert into public.word_dictionary (category_id, word, source, created_at)
  select new_id, d.word, d.source, d.created_at
  from public.word_dictionary d
  join public.categories c on c.id = d.category_id
  where c.slug in ('pais', 'ciudad')
  on conflict (category_id, word_normalized) do nothing;

  delete from public.categories where slug in ('pais', 'ciudad');
end $$;
