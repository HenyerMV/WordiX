-- WordiX · Migración 4 · Etapa 6: categoría por categoría, 20 s, saltar, pendientes y STOP
-- Requiere las migraciones 1, 2 y 3. Se puede ejecutar más de una vez.
--
-- Reglas que aplica el servidor (el navegador no puede saltárselas):
--  * Cada jugador avanza a su ritmo: ve UNA categoría a la vez.
--  * Cada categoría dura 20 s, contados con el reloj del servidor desde que se abre.
--    Puede enviar la respuesta o saltarla antes. Si se acaba el tiempo, se avanza.
--  * Al final de la lista se repiten solo las categorías pendientes (sin respuesta válida).
--  * Si queda UNA sola pendiente, ya no hay límite de tiempo.
--  * Cuando un jugador completa todas sus categorías puede dar STOP: la fase de
--    respuestas termina de inmediato para todos.
--  * También se puede terminar la ronda por acuerdo de TODOS los jugadores.
--
-- Tiempos (deben coincidir con src/lib/game/rules.ts): 20 s por categoría, 2 s de margen.

-- Limpieza de la primera versión de esta etapa (si se llegó a ejecutar).
drop function if exists public.save_answers(uuid, jsonb);
drop function if exists public.press_stop(uuid, jsonb);
drop function if exists public.finish_answering(uuid);
drop function if exists public.save_answers_internal(uuid, public.rounds, jsonb);
alter table public.rounds drop column if exists stopped_at;

-- Dónde va cada jugador en la ronda: categoría actual y desde cuándo está abierta.
create table if not exists public.answer_progress (
  round_id     uuid not null references public.rounds (id) on delete cascade,
  player_id    uuid not null references public.players (id) on delete cascade,
  category_id  smallint references public.categories (id),  -- null cuando ya terminó
  opened_at    timestamptz not null default now(),
  pass         smallint not null default 1,                 -- 1 = primera vuelta, 2+ = pendientes
  finished     boolean not null default false,
  primary key (round_id, player_id)
);

-- Votos para terminar la ronda manualmente (hace falta que voten todos).
create table if not exists public.round_end_votes (
  round_id   uuid not null references public.rounds (id) on delete cascade,
  player_id  uuid not null references public.players (id) on delete cascade,
  voted_at   timestamptz not null default now(),
  primary key (round_id, player_id)
);

alter table public.answer_progress  enable row level security;
alter table public.round_end_votes  enable row level security;

drop policy if exists "answer_progress_read" on public.answer_progress;
create policy "answer_progress_read" on public.answer_progress
  for select to authenticated
  using (public.is_room_member(public.room_of_round(round_id)));

drop policy if exists "round_end_votes_read" on public.round_end_votes;
create policy "round_end_votes_read" on public.round_end_votes
  for select to authenticated
  using (public.is_room_member(public.room_of_round(round_id)));

revoke all on public.answer_progress, public.round_end_votes from anon;
revoke insert, update, delete on public.answer_progress, public.round_end_votes from authenticated;

do $$
declare
  t text;
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    foreach t in array array['answer_progress', 'round_end_votes'] loop
      if not exists (
        select 1 from pg_publication_tables
        where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = t
      ) then
        execute format('alter publication supabase_realtime add table public.%I', t);
      end if;
    end loop;
  end if;
end $$;

-- Categorías de la partida sin respuesta válida para un jugador.
create or replace function public.pending_count_internal(p_round uuid, p_uid uuid)
returns int
language sql stable security definer set search_path = public
as $$
  select count(*)::int
  from public.game_categories gc
  join public.rounds r on r.game_id = gc.game_id
  where r.id = p_round
    and not exists (
      select 1 from public.game_answers a
      where a.round_id = p_round and a.player_id = p_uid
        and a.category_id = gc.category_id
        and a.answer is not null and a.status <> 'rejected'
    );
$$;

-- Pasa al jugador a la siguiente categoría pendiente (o lo marca como terminado).
create or replace function public.advance_internal(p_round uuid, p_uid uuid)
returns public.answer_progress
language plpgsql security definer set search_path = public
as $$
declare
  v_prog    public.answer_progress;
  v_game    uuid;
  v_pos     smallint;
  v_next    smallint;
  v_wrapped boolean := false;
begin
  select * into v_prog
  from public.answer_progress
  where round_id = p_round and player_id = p_uid
  for update;

  select game_id into v_game from public.rounds where id = p_round;

  select position into v_pos
  from public.game_categories
  where game_id = v_game and category_id = v_prog.category_id;

  select gc.category_id into v_next
  from public.game_categories gc
  where gc.game_id = v_game
    and gc.position > coalesce(v_pos, 0)
    and not exists (
      select 1 from public.game_answers a
      where a.round_id = p_round and a.player_id = p_uid
        and a.category_id = gc.category_id
        and a.answer is not null and a.status <> 'rejected'
    )
  order by gc.position
  limit 1;

  if v_next is null then
    select gc.category_id into v_next
    from public.game_categories gc
    where gc.game_id = v_game
      and not exists (
        select 1 from public.game_answers a
        where a.round_id = p_round and a.player_id = p_uid
          and a.category_id = gc.category_id
          and a.answer is not null and a.status <> 'rejected'
      )
    order by gc.position
    limit 1;
    v_wrapped := v_next is not null;
  end if;

  update public.answer_progress
  set category_id = v_next,
      finished    = (v_next is null),
      opened_at   = now(),
      pass        = pass + (case when v_wrapped then 1 else 0 end)
  where round_id = p_round and player_id = p_uid
  returning * into v_prog;

  return v_prog;
end;
$$;

-- Verifica la ronda y devuelve el progreso del jugador (con la categoría pedida).
create or replace function public.check_turn_internal(
  p_round uuid, p_uid uuid, p_category smallint
)
returns public.answer_progress
language plpgsql security definer set search_path = public
as $$
declare
  v_round public.rounds;
  v_prog  public.answer_progress;
begin
  select * into v_round from public.rounds where id = p_round for share;
  if not found then
    raise exception 'ROUND_NOT_FOUND';
  end if;
  if not public.is_room_member(public.room_of_game(v_round.game_id)) then
    raise exception 'NOT_MEMBER';
  end if;
  if v_round.status <> 'answering' then
    raise exception 'WRONG_PHASE';
  end if;

  select * into v_prog
  from public.answer_progress
  where round_id = p_round and player_id = p_uid
  for update;
  if not found or v_prog.finished or v_prog.category_id is distinct from p_category then
    raise exception 'NOT_CURRENT_CATEGORY';
  end if;

  return v_prog;
end;
$$;

-- El jugador entra a la fase de respuestas: se crea su progreso con la primera categoría.
create or replace function public.start_my_turn(p_round uuid)
returns public.answer_progress
language plpgsql security definer set search_path = public
as $$
declare
  v_uid   uuid := auth.uid();
  v_round public.rounds;
  v_prog  public.answer_progress;
begin
  if v_uid is null then
    raise exception 'NOT_AUTHENTICATED';
  end if;

  select * into v_round from public.rounds where id = p_round for share;
  if not found then
    raise exception 'ROUND_NOT_FOUND';
  end if;
  if not public.is_room_member(public.room_of_game(v_round.game_id)) then
    raise exception 'NOT_MEMBER';
  end if;
  if v_round.status <> 'answering' then
    raise exception 'WRONG_PHASE';
  end if;

  insert into public.answer_progress (round_id, player_id, category_id, opened_at)
  select p_round, v_uid, gc.category_id, v_round.phase_started_at
  from public.game_categories gc
  where gc.game_id = v_round.game_id
  order by gc.position
  limit 1
  on conflict (round_id, player_id) do nothing;

  select * into v_prog
  from public.answer_progress
  where round_id = p_round and player_id = v_uid;

  return v_prog;
end;
$$;

-- Envía la respuesta de la categoría actual y avanza.
create or replace function public.submit_answer(p_round uuid, p_category smallint, p_answer text)
returns public.answer_progress
language plpgsql security definer set search_path = public
as $$
declare
  v_uid     uuid := auth.uid();
  v_prog    public.answer_progress;
  v_letter  text;
  v_clean   text;
  v_limited boolean;
begin
  if v_uid is null then
    raise exception 'NOT_AUTHENTICATED';
  end if;

  v_prog := public.check_turn_internal(p_round, v_uid, p_category);
  v_limited := public.pending_count_internal(p_round, v_uid) > 1;

  if v_limited and now() > v_prog.opened_at + interval '22 seconds' then
    raise exception 'TIME_UP';
  end if;

  v_clean := regexp_replace(lower(trim(coalesce(p_answer, ''))), '\s+', ' ', 'g');
  if v_clean = ''
     or char_length(v_clean) > 60
     or v_clean !~ '^[a-záéíóúüñ]+( [a-záéíóúüñ]+)*$' then
    raise exception 'INVALID_ANSWER';
  end if;

  select letter into v_letter from public.rounds where id = p_round;
  if left(public.wordix_normalize(v_clean), 1) <> v_letter then
    raise exception 'WRONG_LETTER';
  end if;

  insert into public.game_answers (round_id, player_id, category_id, answer, status, decided_by, answered_at)
  values (p_round, v_uid, p_category, v_clean, 'pending', null, now())
  on conflict (round_id, player_id, category_id) do update
    set answer = excluded.answer, status = 'pending', decided_by = null, answered_at = now();

  return public.advance_internal(p_round, v_uid);
end;
$$;

-- Salta la categoría actual (queda pendiente para la siguiente vuelta).
create or replace function public.skip_category(p_round uuid, p_category smallint)
returns public.answer_progress
language plpgsql security definer set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
begin
  if v_uid is null then
    raise exception 'NOT_AUTHENTICATED';
  end if;
  perform public.check_turn_internal(p_round, v_uid, p_category);
  return public.advance_internal(p_round, v_uid);
end;
$$;

-- Avanza cuando se acabaron los 20 s (solo si hay límite de tiempo).
create or replace function public.expire_category(p_round uuid, p_category smallint)
returns public.answer_progress
language plpgsql security definer set search_path = public
as $$
declare
  v_uid  uuid := auth.uid();
  v_prog public.answer_progress;
begin
  if v_uid is null then
    raise exception 'NOT_AUTHENTICATED';
  end if;
  v_prog := public.check_turn_internal(p_round, v_uid, p_category);

  if public.pending_count_internal(p_round, v_uid) <= 1
     or now() < v_prog.opened_at + interval '20 seconds' then
    raise exception 'TIME_NOT_UP';
  end if;

  return public.advance_internal(p_round, v_uid);
end;
$$;

-- STOP: solo si el jugador completó todas sus categorías. Termina la fase para todos.
create or replace function public.press_stop(p_round uuid)
returns public.rounds
language plpgsql security definer set search_path = public
as $$
declare
  v_uid   uuid := auth.uid();
  v_round public.rounds;
  v_prog  public.answer_progress;
begin
  if v_uid is null then
    raise exception 'NOT_AUTHENTICATED';
  end if;

  select * into v_round from public.rounds where id = p_round for update;
  if not found then
    raise exception 'ROUND_NOT_FOUND';
  end if;
  if not public.is_room_member(public.room_of_game(v_round.game_id)) then
    raise exception 'NOT_MEMBER';
  end if;
  if v_round.status <> 'answering' then
    raise exception 'WRONG_PHASE';
  end if;

  select * into v_prog
  from public.answer_progress
  where round_id = p_round and player_id = v_uid;
  if not found or not v_prog.finished or public.pending_count_internal(p_round, v_uid) > 0 then
    raise exception 'INCOMPLETE_ANSWERS';
  end if;

  update public.rounds
  set status = 'reviewing', stopped_by = v_uid, phase_started_at = now()
  where id = p_round
  returning * into v_round;

  return v_round;
end;
$$;

-- Terminar la ronda por acuerdo: cada jugador activa o retira su voto; cuando
-- votan todos, la fase de respuestas termina para todos.
create or replace function public.vote_end_round(p_round uuid, p_want boolean)
returns public.rounds
language plpgsql security definer set search_path = public
as $$
declare
  v_uid     uuid := auth.uid();
  v_round   public.rounds;
  v_room    uuid;
  v_members int;
  v_votes   int;
begin
  if v_uid is null then
    raise exception 'NOT_AUTHENTICATED';
  end if;
  if p_want is null then
    raise exception 'INVALID_VOTE';
  end if;

  select * into v_round from public.rounds where id = p_round for update;
  if not found then
    raise exception 'ROUND_NOT_FOUND';
  end if;
  v_room := public.room_of_game(v_round.game_id);
  if not public.is_room_member(v_room) then
    raise exception 'NOT_MEMBER';
  end if;
  if v_round.status <> 'answering' then
    raise exception 'WRONG_PHASE';
  end if;

  if p_want then
    insert into public.round_end_votes (round_id, player_id)
    values (p_round, v_uid)
    on conflict (round_id, player_id) do nothing;
  else
    delete from public.round_end_votes where round_id = p_round and player_id = v_uid;
  end if;

  select count(*) into v_members from public.room_players where room_id = v_room;
  select count(*) into v_votes
  from public.round_end_votes ev
  join public.room_players rp on rp.room_id = v_room and rp.player_id = ev.player_id
  where ev.round_id = p_round;

  if v_votes >= v_members then
    update public.rounds
    set status = 'reviewing', stopped_by = null, phase_started_at = now()
    where id = p_round
    returning * into v_round;
  end if;

  return v_round;
end;
$$;

revoke all on function public.pending_count_internal(uuid, uuid) from public, anon, authenticated;
revoke all on function public.advance_internal(uuid, uuid) from public, anon, authenticated;
revoke all on function public.check_turn_internal(uuid, uuid, smallint) from public, anon, authenticated;

revoke all on function public.start_my_turn(uuid) from public, anon;
revoke all on function public.submit_answer(uuid, smallint, text) from public, anon;
revoke all on function public.skip_category(uuid, smallint) from public, anon;
revoke all on function public.expire_category(uuid, smallint) from public, anon;
revoke all on function public.press_stop(uuid) from public, anon;
revoke all on function public.vote_end_round(uuid, boolean) from public, anon;
grant execute on function public.start_my_turn(uuid) to authenticated;
grant execute on function public.submit_answer(uuid, smallint, text) to authenticated;
grant execute on function public.skip_category(uuid, smallint) to authenticated;
grant execute on function public.expire_category(uuid, smallint) to authenticated;
grant execute on function public.press_stop(uuid) to authenticated;
grant execute on function public.vote_end_round(uuid, boolean) to authenticated;
