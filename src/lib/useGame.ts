"use client";

import type { RealtimeChannel } from "@supabase/supabase-js";
import { useCallback, useEffect, useRef, useState } from "react";
import { fetchServerNow } from "./game/api";
import { getSupabase } from "./supabase/client";
import type { Game, GameCategory, LetterVote, MyAnswer, Round } from "./types";

/**
 * Estado de la partida de una sala: partida actual, ronda actual, la ronda
 * anterior (para avisar si se rechazó la letra) y los votos de la letra.
 * Se mantiene sincronizado con Realtime y con un refresco de respaldo cada 5 s.
 * "serverNow" es la hora del servidor (el reloj oficial de todas las fases).
 */
export function useGame(roomId: string, myId: string) {
  const [game, setGame] = useState<Game | null>(null);
  const [round, setRound] = useState<Round | null>(null);
  const [previousRound, setPreviousRound] = useState<Round | null>(null);
  const [votes, setVotes] = useState<LetterVote[]>([]);
  const [categories, setCategories] = useState<GameCategory[]>([]);
  const [myAnswers, setMyAnswers] = useState<MyAnswer[]>([]);
  const categoriesRef = useRef<{ gameId: string; list: GameCategory[] } | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [offset, setOffset] = useState(0);
  const [tick, setTick] = useState(() => Date.now());
  const aliveRef = useRef(true);

  const refresh = useCallback(async () => {
    try {
      const supabase = getSupabase();
      const { data: g, error: gameError } = await supabase
        .from("games")
        .select("*")
        .eq("room_id", roomId)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (gameError) throw gameError;
      if (!aliveRef.current) return;
      if (!g) {
        setGame(null);
        setRound(null);
        setPreviousRound(null);
        setVotes([]);
        setCategories([]);
        setMyAnswers([]);
        setLoaded(true);
        return;
      }

      const { data: rounds, error: roundsError } = await supabase
        .from("rounds")
        .select("*")
        .eq("game_id", g.id)
        .order("number", { ascending: false })
        .limit(2);
      if (roundsError) throw roundsError;

      const current = ((rounds ?? [])[0] as Round | undefined) ?? null;
      const previous = ((rounds ?? [])[1] as Round | undefined) ?? null;

      let nextVotes: LetterVote[] = [];
      if (current) {
        const { data: v, error: votesError } = await supabase
          .from("letter_votes")
          .select("*")
          .eq("round_id", current.id);
        if (votesError) throw votesError;
        nextVotes = (v ?? []) as LetterVote[];
      }

      // Las categorías de una partida no cambian: se piden una sola vez.
      if (categoriesRef.current?.gameId !== g.id) {
        const { data: cats, error: catsError } = await supabase
          .from("game_categories")
          .select("category_id, position, categories(name)")
          .eq("game_id", g.id)
          .order("position");
        if (catsError) throw catsError;
        const list = ((cats ?? []) as unknown as {
          category_id: number;
          position: number;
          categories: { name: string } | { name: string }[] | null;
        }[]).map((row) => ({
          category_id: row.category_id,
          position: row.position,
          name: (Array.isArray(row.categories) ? row.categories[0]?.name : row.categories?.name) ?? "",
        }));
        categoriesRef.current = { gameId: g.id, list };
      }

      let nextAnswers: MyAnswer[] = [];
      if (current && (current.status === "answering" || current.status === "reviewing")) {
        const { data: a, error: answersError } = await supabase
          .from("game_answers")
          .select("category_id, answer, status")
          .eq("round_id", current.id)
          .eq("player_id", myId);
        if (answersError) throw answersError;
        nextAnswers = (a ?? []) as MyAnswer[];
      }

      if (!aliveRef.current) return;
      setCategories(categoriesRef.current?.list ?? []);
      setMyAnswers(nextAnswers);
      setGame(g as Game);
      setRound(current);
      setPreviousRound(previous);
      setVotes(nextVotes);
      setLoaded(true);
    } catch (e) {
      console.error("[wordix] no se pudo actualizar la partida", e);
    }
  }, [roomId, myId]);

  const syncClock = useCallback(async () => {
    try {
      const before = Date.now();
      const server = await fetchServerNow();
      const after = Date.now();
      if (aliveRef.current) setOffset(server - (before + after) / 2);
    } catch (e) {
      console.error("[wordix] no se pudo sincronizar el reloj", e);
    }
  }, []);

  useEffect(() => {
    aliveRef.current = true;
    let channel: RealtimeChannel | null = null;
    const supabase = getSupabase();

    void syncClock();
    void refresh();

    channel = supabase
      .channel(`game-${roomId}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "games", filter: `room_id=eq.${roomId}` }, () => void refresh())
      .on("postgres_changes", { event: "*", schema: "public", table: "rounds" }, () => void refresh())
      .on("postgres_changes", { event: "*", schema: "public", table: "letter_votes" }, () => void refresh())
      .subscribe((status) => {
        if (status === "SUBSCRIBED") void refresh();
      });

    const poll = window.setInterval(() => void refresh(), 5000);
    const clock = window.setInterval(() => void syncClock(), 60_000);
    const ticker = window.setInterval(() => setTick(Date.now()), 200);

    function onVisible() {
      if (document.visibilityState === "visible") {
        void syncClock();
        void refresh();
      }
    }
    document.addEventListener("visibilitychange", onVisible);

    return () => {
      aliveRef.current = false;
      window.clearInterval(poll);
      window.clearInterval(clock);
      window.clearInterval(ticker);
      document.removeEventListener("visibilitychange", onVisible);
      if (channel) void supabase.removeChannel(channel);
    };
  }, [roomId, refresh, syncClock]);

  return { game, round, previousRound, votes, categories, myAnswers, loaded, offset, serverNow: tick + offset, refresh };
}
