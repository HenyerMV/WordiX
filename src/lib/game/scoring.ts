// Reglas de puntos y de clasificación. Módulo sin dependencias (se prueba con `npm test`).
// Los puntos los calcula de verdad la función SQL finish_round()
// (supabase/migrations/..._puntos_y_rondas.sql); esto replica la regla para las pruebas.

import { normalizeForSearch } from "./text.ts";

/** Palabra válida que también tienen otros jugadores en la misma categoría. */
export const POINTS_SHARED = 50;
/** Palabra válida que nadie más tiene. */
export const POINTS_UNIQUE = 100;

export interface ScorableAnswer {
  player_id: string;
  category_id: number;
  answer: string | null;
  status: string;
}

/** Puntos de cada respuesta de una ronda, por clave `${jugador}|${categoría}`. */
export function scoreRound(answers: ScorableAnswer[]): Map<string, number> {
  const valid = answers.filter((a) => a.status === "accepted" && a.answer);
  const counts = new Map<string, number>();
  for (const a of valid) {
    const key = `${a.category_id}|${normalizeForSearch(a.answer as string)}`;
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }

  const points = new Map<string, number>();
  for (const a of answers) {
    const key = `${a.player_id}|${a.category_id}`;
    if (a.status === "accepted" && a.answer) {
      const n = counts.get(`${a.category_id}|${normalizeForSearch(a.answer)}`) ?? 1;
      points.set(key, n >= 2 ? POINTS_SHARED : POINTS_UNIQUE);
    } else {
      points.set(key, 0);
    }
  }
  return points;
}

export interface Standing {
  player_id: string;
  total_points: number;
  /** Posición con empates: quienes igualan comparten lugar (1, 1, 3…). */
  position: number;
}

/** Ordena de mayor a menor puntaje y asigna posiciones (los empates comparten lugar). */
export function rankPlayers(rows: { player_id: string; total_points: number }[]): Standing[] {
  const sorted = [...rows].sort((a, b) => b.total_points - a.total_points);
  return sorted.map((row, index) => {
    const first = sorted.findIndex((r) => r.total_points === row.total_points);
    return { player_id: row.player_id, total_points: row.total_points, position: first + 1 };
  });
}
