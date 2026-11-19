// Las funciones SQL de Supabase lanzan errores con un código en el mensaje
// (por ejemplo ROOM_FULL). Aquí se traducen a mensajes para el jugador.
const MESSAGES: Record<string, string> = {
  NOT_AUTHENTICATED: "Tu sesión no está activa. Recarga la página e inténtalo de nuevo.",
  NO_PLAYER: "Primero escribe tu nombre.",
  INVALID_NAME: "Usa solo letras minúsculas, sin números ni símbolos (2 a 16 caracteres).",
  INVALID_CODE: "El código debe tener 6 números.",
  ROOM_NOT_FOUND: "No existe una sala con ese código.",
  ROOM_FULL: "La sala está llena (máximo 4 jugadores).",
  ROOM_STARTED: "La partida de esa sala ya comenzó.",
  NOT_HOST: "Solo el anfitrión puede empezar la partida.",
  NOT_ENOUGH_PLAYERS: "Se necesitan al menos 2 jugadores para empezar.",
  NO_CATEGORIES: "No hay categorías activas para jugar.",
  ROUND_NOT_FOUND: "No encontramos la ronda. Recarga la página.",
  NOT_MEMBER: "No eres parte de esta sala.",
  WRONG_PHASE: "Esa acción ya no está disponible en esta fase.",
  ONLY_HAND_CAN_SPIN: "Todavía solo el jugador mano puede girar la ruleta.",
  VOTE_NOT_READY: "La votación todavía no termina.",
  INVALID_VOTE: "Voto no válido.",
  TIME_UP: "Se acabó el tiempo de esa categoría.",
  TIME_NOT_UP: "Todavía queda tiempo en esa categoría.",
  NOT_CURRENT_CATEGORY: "Esa categoría ya no es la actual.",
  INVALID_ANSWER: "Escribe una palabra con solo letras minúsculas.",
  WRONG_LETTER: "La palabra debe empezar con la letra de la ronda.",
  INCOMPLETE_ANSWERS: "Para dar STOP debes completar todas las categorías.",
  REVIEW_NOT_FOUND: "Esa palabra ya no está en revisión.",
  REVIEW_CLOSED: "Esa palabra ya fue decidida.",
  AUTHOR_CANNOT_VOTE: "No puedes votar tu propia palabra.",
  ALREADY_VOTED: "Ya votaste esta palabra.",
  INVALID_ROUNDS: "Elige entre 1 y 10 rondas.",
  REVIEW_NOT_DONE: "Todavía hay palabras por revisar.",
  GAME_FINISHED: "La partida ya terminó.",
  CODE_GENERATION_FAILED: "No pudimos crear el código de la sala. Inténtalo otra vez.",
};

function messageOf(error: unknown): string {
  if (error instanceof Error) return error.message;
  if (typeof error === "object" && error !== null && "message" in error) {
    return String((error as { message: unknown }).message);
  }
  return String(error);
}

export function friendlyError(error: unknown): string {
  const text = messageOf(error);
  for (const [code, message] of Object.entries(MESSAGES)) {
    if (text.includes(code)) return message;
  }
  return "Algo salió mal. Inténtalo de nuevo.";
}
