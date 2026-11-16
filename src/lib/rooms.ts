import { getSupabase } from "./supabase/client";
import type { Member, Room } from "./types";

// Todas las operaciones que cambian datos pasan por funciones SQL seguras
// (supabase/migrations/..._juego.sql). Aquí solo se llaman y se leen datos.

export async function createRoom(): Promise<Room> {
  const { data, error } = await getSupabase().rpc("create_room");
  if (error) throw error;
  return data as Room;
}

/** Entra a una sala por código. Si ya eres miembro, devuelve la sala (reconexión). */
export async function joinRoom(code: string): Promise<Room> {
  const { data, error } = await getSupabase().rpc("join_room", { p_code: code });
  if (error) throw error;
  return data as Room;
}

export async function leaveRoom(roomId: string): Promise<void> {
  const { error } = await getSupabase().rpc("leave_room", { p_room: roomId });
  if (error) throw error;
}

export async function fetchRoomById(roomId: string): Promise<Room | null> {
  const { data, error } = await getSupabase()
    .from("rooms")
    .select("*")
    .eq("id", roomId)
    .maybeSingle();
  if (error) throw error;
  return (data as Room | null) ?? null;
}

interface MemberRow {
  player_id: string;
  seat: number;
  players: { username: string } | { username: string }[] | null;
}

export async function fetchMembers(roomId: string): Promise<Member[]> {
  const { data, error } = await getSupabase()
    .from("room_players")
    .select("player_id, seat, players(username)")
    .eq("room_id", roomId)
    .order("seat", { ascending: true });
  if (error) throw error;

  return ((data ?? []) as unknown as MemberRow[]).map((row) => {
    const player = Array.isArray(row.players) ? row.players[0] : row.players;
    return {
      playerId: row.player_id,
      username: player?.username ?? "jugador",
      seat: row.seat,
    };
  });
}
