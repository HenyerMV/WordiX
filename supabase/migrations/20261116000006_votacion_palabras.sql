-- WordiX · Migración 6 · Etapa 8: votación de las palabras sin confirmar
-- Requiere las migraciones 1 a 5. Se puede ejecutar más de una vez.
--
-- Reglas (las aplica el servidor):
--  * Solo se vota una palabra que quedó 'in_review' (no la pudieron confirmar las fuentes).
--  * El autor NO puede votar su propia palabra.
--  * Todos los DEMÁS jugadores de la sala deben votar a favor para aceptarla.
--  * Un solo voto en contra la rechaza de inmediato. Una palabra rechazada no da puntos.
--  * Cada jugador vota una sola vez por palabra (el voto no se puede cambiar).
--  * Si se acepta por votación unánime, se guarda en word_dictionary con origen 'vote'
--    y, desde entonces, esa palabra se acepta sola en esa categoría.

create or replace function public.vote_word(p_review uuid, p_approve boolean)
returns public.word_reviews
language plpgsql security definer set search_path = public
as $$
declare
  v_uid        uuid := auth.uid();
  v_review     public.word_reviews;
  v_answer     public.game_answers;
  v_room       uuid;
  v_voters     int;
  v_approvals  int;
  v_rejections int;
  v_status     text;
begin
  if v_uid is null then
    raise exception 'NOT_AUTHENTICATED';
  end if;
  if p_approve is null then
    raise exception 'INVALID_VOTE';
  end if;

  select * into v_review from public.word_reviews where id = p_review for update;
  if not found then
    raise exception 'REVIEW_NOT_FOUND';
  end if;

  select * into v_answer from public.game_answers where id = v_review.answer_id;
  v_room := public.room_of_round(v_answer.round_id);

  if not public.is_room_member(v_room) then
    raise exception 'NOT_MEMBER';
  end if;
  if public.round_status(v_answer.round_id) <> 'reviewing' then
    raise exception 'WRONG_PHASE';
  end if;
  if v_review.status <> 'open' then
    raise exception 'REVIEW_CLOSED';
  end if;
  if v_answer.player_id = v_uid then
    raise exception 'AUTHOR_CANNOT_VOTE';
  end if;
  if exists (
    select 1 from public.word_votes where review_id = p_review and voter_id = v_uid
  ) then
    raise exception 'ALREADY_VOTED';
  end if;

  insert into public.word_votes (review_id, voter_id, approve)
  values (p_review, v_uid, p_approve);

  -- Quienes deben votar: todos los jugadores de la sala menos el autor.
  select count(*) into v_voters
  from public.room_players
  where room_id = v_room and player_id <> v_answer.player_id;

  select count(*) filter (where v.approve), count(*) filter (where not v.approve)
  into v_approvals, v_rejections
  from public.word_votes v
  join public.room_players rp on rp.room_id = v_room and rp.player_id = v.voter_id
  where v.review_id = p_review;

  if v_rejections > 0 then
    v_status := 'rejected';
  elsif v_voters > 0 and v_approvals >= v_voters then
    v_status := 'accepted';
  else
    return v_review;  -- todavía faltan votos
  end if;

  update public.word_reviews
  set status = v_status, resolved_at = now()
  where id = p_review
  returning * into v_review;

  update public.game_answers
  set status = v_status, decided_by = 'vote'
  where id = v_answer.id;

  if v_status = 'accepted' then
    insert into public.word_dictionary (category_id, word, source)
    values (v_answer.category_id, v_answer.answer, 'vote')
    on conflict (category_id, word_normalized) do nothing;
  end if;

  return v_review;
end;
$$;

revoke all on function public.vote_word(uuid, boolean) from public, anon;
grant execute on function public.vote_word(uuid, boolean) to authenticated;
