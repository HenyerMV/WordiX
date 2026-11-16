-- WordiX · Migración 3 · Etapa 5: empezar partida, ruleta y votación de la letra
-- Requiere las migraciones 1 y 2. Se puede ejecutar más de una vez.
--
-- Reglas que aplica el servidor (el navegador no puede saltárselas):
--  * Solo el anfitrión empieza la partida y se necesitan 2 o más jugadores.
--  * La primera ronda la abre el anfitrión como jugador mano.
--  * La letra la elige el servidor al azar y no se repite dentro de la partida.
--  * Votación de la letra: gana la mayoría; si hay empate decide el voto del mano.
--  * El mano pasa en orden de asiento (nunca al azar) y no repite dos rondas seguidas.
--
-- Tiempos (deben coincidir con src/lib/game/rules.ts):
--  * 15 s: si el mano no gira la ruleta, cualquier jugador puede girarla.
--  * 25 s: tiempo total de la fase de votación (incluye ~4,5 s de animación).
--    Al vencer, los votos que faltan no cuentan.

create or replace function public.create_round_internal(p_game uuid, p_hand uuid)
returns public.rounds
language plpgsql security definer set search_path = public
as $$
declare
  v_number smallint;
  v_round  public.rounds;
begin
  select coalesce(max(number), 0) + 1 into v_number
  from public.rounds
  where game_id = p_game;

  insert into public.rounds (game_id, number, hand_player_id)
  values (p_game, v_number, p_hand)
  returning * into v_round;

  return v_round;
end;
$$;

create or replace function public.next_hand_internal(p_game uuid)
returns uuid
language plpgsql stable security definer set search_path = public
as $$
declare
  v_room      uuid;
  v_prev_seat smallint;
  v_next      uuid;
begin
  select room_id into v_room from public.games where id = p_game;

  select rp.seat into v_prev_seat
  from public.rounds r
  join public.room_players rp
    on rp.room_id = v_room and rp.player_id = r.hand_player_id
  where r.game_id = p_game
  order by r.number desc
  limit 1;

  select player_id into v_next
  from public.room_players
  where room_id = v_room and seat > coalesce(v_prev_seat, 0)
  order by seat
  limit 1;

  if v_next is null then
    select player_id into v_next
    from public.room_players
    where room_id = v_room
    order by seat
    limit 1;
  end if;

  return v_next;
end;
$$;

create or replace function public.server_now()
returns timestamptz
language sql stable
as $$
  select now();
$$;

create or replace function public.start_game(p_room uuid)
returns public.games
language plpgsql security definer set search_path = public
as $$
declare
  v_uid   uuid := auth.uid();
  v_room  public.rooms;
  v_count int;
  v_game  public.games;
begin
  if v_uid is null then
    raise exception 'NOT_AUTHENTICATED';
  end if;

  select * into v_room from public.rooms where id = p_room for update;
  if not found then
    raise exception 'ROOM_NOT_FOUND';
  end if;
  if v_room.host_id <> v_uid then
    raise exception 'NOT_HOST';
  end if;
  if v_room.status <> 'waiting' then
    raise exception 'ROOM_STARTED';
  end if;

  select count(*) into v_count from public.room_players where room_id = p_room;
  if v_count < 2 then
    raise exception 'NOT_ENOUGH_PLAYERS';
  end if;
  if not exists (select 1 from public.categories where is_active) then
    raise exception 'NO_CATEGORIES';
  end if;

  update public.rooms set status = 'playing' where id = p_room;

  insert into public.games (room_id) values (p_room) returning * into v_game;

  insert into public.game_categories (game_id, category_id, position)
  select v_game.id, c.id, (row_number() over (order by c.sort_order, c.id))::smallint
  from public.categories c
  where c.is_active;

  perform public.create_round_internal(v_game.id, v_room.host_id);

  return v_game;
end;
$$;

create or replace function public.spin_round(p_round uuid)
returns public.rounds
language plpgsql security definer set search_path = public
as $$
declare
  v_uid     uuid := auth.uid();
  v_round   public.rounds;
  v_letters text := 'abcdefghijklmnñopqrstuvwxyz';
  v_pool    text[];
  v_letter  text;
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
  if v_round.status <> 'spinning' then
    raise exception 'WRONG_PHASE';
  end if;
  if v_round.hand_player_id <> v_uid
     and now() < v_round.phase_started_at + interval '15 seconds' then
    raise exception 'ONLY_HAND_CAN_SPIN';
  end if;

  select array_agg(l) into v_pool
  from unnest(string_to_array(v_letters, null)) as l
  where l not in (
    select r.letter from public.rounds r
    where r.game_id = v_round.game_id and r.letter is not null
  );

  if v_pool is null then
    v_pool := string_to_array(v_letters, null);
  end if;

  v_letter := v_pool[1 + floor(random() * array_length(v_pool, 1))::int];

  update public.rounds
  set letter = v_letter, status = 'letter_vote', phase_started_at = now()
  where id = p_round
  returning * into v_round;

  return v_round;
end;
$$;

create or replace function public.vote_letter(p_round uuid, p_accept boolean)
returns void
language plpgsql security definer set search_path = public
as $$
declare
  v_uid   uuid := auth.uid();
  v_round public.rounds;
begin
  if v_uid is null then
    raise exception 'NOT_AUTHENTICATED';
  end if;
  if p_accept is null then
    raise exception 'INVALID_VOTE';
  end if;

  select * into v_round from public.rounds where id = p_round for share;
  if not found then
    raise exception 'ROUND_NOT_FOUND';
  end if;
  if not public.is_room_member(public.room_of_game(v_round.game_id)) then
    raise exception 'NOT_MEMBER';
  end if;
  if v_round.status <> 'letter_vote' then
    raise exception 'WRONG_PHASE';
  end if;

  insert into public.letter_votes (round_id, player_id, accept)
  values (p_round, v_uid, p_accept)
  on conflict (round_id, player_id)
  do update set accept = excluded.accept, voted_at = now();
end;
$$;

create or replace function public.resolve_letter_vote(p_round uuid)
returns public.rounds
language plpgsql security definer set search_path = public
as $$
declare
  v_uid       uuid := auth.uid();
  v_round     public.rounds;
  v_room      uuid;
  v_members   int;
  v_votes     int;
  v_yes       int;
  v_no        int;
  v_hand_vote boolean;
  v_accept    boolean;
begin
  if v_uid is null then
    raise exception 'NOT_AUTHENTICATED';
  end if;

  select * into v_round from public.rounds where id = p_round for update;
  if not found then
    raise exception 'ROUND_NOT_FOUND';
  end if;

  v_room := public.room_of_game(v_round.game_id);
  if not public.is_room_member(v_room) then
    raise exception 'NOT_MEMBER';
  end if;

  if v_round.status <> 'letter_vote' then
    return v_round;
  end if;

  select count(*) into v_members from public.room_players where room_id = v_room;

  select count(*) filter (where lv.accept),
         count(*) filter (where not lv.accept),
         count(*)
    into v_yes, v_no, v_votes
  from public.letter_votes lv
  join public.room_players rp
    on rp.room_id = v_room and rp.player_id = lv.player_id
  where lv.round_id = p_round;

  if v_votes < v_members
     and now() < v_round.phase_started_at + interval '25 seconds' then
    raise exception 'VOTE_NOT_READY';
  end if;

  if v_yes > v_no then
    v_accept := true;
  elsif v_no > v_yes then
    v_accept := false;
  else
    select accept into v_hand_vote
    from public.letter_votes
    where round_id = p_round and player_id = v_round.hand_player_id;
    v_accept := coalesce(v_hand_vote, true);
  end if;

  if v_accept then
    update public.rounds
    set status = 'answering', phase_started_at = now()
    where id = p_round
    returning * into v_round;
  else
    update public.rounds
    set status = 'letter_rejected', phase_started_at = now()
    where id = p_round
    returning * into v_round;

    perform public.create_round_internal(
      v_round.game_id,
      public.next_hand_internal(v_round.game_id)
    );
  end if;

  return v_round;
end;
$$;

revoke all on function public.create_round_internal(uuid, uuid) from public, anon, authenticated;
revoke all on function public.next_hand_internal(uuid) from public, anon, authenticated;

revoke all on function public.server_now() from public, anon;
revoke all on function public.start_game(uuid) from public, anon;
revoke all on function public.spin_round(uuid) from public, anon;
revoke all on function public.vote_letter(uuid, boolean) from public, anon;
revoke all on function public.resolve_letter_vote(uuid) from public, anon;

grant execute on function public.server_now() to authenticated;
grant execute on function public.start_game(uuid) to authenticated;
grant execute on function public.spin_round(uuid) to authenticated;
grant execute on function public.vote_letter(uuid, boolean) to authenticated;
grant execute on function public.resolve_letter_vote(uuid) to authenticated;
