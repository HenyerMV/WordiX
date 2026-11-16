"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { friendlyError } from "@/lib/errors";
import { validateName } from "@/lib/game/text";
import { getSupabase } from "@/lib/supabase/client";
import { ensureSession } from "@/lib/supabase/session";
import type { Player } from "@/lib/types";

export type PlayerStatus = "loading" | "needs_name" | "ready" | "error";

interface PlayerContextValue {
  status: PlayerStatus;
  player: Player | null;
  error: string | null;
  /** Guarda o cambia el nombre. Devuelve un mensaje de error o null. */
  saveName: (raw: string) => Promise<string | null>;
  retry: () => void;
}

const PlayerContext = createContext<PlayerContextValue | null>(null);

/**
 * Mantiene la sesión anónima de Supabase y el perfil del jugador (su nombre).
 * La sesión se guarda en el navegador, así que al recargar la página el
 * jugador sigue siendo el mismo y puede volver a su sala.
 */
export function PlayerProvider({ children }: { children: ReactNode }) {
  const [status, setStatus] = useState<PlayerStatus>("loading");
  const [player, setPlayer] = useState<Player | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let cancelled = false;

    (async () => {
      try {
        setStatus("loading");
        setError(null);

        const userId = await ensureSession();
        const { data, error: queryError } = await getSupabase()
          .from("players")
          .select("*")
          .eq("id", userId)
          .maybeSingle();
        if (cancelled) return;
        if (queryError) throw queryError;

        if (data) {
          setPlayer(data as Player);
          setStatus("ready");
        } else {
          setPlayer(null);
          setStatus("needs_name");
        }
      } catch (e) {
        console.error("[wordix] no se pudo iniciar la sesión", e);
        if (cancelled) return;
        setError("No pudimos conectarnos a WordiX. Revisa tu conexión e inténtalo de nuevo.");
        setStatus("error");
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [attempt]);

  const saveName = useCallback(async (raw: string): Promise<string | null> => {
    const check = validateName(raw);
    if (!check.ok) return check.error;

    try {
      await ensureSession();
      const { data, error: rpcError } = await getSupabase().rpc("ensure_player", {
        p_username: check.value,
      });
      if (rpcError) throw rpcError;
      setPlayer(data as Player);
      setStatus("ready");
      return null;
    } catch (e) {
      console.error("[wordix] no se pudo guardar el nombre", e);
      return friendlyError(e);
    }
  }, []);

  const retry = useCallback(() => setAttempt((n) => n + 1), []);

  const value = useMemo(
    () => ({ status, player, error, saveName, retry }),
    [status, player, error, saveName, retry],
  );

  return <PlayerContext.Provider value={value}>{children}</PlayerContext.Provider>;
}

export function usePlayer(): PlayerContextValue {
  const context = useContext(PlayerContext);
  if (!context) throw new Error("usePlayer debe usarse dentro de <PlayerProvider>.");
  return context;
}
