-- Etapas 5 y 6: empezar partida, ruleta, votación de la letra, respuestas y STOP.
-- Requiere: supabase_shim.sql + migraciones 1 a 4 + seed.sql. Ejecutar en una base limpia.
\set ON_ERROR_STOP 1
\set as_a 'reset role; select set_config(''request.jwt.claim.sub'', ''00000000-0000-0000-0000-0000000000a1'', false); set role authenticated;'
\set as_b 'reset role; select set_config(''request.jwt.claim.sub'', ''00000000-0000-0000-0000-0000000000b1'', false); set role authenticated;'
\set as_c 'reset role; select set_config(''request.jwt.claim.sub'', ''00000000-0000-0000-0000-0000000000c1'', false); set role authenticated;'

reset role;
insert into auth.users(id) values
 ('00000000-0000-0000-0000-0000000000a1'),('00000000-0000-0000-0000-0000000000b1'),('00000000-0000-0000-0000-0000000000c1');
create table if not exists public.t_ctx(k text primary key, v text);
create or replace function public.t_expect(q text, code text) returns void language plpgsql as $$
begin
  begin execute q;
  exception when others then
    if sqlerrm like '%' || code || '%' then return; end if;
    raise exception 'ESPERABA % pero llegó: %', code, sqlerrm;
  end;
  raise exception 'ESPERABA % pero no hubo error', code;
end $$;

:as_a
select public.ensure_player('ana');
:as_b
select public.ensure_player('beto');
:as_c
select public.ensure_player('carla');

-- Sala y reglas de inicio
:as_a
do $$ declare r public.rooms; begin
  r := public.create_room();
  insert into public.t_ctx values ('code', r.code), ('room', r.id::text);
  perform public.t_expect(format('select public.start_game(%L)', r.id), 'NOT_ENOUGH_PLAYERS');
  raise notice 'OK 1: no se puede empezar con un solo jugador';
end $$;
:as_b
select public.join_room(v) from public.t_ctx where k = 'code';
do $$ begin
  perform public.t_expect(format('select public.start_game(%L)', (select v from public.t_ctx where k='room')), 'NOT_HOST');
  raise notice 'OK 2: solo el anfitrión empieza la partida';
end $$;

:as_a
do $$ declare g public.games; rid text; n int; begin
  rid := (select v from public.t_ctx where k='room');
  g := public.start_game(rid::uuid);
  reset role;
  assert (select status from public.rooms where id = rid::uuid) = 'playing', 'sala en juego';
  assert (select count(*) from public.game_categories where game_id = g.id) = 14, 'categorías copiadas';
  select count(*) into n from public.rounds where game_id = g.id and number = 1 and hand_player_id = '00000000-0000-0000-0000-0000000000a1' and status = 'spinning';
  assert n = 1, 'ronda 1: el anfitrión es el primer mano';
  insert into public.t_ctx values ('game', g.id::text), ('r1', (select id::text from public.rounds where game_id = g.id and number = 1));
  raise notice 'OK 3: partida creada, 14 categorías, anfitrión es mano en la ronda 1';
end $$;
:as_c
do $$ begin
  perform public.t_expect(format('select public.join_room(%L)', (select v from public.t_ctx where k='code')), 'ROOM_STARTED');
  raise notice 'OK 4: no se puede entrar a una sala ya empezada';
end $$;

-- Ruleta: solo el mano gira
:as_b
do $$ begin
  perform public.t_expect(format('select public.spin_round(%L)', (select v from public.t_ctx where k='r1')), 'ONLY_HAND_CAN_SPIN');
  raise notice 'OK 5: otro jugador no puede girar la ruleta antes de tiempo';
end $$;
:as_a
do $$ declare r public.rounds; begin
  r := public.spin_round((select v::uuid from public.t_ctx where k='r1'));
  assert r.status = 'letter_vote' and r.letter ~ '^[a-zñ]$', 'letra: ' || coalesce(r.letter,'null');
  insert into public.t_ctx values ('letter1', r.letter);
  perform public.t_expect(format('select public.spin_round(%L)', r.id), 'WRONG_PHASE');
  raise notice 'OK 6: la ruleta elige la letra "%" y pasa a votación', r.letter;
end $$;

-- Votación con EMPATE: gana el voto del mano (ana = sí)
:as_a
select public.vote_letter((select v::uuid from public.t_ctx where k='r1'), true);
do $$ begin
  perform public.t_expect(format('select public.resolve_letter_vote(%L)', (select v from public.t_ctx where k='r1')), 'VOTE_NOT_READY');
  raise notice 'OK 7: no se resuelve la votación hasta que todos voten';
end $$;
:as_b
select public.vote_letter((select v::uuid from public.t_ctx where k='r1'), false);
do $$ declare r public.rounds; begin
  r := public.resolve_letter_vote((select v::uuid from public.t_ctx where k='r1'));
  assert r.status = 'answering', 'empate con mano = sí -> se juega: ' || r.status;
  raise notice 'OK 8: empate 1-1, decide el voto del mano (sí) -> a jugar';
end $$;

-- Respuestas
:as_b
do $$ declare l text; ans jsonb; r public.rounds; begin
  l := (select v from public.t_ctx where k='letter1');
  select jsonb_object_agg(category_id::text, l || 'abc') into ans from public.game_categories where game_id = (select v::uuid from public.t_ctx where k='game');
  -- incompleto: falta una categoría
  perform public.t_expect(format('select public.press_stop(%L, %L::jsonb)', (select v from public.t_ctx where k='r1'), (ans - (select min(category_id)::text from public.game_categories where game_id = (select v::uuid from public.t_ctx where k='game')))::text), 'INCOMPLETE_ANSWERS');
  raise notice 'OK 9: STOP rechazado si falta una categoría';
  -- con la letra equivocada
  perform public.t_expect(format('select public.press_stop(%L, %L::jsonb)', (select v from public.t_ctx where k='r1'), (select jsonb_object_agg(category_id::text, case when l = 'z' then 'a' else 'z' end || 'abc') from public.game_categories where game_id = (select v::uuid from public.t_ctx where k='game'))::text), 'INCOMPLETE_ANSWERS');
  raise notice 'OK 10: STOP rechazado si las palabras no empiezan por la letra';
  -- completo
  r := public.press_stop((select v::uuid from public.t_ctx where k='r1'), ans);
  assert r.stopped_by = '00000000-0000-0000-0000-0000000000b1' and r.stopped_at is not null, 'stop registrado';
  assert (select count(*) from public.game_answers where round_id = r.id and player_id = '00000000-0000-0000-0000-0000000000b1') = 14, '14 respuestas guardadas';
  raise notice 'OK 11: STOP válido, quedan guardadas las 14 respuestas';
end $$;
:as_a
do $$ begin
  perform public.t_expect(format('select public.press_stop(%L, ''{}''::jsonb)', (select v from public.t_ctx where k='r1')), 'ALREADY_STOPPED');
  perform public.save_answers((select v::uuid from public.t_ctx where k='r1'), jsonb_build_object((select min(category_id)::text from public.game_categories where game_id = (select v::uuid from public.t_ctx where k='game')), 'xx1'));
  assert (select answer from public.game_answers where round_id = (select v::uuid from public.t_ctx where k='r1') and player_id = '00000000-0000-0000-0000-0000000000a1' limit 1) is null, 'valor inválido se guarda vacío';
  perform public.t_expect(format('select public.finish_answering(%L)', (select v from public.t_ctx where k='r1')), 'ANSWERING_NOT_OVER');
  raise notice 'OK 12: solo hay un STOP, lo inválido se guarda vacío y no se cierra antes de tiempo';
end $$;

-- Pasado el tiempo, se cierra y pasa a revisión (se adelanta el reloj del STOP)
reset role;
update public.rounds set stopped_at = now() - interval '30 seconds' where id = (select v::uuid from public.t_ctx where k='r1');
:as_a
do $$ declare r public.rounds; begin
  r := public.finish_answering((select v::uuid from public.t_ctx where k='r1'));
  assert r.status = 'reviewing', 'estado: ' || r.status;
  perform public.t_expect(format('select public.save_answers(%L, ''{}''::jsonb)', r.id), 'WRONG_PHASE');
  raise notice 'OK 13: terminado el tiempo la ronda pasa a revisión y ya no se escribe';
end $$;
:as_b
do $$ begin
  assert (select count(*) from public.game_answers where round_id = (select v::uuid from public.t_ctx where k='r1')) >= 14, 'en revisión todos ven las respuestas';
  raise notice 'OK 14: en revisión los jugadores ven las respuestas de todos';
end $$;

-- Letra RECHAZADA: empate con el mano votando "no" -> nueva ronda con OTRO mano
:as_c
do $$ declare r public.rooms; begin
  r := public.create_room();
  insert into public.t_ctx values ('code2', r.code), ('room2', r.id::text);
end $$;
:as_a
select public.join_room(v) from public.t_ctx where k = 'code2';
:as_c
do $$ declare g public.games; r1 uuid; r public.rounds; begin
  g := public.start_game((select v::uuid from public.t_ctx where k='room2'));
  reset role;
  select id into r1 from public.rounds where game_id = g.id and number = 1;
  assert (select hand_player_id from public.rounds where id = r1) = '00000000-0000-0000-0000-0000000000c1', 'carla es la primera mano';
  insert into public.t_ctx values ('g2', g.id::text), ('g2r1', r1::text);
  set role authenticated;
  perform public.spin_round(r1);
  perform public.vote_letter(r1, false);   -- el mano vota NO
end $$;
:as_a
do $$ declare r1 uuid; r public.rounds; begin
  r1 := (select v::uuid from public.t_ctx where k='g2r1');
  perform public.vote_letter(r1, true);    -- el otro vota SÍ -> empate 1-1
  r := public.resolve_letter_vote(r1);
  reset role;
  assert r.status = 'letter_rejected', 'empate con mano = no -> rechazada: ' || r.status;
  assert (select count(*) from public.rounds where game_id = (select v::uuid from public.t_ctx where k='g2')) = 2, 'se crea la ronda 2';
  assert (select hand_player_id from public.rounds where game_id = (select v::uuid from public.t_ctx where k='g2') and number = 2) = '00000000-0000-0000-0000-0000000000a1', 'la ronda 2 la lleva el otro jugador';
  assert (select status from public.rounds where game_id = (select v::uuid from public.t_ctx where k='g2') and number = 2) = 'spinning';
  raise notice 'OK 15: empate con mano = no -> letra rechazada, nueva ronda y pasa la mano al siguiente jugador';
end $$;
