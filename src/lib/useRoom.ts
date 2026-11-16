"use client";

import type { RealtimeChannel } from "@supabase/supabase-js";
import { useCallback, useEffect, useRef, useState } from "react";
import { friendlyError } from "./errors";
import { fetchMembers, fetchRoomById, joinRoom, leaveRoom } from "./rooms";
import { getSupabase } from "./supabase/client";
import type { Member, Room } from "./types";

export type Connection = "connecting" | "online" | "offline";
export type RoomPhase = "joining" | "ready" | "error";

/**
 * Entra a la sala (o se reconecta si ya era miembro), carga los jugadores y
 * los mantiene sincronizados con Supabase Realtime:
 *  - cambios en room_players / rooms  -> se recargan los datos
 *  - presencia                        -> quién está conectado ahora mismo
 * Pasa myId = null mientras el jugador todavía no está listo.
 */
export function useRoom(code: string, myId: string | null) {
  const [phase, setPhase] = useState<RoomPhase>("joining");
  const [error, setError] = useState<string | null>(null);
  const [room, setRoom] = useState<Room | null>(null);
  const [members, setMembers] = useState<Member[]>([]);
  const [onlineIds, setOnlineIds] = useState<Set<string>>(new Set());
  const [connection, setConnection] = useState<Connection>("connecting");
  const roomIdRef = useRef<string | null>(null);

  useEffect(() => {
    if (!myId) return;

    let cancelled = false;
    let channel: RealtimeChannel | null = null;
    const supabase = getSupabase();

    async function refresh(roomId: string) {
      try {
        const [list, fresh] = await Promise.all([fetchMembers(roomId), fetchRoomById(roomId)]);
        if (cancelled) return;
        setMembers(list);
        if (fresh) setRoom(fresh);
      } catch (e) {
        console.error("[wordix] no se pudo actualizar la sala", e);
      }
    }

    function onVisible() {
      if (document.visibilityState === "visible" && roomIdRef.current) {
        void refresh(roomIdRef.current);
      }
    }
    function onOffline() {
      setConnection("offline");
    }
    function onOnline() {
      if (roomIdRef.current) void refresh(roomIdRef.current);
    }

    document.addEventListener("visibilitychange", onVisible);
    window.addEventListener("offline", onOffline);
    window.addEventListener("online", onOnline);

    (async () => {
      try {
        setPhase("joining");
        setError(null);

        const joined = await joinRoom(code);
        if (cancelled) return;
        roomIdRef.current = joined.id;
        setRoom(joined);
        await refresh(joined.id);
        if (cancelled) return;
        setPhase("ready");

        channel = supabase
          .channel(`room-${joined.id}`, { config: { presence: { key: myId } } })
          .on(
            "postgres_changes",
            { event: "*", schema: "public", table: "room_players", filter: `room_id=eq.${joined.id}` },
            () => void refresh(joined.id),
          )
          .on(
            "postgres_changes",
            { event: "*", schema: "public", table: "rooms", filter: `id=eq.${joined.id}` },
            () => void refresh(joined.id),
          )
          .on("presence", { event: "sync" }, () => {
            if (!channel) return;
            setOnlineIds(new Set(Object.keys(channel.presenceState())));
            void refresh(joined.id);
          })
          .subscribe((status) => {
            if (cancelled) return;
            if (status === "SUBSCRIBED") {
              setConnection("online");
              void channel?.track({ at: new Date().toISOString() });
              void refresh(joined.id);
            } else if (status === "CHANNEL_ERROR" || status === "TIMED_OUT" || status === "CLOSED") {
              setConnection("offline");
            }
          });
      } catch (e) {
        if (cancelled) return;
        console.error("[wordix] no se pudo entrar a la sala", e);
        setError(friendlyError(e));
        setPhase("error");
      }
    })();

    return () => {
      cancelled = true;
      document.removeEventListener("visibilitychange", onVisible);
      window.removeEventListener("offline", onOffline);
      window.removeEventListener("online", onOnline);
      if (channel) void supabase.removeChannel(channel);
    };
  }, [code, myId]);

  const leave = useCallback(async () => {
    if (roomIdRef.current) await leaveRoom(roomIdRef.current);
  }, []);

  return { phase, error, room, members, onlineIds, connection, leave };
}
