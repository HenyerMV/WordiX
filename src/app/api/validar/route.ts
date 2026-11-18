// POST /api/validar  { roundId }
// Valida las respuestas de una ronda en revisión. Corre en el servidor porque usa la
// clave service_role, que NUNCA debe llegar al navegador.

import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";
import { resultKey, validateBatch, type FetchLike } from "@/lib/validation/external";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 30;

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
/** Margen para terminar antes de que Vercel corte la función. */
const EXTERNAL_BUDGET_MS = 18_000;

function reply(body: Record<string, unknown>, status = 200) {
  return NextResponse.json(body, { status });
}

export async function POST(request: Request) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceKey) {
    console.error("[wordix] falta SUPABASE_SERVICE_ROLE_KEY en las variables del servidor");
    return reply({ error: "SERVER_NOT_CONFIGURED" }, 500);
  }

  const token = (request.headers.get("authorization") ?? "").replace(/^Bearer\s+/i, "").trim();
  if (!token) return reply({ error: "NOT_AUTHENTICATED" }, 401);

  let roundId: unknown;
  try {
    roundId = ((await request.json()) as { roundId?: unknown }).roundId;
  } catch {
    return reply({ error: "BAD_REQUEST" }, 400);
  }
  if (typeof roundId !== "string" || !UUID.test(roundId)) return reply({ error: "BAD_REQUEST" }, 400);

  const admin = createClient(url, serviceKey, { auth: { persistSession: false, autoRefreshToken: false } });

  try {
    // 1. ¿Quién llama? Solo se acepta una sesión válida de Supabase.
    const { data: userData, error: userError } = await admin.auth.getUser(token);
    if (userError || !userData.user) return reply({ error: "NOT_AUTHENTICATED" }, 401);
    const userId = userData.user.id;

    // 2. La ronda existe, está en revisión y quien llama juega en esa sala.
    const { data: round, error: roundError } = await admin
      .from("rounds")
      .select("id, status, game_id")
      .eq("id", roundId)
      .maybeSingle();
    if (roundError) throw roundError;
    if (!round) return reply({ error: "ROUND_NOT_FOUND" }, 404);

    const { data: game, error: gameError } = await admin
      .from("games")
      .select("room_id")
      .eq("id", round.game_id)
      .maybeSingle();
    if (gameError) throw gameError;
    if (!game) return reply({ error: "ROUND_NOT_FOUND" }, 404);

    const { data: seat, error: seatError } = await admin
      .from("room_players")
      .select("player_id")
      .eq("room_id", game.room_id)
      .eq("player_id", userId)
      .maybeSingle();
    if (seatError) throw seatError;
    if (!seat) return reply({ error: "NOT_MEMBER" }, 403);
    if (round.status !== "reviewing") return reply({ error: "WRONG_PHASE" }, 409);

    // 3. Solo un cliente a la vez valida la ronda.
    const { data: claimed, error: claimError } = await admin.rpc("begin_validation", { p_round: roundId });
    if (claimError) throw claimError;
    if (!claimed) return reply({ ok: true, started: false });

    // 4. Diccionario propio (en SQL). Devuelve lo que sigue sin resolver.
    const { data: pending, error: dictError } = await admin.rpc("validate_round_dictionary", { p_round: roundId });
    if (dictError) throw dictError;
    const rows = (pending ?? []) as { r_answer_id: string; r_slug: string; r_answer: string }[];

    // 5. Fuentes externas (Wikidata y Wikcionario) para lo que falta.
    const external = await validateBatch(
      rows.map((r) => ({ slug: r.r_slug, answer: r.r_answer })),
      fetch as unknown as FetchLike,
      { deadline: Date.now() + EXTERNAL_BUDGET_MS },
    );

    // 6. Se guarda todo junto: aceptadas por fuente fiable o a revisión grupal.
    const results = rows.map((r) => {
      const found = external.get(resultKey(r.r_slug, r.r_answer));
      return found?.status === "accepted"
        ? { answer_id: r.r_answer_id, status: "accepted", decided_by: found.source }
        : { answer_id: r.r_answer_id, status: "in_review", decided_by: null };
    });
    const { error: applyError } = await admin.rpc("apply_validation", { p_round: roundId, p_results: results });
    if (applyError) throw applyError;

    return reply({
      ok: true,
      started: true,
      checked: rows.length,
      accepted: results.filter((r) => r.status === "accepted").length,
      inReview: results.filter((r) => r.status === "in_review").length,
    });
  } catch (e) {
    console.error("[wordix] error al validar la ronda", e);
    return reply({ error: "VALIDATION_FAILED" }, 500);
  }
}
