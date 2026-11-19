-- WordiX · Migración 7 · Etapa 9: puntos, número de rondas y resultados finales
-- Requiere las migraciones 1 a 6. Se puede ejecutar más de una vez.
--
-- Reglas (las aplica el servidor):
--  * Al crear la sala el anfitrión elige cuántas rondas se juegan (rooms.total_rounds).
--  * Una ronda se cuenta cuando se juega (letra aceptada); si se rechaza la letra no cuenta.
--  * Cuando la revisión termina (nada queda pendiente ni en votación) se asignan puntos:
--      - respuesta válida que también tienen 1 o más jugadores (misma palabra,
--        sin tildes ni mayúsculas, misma categoría) -> 50 puntos cada uno
--      - respuesta válida que nadie más tiene -> 100 puntos
--      - respuesta rechazada o vacía -> 0
--  * game_results guarda el total de cada jugador, que se actualiza en cada ronda.
--  * Al terminar la última ronda la partida y la sala pasan a 'finished' y se calcula
--    la posición de cada jugador (empates comparten posición).
--  * Entre rondas, cualquier jugador puede pasar a la siguiente (start_next_round).

alter table public.rooms add column if not exists total_rounds smallint not null default 3;
alter table public.rooms drop constraint if exists rooms_total_rounds;
alter table public.rooms add constraint rooms_total_rounds check (total_rounds between 1 and 10);

-- create_room ahora recibe el número de rondas (3 por defecto).
drop function if exists public.create_room();

create or replace function public.create_room(p_rounds smallint default 3)
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
  if p_rounds is null or p_rounds < 1 or p_rounds > 10 then
    raise exception 'INVALID_ROUNDS';
  end if;

  perform public.leave_other_waiting_rooms(v_uid, null);

  insert into public.rooms (code, host_id, total_rounds)
  values (public.generate_room_code(), v_uid, p_rounds)
  returning * into v_room;

  -- El creador ocupa el asiento 1 y es el primer jugador mano.
  insert into public.room_players (room_id, player_id, seat)
  values (v_room.id, v_uid, 1);

  return v_room;
end;
$$;

revoke all on function public.create_room(smallint) from public, anon;
grant execute on function public.create_room(smallint) to authenticated;

-- Cierra la ronda: reparte puntos, actualiza totales y, si era la última, termina la partida.
create or replace function public.finish_round(p_round uuid)
returns public.rounds
language plpgsql security definer set search_path = public
as $$
declare
  v_uid    uuid := auth.uid();
  v_round  public.rounds;
  v_game   public.games;
  v_room   public.rooms;
  v_played int;
begin
  if v_uid is null then
    raise exception 'NOT_AUTHENTICATED';
  end if;

  select * into v_round from public.rounds where id = p_round for update;
  if not found then
    raise exception 'ROUND_NOT_FOUND';
  end if;

  select * into v_game from public.games where id = v_round.game_id for update;
  select * into v_room from public.rooms where id = v_game.room_id;

  if not public.is_room_member(v_room.id) then
    raise exception 'NOT_MEMBER';
  end if;

  if v_round.status = 'finished' then
    return v_round;  -- ya estaba cerrada
  end if;
  if v_round.status <> 'reviewing' then
    raise exception 'WRONG_PHASE';
  end if;
  if exists (
    select 1 from public.game_answers
    where round_id = p_round and answer is not null and status in ('pending', 'in_review')
  ) then
    raise exception 'REVIEW_NOT_DONE';
  end if;

  -- Puntos: 50 si la palabra válida se repite entre jugadores, 100 si es única.
  update public.game_answers set points = 0 where round_id = p_round;

  update public.game_answers a
  set points = case when s.n >= 2 then 50 else 100 end
  from (
    select category_id, public.wordix_normalize(answer) as w, count(*) as n
    from public.game_answers
    where round_id = p_round and status = 'accepted' and answer is not null
    group by category_id, public.wordix_normalize(answer)
  ) s
  where a.round_id = p_round
    and a.status = 'accepted'
    and a.answer is not null
    and a.category_id = s.category_id
    and public.wordix_normalize(a.answer) = s.w;

  update public.rounds
  set status = 'finished', phase_started_at = now()
  where id = p_round
  returning * into v_round;

  -- Total de cada jugador de la sala en toda la partida.
  insert into public.game_results (game_id, player_id, total_points)
  select v_game.id, rp.player_id,
         coalesce((
           select sum(a.points)
           from public.game_answers a
           join public.rounds r on r.id = a.round_id
           where r.game_id = v_game.id and a.player_id = rp.player_id
         ), 0)::int
  from public.room_players rp
  where rp.room_id = v_room.id
  on conflict (game_id, player_id) do update set total_points = excluded.total_points;

  -- ¿Era la última ronda?
  select count(*) into v_played
  from public.rounds
  where game_id = v_game.id and status = 'finished';

  if v_played >= v_room.total_rounds then
    update public.games set status = 'finished', finished_at = now() where id = v_game.id;
    update public.rooms set status = 'finished' where id = v_room.id;

    update public.game_results gr
    set position = ranked.pos
    from (
      select player_id, (rank() over (order by total_points desc))::smallint as pos
      from public.game_results
      where game_id = v_game.id
    ) ranked
    where gr.game_id = v_game.id and gr.player_id = ranked.player_id;
  end if;

  return v_round;
end;
$$;

-- Abre la ronda siguiente (mano siguiente en el orden de asientos). Es idempotente:
-- si dos jugadores lo piden a la vez, la segunda llamada recibe la misma ronda.
create or replace function public.start_next_round(p_round uuid)
returns public.rounds
language plpgsql security definer set search_path = public
as $$
declare
  v_uid   uuid := auth.uid();
  v_round public.rounds;
  v_game  public.games;
  v_next  public.rounds;
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
  if v_round.status <> 'finished' then
    raise exception 'WRONG_PHASE';
  end if;

  select * into v_game from public.games where id = v_round.game_id;
  if v_game.status <> 'in_progress' then
    raise exception 'GAME_FINISHED';
  end if;

  select * into v_next
  from public.rounds
  where game_id = v_round.game_id and number > v_round.number
  order by number
  limit 1;
  if found then
    return v_next;
  end if;

  return public.create_round_internal(v_round.game_id, public.next_hand_internal(v_round.game_id));
end;
$$;

revoke all on function public.finish_round(uuid) from public, anon;
revoke all on function public.start_next_round(uuid) from public, anon;
grant execute on function public.finish_round(uuid) to authenticated;
grant execute on function public.start_next_round(uuid) to authenticated;
