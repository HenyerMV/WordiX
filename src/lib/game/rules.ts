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

/** Cuenta regresiva para todos desde que alguien da STOP. */
export const STOP_WAIT_MS = 20_000;
/** Margen para que cada cliente envíe lo último que escribió. */
export const ANSWER_GRACE_MS = 2_000;
/** Tope de la fase de escritura si nadie da STOP. */
export const ANSWER_MAX_MS = 180_000;
