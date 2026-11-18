-- WordiX · Migración 4 · Etapa 6: escribir respuestas, STOP y cuenta regresiva de 20 s
-- Requiere las migraciones 1, 2 y 3. Se puede ejecutar más de una vez.
--
-- Reglas que aplica el servidor:
--  * Solo se escribe mientras la ronda está en 'answering'.
--  * Un jugador puede dar STOP solo si completó TODAS las categorías con palabras
--    que empiezan por la letra de la ronda. El primero que lo logra gana el STOP.
--  * Al dar STOP empieza una cuenta regresiva de 20 s para todos (reloj del servidor).
--    Se aceptan guardados hasta 2 s después, para que cada cliente envíe lo último.
--  * Pasado ese tiempo, cualquier jugador puede cerrar la fase: la ronda pasa a 'reviewing'.
--  * Si nadie da STOP en 180 s, la fase se cierra igual (evita partidas colgadas).
--
-- Tiempos (deben coincidir con src/lib/game/rules.ts):
--  STOP_WAIT = 20 s · ANSWER_GRACE = 2 s · ANSWER_MAX = 180 s

alter table public.rounds add column if not exists stopped_at timestamptz;

-- Guarda las respuestas de un jugador. p_answers es un objeto JSON
-- {"<category_id>": "palabra", ...}. Lo que no es válido se guarda como vacío;
-- lo que no empieza por la letra queda rechazado (decided_by = 'letter').
create or replace function public.save_answers_internal(
  p_uid uuid, p_round public.rounds, p_answers jsonb
)
returns void
language plpgsql security definer set search_path = public
as $$
declare
  v_item   record;
  v_cat    smallint;
  v_clean  text;
  v_answer text;
  v_status text;
  v_by     text;
begin
  for v_item in
    select key, value from jsonb_each_text(coalesce(p_answers, '{}'::jsonb))
  loop
    begin
      v_cat := v_item.key::smallint;
    exception when others then
      continue;
    end;

    if not exists (
      select 1 from public.game_categories
      where game_id = p_round.game_id and category_id = v_cat
    ) then
      continue;
    end if;

    v_clean := regexp_replace(lower(trim(coalesce(v_item.value, ''))), '\s+', ' ', 'g');

    if v_clean = ''
       or char_length(v_clean) > 60
       or v_clean !~ '^[a-záéíóúüñ]+( [a-záéíóúüñ]+)*$' then
      v_answer := null; v_status := 'pending'; v_by := null;
    elsif left(public.wordix_normalize(v_clean), 1) <> p_round.letter then
      v_answer := v_clean; v_status := 'rejected'; v_by := 'letter';
    else
      v_answer := v_clean; v_status := 'pending'; v_by := null;
    end if;

    insert into public.game_answers
      (round_id, player_id, category_id, answer, status, decided_by, answered_at)
    values
      (p_round.id, p_uid, v_cat, v_answer, v_status, v_by, now())
    on conflict (round_id, player_id, category_id) do update
      set answer = excluded.answer,
          status = excluded.status,
          decided_by = excluded.decided_by,
          answered_at = excluded.answered_at;
  end loop;
end;
$$;

create or replace function public.save_answers(p_round uuid, p_answers jsonb)
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
  if v_round.stopped_at is not null
     and now() > v_round.stopped_at + interval '22 seconds' then
    raise exception 'ANSWERS_CLOSED';
  end if;

  perform public.save_answers_internal(v_uid, v_round, p_answers);
end;
$$;

create or replace function public.press_stop(p_round uuid, p_answers jsonb)
returns public.rounds
language plpgsql security definer set search_path = public
as $$
declare
  v_uid    uuid := auth.uid();
  v_round  public.rounds;
  v_total  int;
  v_filled int;
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
  if v_round.stopped_by is not null then
    raise exception 'ALREADY_STOPPED';
  end if;

  perform public.save_answers_internal(v_uid, v_round, p_answers);

  select count(*) into v_total
  from public.game_categories where game_id = v_round.game_id;

  select count(*) into v_filled
  from public.game_answers
  where round_id = p_round and player_id = v_uid
    and answer is not null and status <> 'rejected';

  if v_filled < v_total then
    raise exception 'INCOMPLETE_ANSWERS';
  end if;

  update public.rounds
  set stopped_by = v_uid, stopped_at = now()
  where id = p_round
  returning * into v_round;

  return v_round;
end;
$$;

-- Cierra la fase de escritura cuando se acabó el tiempo. Cualquier jugador puede
-- llamarla; el servidor decide y es idempotente.
create or replace function public.finish_answering(p_round uuid)
returns public.rounds
language plpgsql security definer set search_path = public
as $$
declare
  v_uid   uuid := auth.uid();
  v_round public.rounds;
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
    return v_round;
  end if;

  if not (
    (v_round.stopped_at is not null and now() >= v_round.stopped_at + interval '22 seconds')
    or now() >= v_round.phase_started_at + interval '182 seconds'
  ) then
    raise exception 'ANSWERING_NOT_OVER';
  end if;

  update public.rounds
  set status = 'reviewing', phase_started_at = now()
  where id = p_round
  returning * into v_round;

  return v_round;
end;
$$;

revoke all on function public.save_answers_internal(uuid, public.rounds, jsonb) from public, anon, authenticated;
revoke all on function public.save_answers(uuid, jsonb) from public, anon;
revoke all on function public.press_stop(uuid, jsonb) from public, anon;
revoke all on function public.finish_answering(uuid) from public, anon;
grant execute on function public.save_answers(uuid, jsonb) to authenticated;
grant execute on function public.press_stop(uuid, jsonb) to authenticated;
grant execute on function public.finish_answering(uuid) to authenticated;
