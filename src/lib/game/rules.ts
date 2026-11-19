// Constantes de la partida. Deben coincidir con
// supabase/migrations/20261116000003_partida.sql

/** Alfabeto de la ruleta (27 letras, con la ñ después de la n). */
export const LETTERS = "abcdefghijklmnñopqrstuvwxyz".split("");

/** Si el mano no gira la ruleta en este tiempo, cualquiera puede girarla. */
export const SPIN_WAIT_MS = 15_000;
/** Duración de la animación de la ruleta (igual para todos los jugadores). */
export const SPIN_ANIM_MS = 4_500;
/** Tiempo total de la votación de la letra, contado desde que se gira. */
export const VOTE_TOTAL_MS = 25_000;

/** Tiempo máximo por categoría (si queda más de una pendiente). */
export const CATEGORY_MS = 20_000;

/** Rondas que se pueden elegir al crear la sala. */
export const ROUND_OPTIONS = [3, 4, 5, 6, 7, 8, 9, 10] as const;
export const DEFAULT_ROUNDS = 3;
