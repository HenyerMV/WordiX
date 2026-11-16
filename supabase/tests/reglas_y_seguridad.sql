\set ON_ERROR_STOP 1
\set as_a 'reset role; select set_config(''request.jwt.claim.sub'', ''00000000-0000-0000-0000-00000000000a'', false); set role authenticated;'
\set as_b 'reset role; select set_config(''request.jwt.claim.sub'', ''00000000-0000-0000-0000-00000000000b'', false); set role authenticated;'
\set as_c 'reset role; select set_config(''request.jwt.claim.sub'', ''00000000-0000-0000-0000-00000000000c'', false); set role authenticated;'
\set as_d 'reset role; select set_config(''request.jwt.claim.sub'', ''00000000-0000-0000-0000-00000000000d'', false); set role authenticated;'
\set as_e 'reset role; select set_config(''request.jwt.claim.sub'', ''00000000-0000-0000-0000-00000000000e'', false); set role authenticated;'
\set as_f 'reset role; select set_config(''request.jwt.claim.sub'', ''00000000-0000-0000-0000-00000000000f'', false); set role authenticated;'

reset role;
insert into auth.users(id) values
 ('00000000-0000-0000-0000-00000000000a'),('00000000-0000-0000-0000-00000000000b'),
 ('00000000-0000-0000-0000-00000000000c'),('00000000-0000-0000-0000-00000000000d'),
 ('00000000-0000-0000-0000-00000000000e'),('00000000-0000-0000-0000-00000000000f');
create table public.t_ctx(k text primary key, v text);
create function public.t_expect(q text, code text) returns void language plpgsql as $$
begin
  begin
    execute q;
  exception when others then
    if sqlerrm like '%' || code || '%' then return; end if;
    raise exception 'ESPERABA % pero llegó: %', code, sqlerrm;
  end;
  raise exception 'ESPERABA % pero no hubo error', code;
end $$;

-- 1. Perfil
:as_a
do $$ declare p public.players; begin
  perform public.t_expect($q$select public.ensure_player('juan1')$q$, 'INVALID_NAME');
  perform public.t_expect($q$select public.ensure_player('A')$q$, 'INVALID_NAME');
  perform public.t_expect($q$select public.ensure_player('   ')$q$, 'INVALID_NAME');
  perform public.t_expect($q$select public.ensure_player('abcdefghijklmnopq')$q$, 'INVALID_NAME');
  p := public.ensure_player('  Ana   María ');
  assert p.username = 'ana maría', 'nombre normalizado: ' || p.username;
  p := public.ensure_player('ana');
  assert p.username = 'ana';
  raise notice 'OK 1: perfil (validación y normalización)';
end $$;

:as_b
do $$ begin
  perform public.t_expect($q$select public.create_room()$q$, 'NO_PLAYER');
  perform public.t_expect($q$select public.join_room('123456')$q$, 'NO_PLAYER');
  perform public.ensure_player('beto');
  raise notice 'OK 2: sin perfil no se puede crear ni entrar';
end $$;
:as_c
select public.ensure_player('carla');
:as_d
select public.ensure_player('dani');
:as_e
select public.ensure_player('eva');
:as_f
select public.ensure_player('fede');

-- 2. Crear sala
:as_a
do $$ declare r public.rooms; n int; begin
  r := public.create_room();
  assert r.code ~ '^[0-9]{6}$', 'código de 6 dígitos: ' || r.code;
  assert r.host_id = '00000000-0000-0000-0000-00000000000a', 'host';
  assert r.status = 'waiting';
  select count(*) into n from public.room_players where room_id = r.id and seat = 1 and player_id = r.host_id;
  assert n = 1, 'el creador ocupa el asiento 1';
  insert into public.t_ctx values ('code', r.code), ('room', r.id::text);
  raise notice 'OK 3: crear sala (código %, asiento 1)', r.code;
end $$;

-- 3. Unirse
:as_b
do $$ declare r public.rooms; n int; c text; begin
  select v into c from public.t_ctx where k = 'code';
  perform public.t_expect($q$select public.join_room('abc')$q$, 'INVALID_CODE');
  perform public.t_expect($q$select public.join_room('000001')$q$, 'ROOM_NOT_FOUND');
  r := public.join_room(c);
  r := public.join_room(c);  -- idempotente (recarga / reconexión)
  select count(*) into n from public.room_players where room_id = r.id;
  assert n = 2, 'dos jugadores tras unirse y repetir: ' || n;
  assert (select seat from public.room_players where room_id = r.id and player_id = '00000000-0000-0000-0000-00000000000b') = 2;
  raise notice 'OK 4: unirse es idempotente, asiento 2';
end $$;
:as_c
select public.join_room(v) from public.t_ctx where k = 'code';
:as_d
select public.join_room(v) from public.t_ctx where k = 'code';
:as_e
do $$ declare c text; begin
  select v into c from public.t_ctx where k = 'code';
  perform public.t_expect(format('select public.join_room(%L)', c), 'ROOM_FULL');
  raise notice 'OK 5: sala llena al quinto jugador (máx. 4)';
end $$;

-- 4. Salir libera el asiento y el siguiente lo ocupa
:as_b
do $$ declare rid uuid; begin
  select v::uuid into rid from public.t_ctx where k = 'room';
  perform public.leave_room(rid);
  perform public.leave_room(rid); -- salir dos veces no rompe nada
  reset role;
  assert (select count(*) from public.room_players where room_id = rid) = 3;
  raise notice 'OK 6: salir libera el asiento';
end $$;
:as_e
do $$ declare rid uuid; c text; begin
  select v::uuid into rid from public.t_ctx where k = 'room';
  select v into c from public.t_ctx where k = 'code';
  perform public.join_room(c);
  assert (select seat from public.room_players where room_id = rid and player_id = '00000000-0000-0000-0000-00000000000e') = 2, 'ocupa el asiento libre';
  raise notice 'OK 7: el nuevo jugador toma el asiento libre (2)';
end $$;

-- 5. RLS
:as_f
do $$ declare rid uuid; begin
  select v::uuid into rid from public.t_ctx where k = 'room';
  assert (select count(*) from public.rooms) = 0, 'no miembro no ve salas';
  assert (select count(*) from public.room_players) = 0, 'no miembro no ve asientos';
  assert (select count(*) from public.players) = 1, 'solo se ve a sí mismo';
  perform public.t_expect($q$insert into public.rooms(code, host_id) values ('555555','00000000-0000-0000-0000-00000000000f')$q$, 'permission denied');
  perform public.t_expect($q$update public.players set username = 'hack'$q$, 'permission denied');
  perform public.t_expect($q$delete from public.room_players$q$, 'permission denied');
  perform public.t_expect($q$insert into public.room_players(room_id, player_id, seat) values (gen_random_uuid(),'00000000-0000-0000-0000-00000000000f',1)$q$, 'permission denied');
  perform public.t_expect($q$select public.leave_room_internal('00000000-0000-0000-0000-00000000000a', gen_random_uuid())$q$, 'permission denied');
  perform public.t_expect($q$select public.generate_room_code()$q$, 'permission denied');
  raise notice 'OK 8: RLS y permisos (sin lectura ajena, sin escritura directa, sin funciones internas)';
end $$;
:as_d
do $$ begin
  assert (select count(*) from public.players) = 4, 'un miembro ve a los de su sala (a, c, d, e): ' || (select count(*) from public.players);
  assert (select count(*) from public.rooms) = 1;
  raise notice 'OK 9: un miembro ve su sala y a sus compañeros';
end $$;

-- anon
reset role;
set role anon;
do $$ begin
  perform public.t_expect($q$select count(*) from public.rooms$q$, 'permission denied');
  perform public.t_expect($q$select public.join_room('123456')$q$, 'permission denied');
  perform public.t_expect($q$select public.create_room()$q$, 'permission denied');
  raise notice 'OK 10: el rol anon (sin sesión) no puede leer ni llamar funciones';
end $$;

-- 6. Anfitrión se va -> traspaso
:as_a
do $$ declare rid uuid; begin
  select v::uuid into rid from public.t_ctx where k = 'room';
  perform public.leave_room(rid);
  reset role;
  assert (select host_id from public.rooms where id = rid) = '00000000-0000-0000-0000-00000000000e', 'host pasa al asiento más bajo (eva, asiento 2)';
  raise notice 'OK 11: si se va el anfitrión pasa al asiento más bajo';
end $$;

-- 7. Crear una sala nueva saca de la anterior
:as_e
do $$ declare rid uuid; r2 public.rooms; begin
  select v::uuid into rid from public.t_ctx where k = 'room';
  r2 := public.create_room();
  reset role;
  assert not exists (select 1 from public.room_players where room_id = rid and player_id = '00000000-0000-0000-0000-00000000000e'), 'eva salió de la sala vieja';
  assert (select host_id from public.rooms where id = rid) = '00000000-0000-0000-0000-00000000000c', 'host de la sala vieja pasa a carla';
  assert (select count(*) from public.room_players where player_id = '00000000-0000-0000-0000-00000000000e') = 1, 'una sola sala';
  insert into public.t_ctx values ('code2', r2.code), ('room2', r2.id::text);
  raise notice 'OK 12: una sala nueva te saca de la anterior';
end $$;

-- 8. Última persona se va -> sala eliminada
:as_e
do $$ declare rid uuid; begin
  select v::uuid into rid from public.t_ctx where k = 'room2';
  perform public.leave_room(rid);
  reset role;
  assert not exists (select 1 from public.rooms where id = rid), 'sala vacía eliminada';
  raise notice 'OK 13: la sala vacía se elimina';
end $$;

-- 9. Reglas de ronda, votos y visibilidad (datos creados como servidor)
reset role;
do $$ declare g uuid; r1 uuid; r2 uuid; r3 uuid; rm public.rooms; ans uuid; rev uuid; begin
  perform set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-00000000000c', false);
  set local role authenticated;
  rm := public.create_room();       -- carla crea una sala
  perform set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-00000000000d', false);
  perform public.join_room(rm.code); -- dani se une
  reset role;

  insert into public.games(room_id) values (rm.id) returning id into g;
  insert into public.rounds(game_id, number, hand_player_id) values (g, 1, '00000000-0000-0000-0000-00000000000c') returning id into r1;
  perform public.t_expect(format($q$insert into public.rounds(game_id, number, hand_player_id) values (%L, 2, '00000000-0000-0000-0000-00000000000c')$q$, g), 'HAND_REPEATED');
  insert into public.rounds(game_id, number, hand_player_id) values (g, 2, '00000000-0000-0000-0000-00000000000d') returning id into r2;
  insert into public.rounds(game_id, number, hand_player_id) values (g, 3, '00000000-0000-0000-0000-00000000000c') returning id into r3;
  perform public.t_expect(format($q$insert into public.rounds(game_id, number, hand_player_id) values (%L, 3, '00000000-0000-0000-0000-00000000000c')$q$, g), 'duplicate key');
  perform public.t_expect(format($q$insert into public.rounds(game_id, number, hand_player_id, letter) values (%L, 4, '00000000-0000-0000-0000-00000000000d', 'A')$q$, g), 'rounds_letter');
  raise notice 'OK 14: nadie es mano dos rondas seguidas (y alternan C, D, C)';

  -- respuestas: formato
  perform public.t_expect(format($q$insert into public.game_answers(round_id, player_id, category_id, answer) values (%L, '00000000-0000-0000-0000-00000000000c', 1, 'Hola1')$q$, r1), 'game_answers_format');
  insert into public.game_answers(round_id, player_id, category_id, answer, status)
    values (r1, '00000000-0000-0000-0000-00000000000c', 1, 'carlos', 'pending') returning id into ans;
  insert into public.game_answers(round_id, player_id, category_id, answer, status)
    values (r1, '00000000-0000-0000-0000-00000000000d', 1, 'camila', 'pending');
  perform public.t_expect(format($q$insert into public.game_answers(round_id, player_id, category_id, answer) values (%L, '00000000-0000-0000-0000-00000000000c', 1, 'otro')$q$, r1), 'game_answers_unique');
  raise notice 'OK 15: formato y unicidad de respuestas';

  -- votos: el autor no vota, un voto por jugador
  insert into public.word_reviews(answer_id) values (ans) returning id into rev;
  perform public.t_expect(format($q$insert into public.word_votes(review_id, voter_id, approve) values (%L, '00000000-0000-0000-0000-00000000000c', true)$q$, rev), 'AUTHOR_CANNOT_VOTE');
  insert into public.word_votes(review_id, voter_id, approve) values (rev, '00000000-0000-0000-0000-00000000000d', true);
  perform public.t_expect(format($q$insert into public.word_votes(review_id, voter_id, approve) values (%L, '00000000-0000-0000-0000-00000000000d', false)$q$, rev), 'duplicate key');
  raise notice 'OK 16: el autor no vota y no hay votos repetidos';

  insert into public.t_ctx values ('round1', r1::text);
end $$;

-- visibilidad de respuestas: ocultas mientras se responde
reset role;
update public.rounds set status = 'answering' where id = (select v::uuid from public.t_ctx where k = 'round1');
:as_d
do $$ begin
  assert (select count(*) from public.game_answers) = 1, 'durante la ronda solo ve la propia: ' || (select count(*) from public.game_answers);
  assert (select count(*) from public.game_answers where player_id = '00000000-0000-0000-0000-00000000000d') = 1;
  raise notice 'OK 17: durante la ronda no se ven las respuestas de los demás';
end $$;
:as_f
do $$ begin
  assert (select count(*) from public.game_answers) = 0, 'ajeno no ve nada';
end $$;
reset role;
update public.rounds set status = 'reviewing' where id = (select v::uuid from public.t_ctx where k = 'round1');
:as_d
do $$ begin
  assert (select count(*) from public.game_answers) = 2, 'en revisión se ven todas: ' || (select count(*) from public.game_answers);
  assert (select count(*) from public.word_votes) = 1, 'miembro ve los votos';
  raise notice 'OK 18: en revisión se ven las respuestas y los votos';
end $$;
:as_f
do $$ begin
  assert (select count(*) from public.game_answers) = 0 and (select count(*) from public.word_reviews) = 0, 'ajeno sigue sin ver nada';
  raise notice 'OK 19: quien no está en la sala nunca ve respuestas';
end $$;

-- 10. Realtime
reset role;
do $$ begin
  assert (select count(*) from pg_publication_tables where pubname='supabase_realtime' and schemaname='public') = 9, 'tablas en realtime';
  raise notice 'OK 20: 9 tablas publicadas en Realtime';
end $$;
