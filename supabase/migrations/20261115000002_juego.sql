-- WordiX · Migración 2 · Esquema del juego, seguridad (RLS) y funciones de sala
-- Requiere la migración 1. Requiere "Anonymous sign-ins" activado en Supabase Auth.
--
-- Principio: el navegador NUNCA escribe directamente en estas tablas. Solo puede
-- leer lo de su sala (políticas RLS) y llamar a funciones SQL que validan las reglas.

-- ═══════════════════════════════════════════════════════════════════════════
-- 1. TABLAS
-- ═══════════════════════════════════════════════════════════════════════════

-- Un jugador por usuario anónimo de Supabase Auth.
create table if not exists public.players (
  id          uuid primary key references auth.users (id) on delete cascade,
  username    text not null,
  created_at  timestamptz not null default now(),
  constraint players_username_format
    check (username ~ '^[a-záéíóúüñ]+( [a-záéíóúüñ]+)*$' and char_length(username) between 2 and 16)
);

-- Sala: se entra con un código de 6 números.
create table if not exists public.rooms (
  id           uuid primary key default gen_random_uuid(),
  code         text not null unique,
  host_id      uuid not null references public.players (id) on delete cascade,
  status       text not null default 'waiting',
  max_players  smallint not null default 4,
  created_at   timestamptz not null default now(),
  constraint rooms_code_format check (code ~ '^[0-9]{6}$'),
  constraint rooms_status check (status in ('waiting', 'playing', 'finished')),
  constraint rooms_max_players check (max_players between 2 and 4)
);

-- Jugadores sentados en la sala. "seat" define el orden fijo del jugador mano.
create table if not exists public.room_players (
  room_id    uuid not null references public.rooms (id) on delete cascade,
  player_id  uuid not null references public.players (id) on delete cascade,
  seat       smallint not null,
  joined_at  timestamptz not null default now(),
  primary key (room_id, player_id),
  constraint room_players_seat check (seat between 1 and 4),
  constraint room_players_seat_unique unique (room_id, seat)
);
create index if not exists room_players_player_idx on public.room_players (player_id);

-- Partida de una sala.
create table if not exists public.games (
  id           uuid primary key default gen_random_uuid(),
  room_id      uuid not null references public.rooms (id) on delete cascade,
  status       text not null default 'in_progress',
  created_at   timestamptz not null default now(),
  finished_at  timestamptz,
  constraint games_status check (status in ('in_progress', 'finished'))
);
create index if not exists games_room_idx on public.games (room_id);

-- Categorías de la partida: copia de las categorías activas al empezar, en orden,
-- para que un cambio posterior en "categories" no altere una partida en curso.
create table if not exists public.game_categories (
  game_id      uuid not null references public.games (id) on delete cascade,
  category_id  smallint not null references public.categories (id),
  position     smallint not null,
  primary key (game_id, category_id),
  constraint game_categories_position_unique unique (game_id, position)
);

-- Ronda: una letra y un jugador mano.
create table if not exists public.rounds (
  id                uuid primary key default gen_random_uuid(),
  game_id           uuid not null references public.games (id) on delete cascade,
  number            smallint not null,
  hand_player_id    uuid not null references public.players (id),
  letter            text,
  status            text not null default 'spinning',
  stopped_by        uuid references public.players (id),
  -- Reloj oficial: los plazos se calculan en el servidor a partir de esta marca.
  phase_started_at  timestamptz not null default now(),
  created_at        timestamptz not null default now(),
  constraint rounds_number check (number >= 1),
  constraint rounds_status check (status in
    ('spinning', 'letter_vote', 'answering', 'reviewing', 'finished', 'letter_rejected')),
  constraint rounds_letter check (letter is null or letter ~ '^[a-zñ]$'),
  constraint rounds_number_unique unique (game_id, number)
);

-- Regla del jugador mano: nadie es mano dos rondas seguidas.
create or replace function public.rounds_check_hand()
returns trigger
language plpgsql
as $$
declare
  v_previous uuid;
begin
  select hand_player_id into v_previous
  from public.rounds
  where game_id = new.game_id and number = new.number - 1;

  if v_previous is not null and v_previous = new.hand_player_id then
    raise exception 'HAND_REPEATED';
  end if;
  return new;
end;
$$;

drop trigger if exists rounds_hand_not_repeated on public.rounds;
create trigger rounds_hand_not_repeated
  before insert on public.rounds
  for each row execute function public.rounds_check_hand();

-- Votación de la letra (sí / no). Un voto por jugador y ronda.
create table if not exists public.letter_votes (
  round_id   uuid not null references public.rounds (id) on delete cascade,
  player_id  uuid not null references public.players (id) on delete cascade,
  accept     boolean not null,
  voted_at   timestamptz not null default now(),
  primary key (round_id, player_id)
);

-- Respuestas de los jugadores: aquí se guardan las palabras que escribe cada
-- jugador en cada categoría de cada ronda.
create table if not exists public.game_answers (
  id            uuid primary key default gen_random_uuid(),
  round_id      uuid not null references public.rounds (id) on delete cascade,
  player_id     uuid not null references public.players (id) on delete cascade,
  category_id   smallint not null references public.categories (id),
  answer        text,
  status        text not null default 'pending',
  decided_by    text,
  points        smallint not null default 0,
  answered_at   timestamptz,
  constraint game_answers_unique unique (round_id, player_id, category_id),
  constraint game_answers_format
    check (answer is null or answer ~ '^[a-záéíóúüñ]+( [a-záéíóúüñ]+)*$'),
  constraint game_answers_status check (status in ('pending', 'accepted', 'rejected', 'in_review')),
  constraint game_answers_decided_by check (decided_by is null or decided_by in
    ('format', 'letter', 'dictionary', 'wikidata', 'wiktionary', 'vote')),
  constraint game_answers_points check (points between 0 and 100)
);
create index if not exists game_answers_round_idx on public.game_answers (round_id);

-- Revisión grupal de una respuesta que no se pudo comprobar sola.
create table if not exists public.word_reviews (
  id           uuid primary key default gen_random_uuid(),
  answer_id    uuid not null unique references public.game_answers (id) on delete cascade,
  status       text not null default 'open',
  created_at   timestamptz not null default now(),
  resolved_at  timestamptz,
  constraint word_reviews_status check (status in ('open', 'accepted', 'rejected'))
);

-- Votos de la revisión. Un voto por jugador; el autor no puede votar.
create table if not exists public.word_votes (
  review_id  uuid not null references public.word_reviews (id) on delete cascade,
  voter_id   uuid not null references public.players (id) on delete cascade,
  approve    boolean not null,
  voted_at   timestamptz not null default now(),
  primary key (review_id, voter_id)
);

create or replace function public.word_votes_check_author()
returns trigger
language plpgsql
as $$
declare
  v_author uuid;
begin
  select a.player_id into v_author
  from public.word_reviews r
  join public.game_answers a on a.id = r.answer_id
  where r.id = new.review_id;

  if v_author is not null and v_author = new.voter_id then
    raise exception 'AUTHOR_CANNOT_VOTE';
  end if;
  return new;
end;
$$;

drop trigger if exists word_votes_author_cannot_vote on public.word_votes;
create trigger word_votes_author_cannot_vote
  before insert on public.word_votes
  for each row execute function public.word_votes_check_author();

-- Resultado final de cada jugador en la partida.
create table if not exists public.game_results (
  game_id       uuid not null references public.games (id) on delete cascade,
  player_id     uuid not null references public.players (id) on delete cascade,
  total_points  integer not null default 0,
  position      smallint,
  primary key (game_id, player_id)
);

-- ═══════════════════════════════════════════════════════════════════════════
-- 2. FUNCIONES AUXILIARES PARA RLS (security definer: evitan recursión de políticas)
-- ═══════════════════════════════════════════════════════════════════════════

create or replace function public.is_room_member(p_room uuid)
returns boolean
language sql stable security definer set search_path = public
as $$
  select exists (
    select 1 from public.room_players
    where room_id = p_room and player_id = auth.uid()
  );
$$;

create or replace function public.shares_room_with(p_player uuid)
returns boolean
language sql stable security definer set search_path = public
as $$
  select exists (
    select 1
    from public.room_players mine
    join public.room_players other on other.room_id = mine.room_id
    where mine.player_id = auth.uid() and other.player_id = p_player
  );
$$;

create or replace function public.room_of_game(p_game uuid)
returns uuid
language sql stable security definer set search_path = public
as $$
  select room_id from public.games where id = p_game;
$$;

create or replace function public.room_of_round(p_round uuid)
returns uuid
language sql stable security definer set search_path = public
as $$
  select g.room_id
  from public.rounds r
  join public.games g on g.id = r.game_id
  where r.id = p_round;
$$;

create or replace function public.round_status(p_round uuid)
returns text
language sql stable security definer set search_path = public
as $$
  select status from public.rounds where id = p_round;
$$;

create or replace function public.room_of_answer(p_answer uuid)
returns uuid
language sql stable security definer set search_path = public
as $$
  select public.room_of_round(round_id) from public.game_answers where id = p_answer;
$$;

create or replace function public.room_of_review(p_review uuid)
returns uuid
language sql stable security definer set search_path = public
as $$
  select public.room_of_answer(answer_id) from public.word_reviews where id = p_review;
$$;

-- ═══════════════════════════════════════════════════════════════════════════
-- 3. SEGURIDAD (RLS): solo lectura para los miembros de la sala
-- ═══════════════════════════════════════════════════════════════════════════

alter table public.players         enable row level security;
alter table public.rooms           enable row level security;
alter table public.room_players    enable row level security;
alter table public.games           enable row level security;
alter table public.game_categories enable row level security;
alter table public.rounds          enable row level security;
alter table public.letter_votes    enable row level security;
alter table public.game_answers    enable row level security;
alter table public.word_reviews    enable row level security;
alter table public.word_votes      enable row level security;
alter table public.game_results    enable row level security;

drop policy if exists "players_read" on public.players;
create policy "players_read" on public.players
  for select to authenticated
  using (id = auth.uid() or public.shares_room_with(id));

drop policy if exists "rooms_read" on public.rooms;
create policy "rooms_read" on public.rooms
  for select to authenticated
  using (public.is_room_member(id));

drop policy if exists "room_players_read" on public.room_players;
create policy "room_players_read" on public.room_players
  for select to authenticated
  using (public.is_room_member(room_id));

drop policy if exists "games_read" on public.games;
create policy "games_read" on public.games
  for select to authenticated
  using (public.is_room_member(room_id));

drop policy if exists "game_categories_read" on public.game_categories;
create policy "game_categories_read" on public.game_categories
  for select to authenticated
  using (public.is_room_member(public.room_of_game(game_id)));

drop policy if exists "rounds_read" on public.rounds;
create policy "rounds_read" on public.rounds
  for select to authenticated
  using (public.is_room_member(public.room_of_game(game_id)));

drop policy if exists "letter_votes_read" on public.letter_votes;
create policy "letter_votes_read" on public.letter_votes
  for select to authenticated
  using (public.is_room_member(public.room_of_round(round_id)));

-- Las respuestas de los demás NO se ven mientras se está escribiendo:
-- solo las propias, o todas cuando la ronda pasa a revisión o termina.
drop policy if exists "game_answers_read" on public.game_answers;
create policy "game_answers_read" on public.game_answers
  for select to authenticated
  using (
    player_id = auth.uid()
    or (
      public.is_room_member(public.room_of_round(round_id))
      and public.round_status(round_id) in ('reviewing', 'finished')
    )
  );

drop policy if exists "word_reviews_read" on public.word_reviews;
create policy "word_reviews_read" on public.word_reviews
  for select to authenticated
  using (public.is_room_member(public.room_of_answer(answer_id)));

drop policy if exists "word_votes_read" on public.word_votes;
create policy "word_votes_read" on public.word_votes
  for select to authenticated
  using (public.is_room_member(public.room_of_review(review_id)));

drop policy if exists "game_results_read" on public.game_results;
create policy "game_results_read" on public.game_results
  for select to authenticated
  using (public.is_room_member(public.room_of_game(game_id)));

-- Sin acceso para usuarios no autenticados y sin escritura directa para nadie
-- (las escrituras van por funciones security definer o por la service_role).
revoke all on public.players, public.rooms, public.room_players, public.games,
  public.game_categories, public.rounds, public.letter_votes, public.game_answers,
  public.word_reviews, public.word_votes, public.game_results
  from anon;
revoke insert, update, delete on public.players, public.rooms, public.room_players,
  public.games, public.game_categories, public.rounds, public.letter_votes,
  public.game_answers, public.word_reviews, public.word_votes, public.game_results
  from authenticated;

-- ═══════════════════════════════════════════════════════════════════════════
-- 4. FUNCIONES DE SALA (llamadas desde el navegador con supabase.rpc)
-- ═══════════════════════════════════════════════════════════════════════════

-- Crea o actualiza el perfil del jugador con su nombre.
create or replace function public.ensure_player(p_username text)
returns public.players
language plpgsql security definer set search_path = public
as $$
declare
  v_uid    uuid := auth.uid();
  v_clean  text;
  v_player public.players;
begin
  if v_uid is null then
    raise exception 'NOT_AUTHENTICATED';
  end if;

  v_clean := regexp_replace(lower(trim(coalesce(p_username, ''))), '\s+', ' ', 'g');
  if v_clean !~ '^[a-záéíóúüñ]+( [a-záéíóúüñ]+)*$'
     or char_length(v_clean) not between 2 and 16 then
    raise exception 'INVALID_NAME';
  end if;

  insert into public.players (id, username)
  values (v_uid, v_clean)
  on conflict (id) do update set username = excluded.username
  returning * into v_player;

  return v_player;
end;
$$;

-- Código de sala de 6 números (100000 a 999999) que no esté en uso.
create or replace function public.generate_room_code()
returns text
language plpgsql volatile set search_path = public
as $$
declare
  v_code  text;
  v_tries int := 0;
begin
  loop
    v_code := (floor(random() * 900000) + 100000)::int::text;
    exit when not exists (select 1 from public.rooms where code = v_code);
    v_tries := v_tries + 1;
    if v_tries >= 25 then
      raise exception 'CODE_GENERATION_FAILED';
    end if;
  end loop;
  return v_code;
end;
$$;

-- Saca a un jugador de una sala en espera. Si se va el anfitrión, pasa al
-- jugador con el asiento más bajo; si la sala queda vacía, se elimina.
-- Si la partida ya comenzó no hace nada: el jugador conserva su sitio para
-- poder reconectarse.
create or replace function public.leave_room_internal(p_uid uuid, p_room uuid)
returns void
language plpgsql security definer set search_path = public
as $$
declare
  v_room public.rooms;
  v_next uuid;
begin
  select * into v_room from public.rooms where id = p_room for update;
  if not found or v_room.status <> 'waiting' then
    return;
  end if;

  delete from public.room_players where room_id = p_room and player_id = p_uid;
  if not found then
    return;
  end if;

  select player_id into v_next
  from public.room_players
  where room_id = p_room
  order by seat
  limit 1;

  if v_next is null then
    delete from public.rooms where id = p_room;
  elsif v_room.host_id = p_uid then
    update public.rooms set host_id = v_next where id = p_room;
  end if;
end;
$$;

-- Un jugador solo puede estar en una sala en espera a la vez.
create or replace function public.leave_other_waiting_rooms(p_uid uuid, p_keep uuid)
returns void
language plpgsql security definer set search_path = public
as $$
declare
  v_other record;
begin
  for v_other in
    select rp.room_id
    from public.room_players rp
    join public.rooms r on r.id = rp.room_id
    where rp.player_id = p_uid
      and r.status = 'waiting'
      and r.id is distinct from p_keep
  loop
    perform public.leave_room_internal(p_uid, v_other.room_id);
  end loop;
end;
$$;

create or replace function public.create_room()
returns public.rooms
language plpgsql security definer set search_path = public
as $$
declare
  v_uid  uuid := auth.uid();
  v_room public.rooms;
begin
  if v_uid is null then
    raise exception 'NOT_AUTHENTICATED';
  end if;
  if not exists (select 1 from public.players where id = v_uid) then
    raise exception 'NO_PLAYER';
  end if;

  perform public.leave_other_waiting_rooms(v_uid, null);

  insert into public.rooms (code, host_id)
  values (public.generate_room_code(), v_uid)
  returning * into v_room;

  -- El creador ocupa el asiento 1 y es el primer jugador mano.
  insert into public.room_players (room_id, player_id, seat)
  values (v_room.id, v_uid, 1);

  return v_room;
end;
$$;

-- Entra a una sala por código. Es idempotente: si ya eres miembro (por ejemplo
-- al recargar la página o reconectarte) devuelve la sala sin cambiar nada.
create or replace function public.join_room(p_code text)
returns public.rooms
language plpgsql security definer set search_path = public
as $$
declare
  v_uid   uuid := auth.uid();
  v_room  public.rooms;
  v_count int;
  v_seat  smallint;
begin
  if v_uid is null then
    raise exception 'NOT_AUTHENTICATED';
  end if;
  if not exists (select 1 from public.players where id = v_uid) then
    raise exception 'NO_PLAYER';
  end if;
  if p_code is null or p_code !~ '^[0-9]{6}$' then
    raise exception 'INVALID_CODE';
  end if;

  select * into v_room from public.rooms where code = p_code for update;
  if not found then
    raise exception 'ROOM_NOT_FOUND';
  end if;

  if exists (
    select 1 from public.room_players
    where room_id = v_room.id and player_id = v_uid
  ) then
    return v_room;
  end if;

  if v_room.status <> 'waiting' then
    raise exception 'ROOM_STARTED';
  end if;

  select count(*) into v_count from public.room_players where room_id = v_room.id;
  if v_count >= v_room.max_players then
    raise exception 'ROOM_FULL';
  end if;

  perform public.leave_other_waiting_rooms(v_uid, v_room.id);

  select min(s) into v_seat
  from generate_series(1, v_room.max_players) as s
  where s not in (select seat from public.room_players where room_id = v_room.id);

  insert into public.room_players (room_id, player_id, seat)
  values (v_room.id, v_uid, v_seat);

  return v_room;
end;
$$;

create or replace function public.leave_room(p_room uuid)
returns void
language plpgsql security definer set search_path = public
as $$
begin
  if auth.uid() is null then
    raise exception 'NOT_AUTHENTICATED';
  end if;
  perform public.leave_room_internal(auth.uid(), p_room);
end;
$$;

-- Permisos de ejecución: solo las funciones de sala son públicas para usuarios
-- con sesión; las internas no se pueden llamar desde el navegador.
revoke all on function public.generate_room_code() from public, anon, authenticated;
revoke all on function public.leave_room_internal(uuid, uuid) from public, anon, authenticated;
revoke all on function public.leave_other_waiting_rooms(uuid, uuid) from public, anon, authenticated;

revoke all on function public.ensure_player(text) from public, anon;
revoke all on function public.create_room() from public, anon;
revoke all on function public.join_room(text) from public, anon;
revoke all on function public.leave_room(uuid) from public, anon;
grant execute on function public.ensure_player(text) to authenticated;
grant execute on function public.create_room() to authenticated;
grant execute on function public.join_room(text) to authenticated;
grant execute on function public.leave_room(uuid) to authenticated;

-- ═══════════════════════════════════════════════════════════════════════════
-- 5. TIEMPO REAL
-- ═══════════════════════════════════════════════════════════════════════════

do $$
declare
  t text;
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    foreach t in array array[
      'rooms', 'room_players', 'games', 'rounds', 'letter_votes',
      'game_answers', 'word_reviews', 'word_votes', 'game_results'
    ] loop
      if not exists (
        select 1 from pg_publication_tables
        where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = t
      ) then
        execute format('alter publication supabase_realtime add table public.%I', t);
      end if;
    end loop;
  end if;
end $$;
