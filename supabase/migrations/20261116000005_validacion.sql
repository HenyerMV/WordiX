-- WordiX · Migración 5 · Etapa 7: validación automática de respuestas
-- Requiere las migraciones 1 a 4. Se puede ejecutar más de una vez.
--
-- Cuando la ronda pasa a 'reviewing', el servidor (ruta /api/validar, con la clave
-- service_role) valida las respuestas en este orden:
--   1. formato y letra  -> ya se comprobaron al enviar cada palabra
--   2. diccionario propio (word_dictionary)
--   3. fuentes externas (Wikidata y Wikcionario), solo desde el servidor
--   4. categoría: lo que ninguna fuente confirma pasa a revisión grupal ('in_review')
-- Los jugadores NO pueden llamar a estas funciones: solo la service_role.

alter table public.rounds add column if not exists validation_started_at timestamptz;
alter table public.rounds add column if not exists validated_at timestamptz;

-- Reserva la validación de una ronda para que no la hagan dos clientes a la vez.
-- La reserva caduca a los 60 s por si el servidor falla a mitad de camino.
create or replace function public.begin_validation(p_round uuid)
returns boolean
language plpgsql security definer set search_path = public
as $$
declare
  v_ok boolean;
begin
  update public.rounds
  set validation_started_at = now()
  where id = p_round
    and status = 'reviewing'
    and validated_at is null
    and (validation_started_at is null
         or validation_started_at < now() - interval '60 seconds')
  returning true into v_ok;

  return coalesce(v_ok, false);
end;
$$;

-- Paso 2: acepta las respuestas que ya están en el diccionario (misma categoría)
-- y devuelve las que siguen sin resolver para consultarlas en fuentes externas.
create or replace function public.validate_round_dictionary(p_round uuid)
returns table (r_answer_id uuid, r_slug text, r_answer text)
language plpgsql security definer set search_path = public
as $$
begin
  update public.game_answers a
  set status = 'accepted', decided_by = 'dictionary'
  from public.word_dictionary d
  where a.round_id = p_round
    and a.status = 'pending'
    and a.answer is not null
    and d.category_id = a.category_id
    and d.word_normalized = public.wordix_normalize(a.answer);

  return query
  select a.id, c.slug, a.answer
  from public.game_answers a
  join public.categories c on c.id = a.category_id
  where a.round_id = p_round
    and a.status = 'pending'
    and a.answer is not null
  order by c.sort_order, a.answered_at;
end;
$$;

-- Paso 3 y 4: guarda el resultado de las fuentes externas.
-- p_results: [{ "answer_id": uuid, "status": "accepted"|"in_review"|"rejected",
--               "decided_by": "wikidata"|"wiktionary"|null }]
-- Solo cambia respuestas que siguen 'pending' (si dos llamadas se cruzan, no se pisan).
create or replace function public.apply_validation(p_round uuid, p_results jsonb)
returns void
language plpgsql security definer set search_path = public
as $$
declare
  v_item record;
  v_cat  smallint;
  v_word text;
begin
  for v_item in
    select * from jsonb_to_recordset(coalesce(p_results, '[]'::jsonb))
      as x(answer_id uuid, status text, decided_by text)
  loop
    if v_item.status not in ('accepted', 'in_review', 'rejected') then
      raise exception 'INVALID_STATUS';
    end if;

    update public.game_answers
    set status = v_item.status,
        decided_by = case when v_item.status = 'in_review' then null else v_item.decided_by end
    where id = v_item.answer_id
      and round_id = p_round
      and status = 'pending'
    returning category_id, answer into v_cat, v_word;

    if found then
      if v_item.status = 'accepted' and v_item.decided_by in ('wikidata', 'wiktionary') then
        -- Palabra confirmada por una fuente fiable: queda en el diccionario con su origen.
        insert into public.word_dictionary (category_id, word, source)
        values (v_cat, v_word, v_item.decided_by)
        on conflict (category_id, word_normalized) do nothing;
      elsif v_item.status = 'in_review' then
        insert into public.word_reviews (answer_id)
        values (v_item.answer_id)
        on conflict (answer_id) do nothing;
      end if;
    end if;
  end loop;

  -- Cuando ya no queda nada pendiente, la ronda queda validada.
  if not exists (
    select 1 from public.game_answers
    where round_id = p_round and status = 'pending' and answer is not null
  ) then
    update public.rounds
    set validated_at = now()
    where id = p_round and validated_at is null;
  end if;
end;
$$;

revoke all on function public.begin_validation(uuid) from public, anon, authenticated;
revoke all on function public.validate_round_dictionary(uuid) from public, anon, authenticated;
revoke all on function public.apply_validation(uuid, jsonb) from public, anon, authenticated;
grant execute on function public.begin_validation(uuid) to service_role;
grant execute on function public.validate_round_dictionary(uuid) to service_role;
grant execute on function public.apply_validation(uuid, jsonb) to service_role;
