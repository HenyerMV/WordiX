"use client";

import { useEffect, useRef, useState } from "react";
import { friendlyError } from "@/lib/errors";
import { expireCategory, pressStop, skipCategory, startMyTurn, submitAnswer, voteEndRound } from "@/lib/game/api";
import { CATEGORY_MS } from "@/lib/game/rules";
import { finalizeInput, sanitizeInput, startsWithLetter } from "@/lib/game/text";
import type { AnswerProgress, EndVote, GameCategory, MyAnswer, Round } from "@/lib/types";

interface AnswerFormProps {
  round: Round;
  categories: GameCategory[];
  myAnswers: MyAnswer[];
  myProgress: AnswerProgress | null;
  endVotes: EndVote[];
  memberCount: number;
  myId: string;
  serverNow: number;
  onChanged: () => void;
}

const WORD_MAX = 40;
/** Margen para no pedir "se acabó el tiempo" antes de que el servidor lo acepte. */
const EXPIRE_MARGIN_MS = 300;

export function AnswerForm({
  round,
  categories,
  myAnswers,
  myProgress,
  endVotes,
  memberCount,
  myId,
  serverNow,
  onChanged,
}: AnswerFormProps) {
  const letter = round.letter ?? "";
  const [value, setValue] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const valueRef = useRef(value);
  valueRef.current = value;
  const handled = useRef<string | null>(null);
  const starting = useRef(false);

  const hasProgress = myProgress !== null;
  const turnKey = myProgress ? `${myProgress.category_id}-${myProgress.opened_at}` : null;

  // Al entrar a la fase de respuestas se crea el avance del jugador (categoría 1).
  useEffect(() => {
    if (hasProgress || starting.current) return;
    starting.current = true;
    startMyTurn(round.id)
      .then(() => onChanged())
      .catch((e) => {
        console.error("[wordix] no se pudo empezar a responder", e);
        starting.current = false;
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hasProgress, round.id]);

  // Cada categoría nueva empieza con el campo vacío.
  useEffect(() => {
    setValue("");
    setError(null);
  }, [turnKey]);

  const answered = myAnswers.filter((a) => a.answer && a.status !== "rejected").length;
  const pending = categories.length - answered;
  const limited = pending > 1;
  const openedAt = myProgress ? Date.parse(myProgress.opened_at) : 0;
  const msLeft = limited && myProgress && !myProgress.finished ? openedAt + CATEGORY_MS - serverNow : null;

  const current = categories.find((c) => c.category_id === myProgress?.category_id) ?? null;
  const currentIndex = current ? categories.indexOf(current) + 1 : 0;

  // Se acabó el tiempo: si lo escrito es válido se envía; si no, se avanza (queda pendiente).
  useEffect(() => {
    if (!myProgress || myProgress.finished || !current || msLeft === null) return;
    if (msLeft > -EXPIRE_MARGIN_MS || handled.current === turnKey) return;
    handled.current = turnKey;
    const word = finalizeInput(valueRef.current);
    const categoryId = current.category_id;
    const attempt =
      word && startsWithLetter(word, letter)
        ? submitAnswer(round.id, categoryId, word).catch(() => expireCategory(round.id, categoryId))
        : expireCategory(round.id, categoryId);
    attempt.catch((e) => console.error("[wordix] no se pudo avanzar al acabar el tiempo", e)).finally(() => onChanged());
  });

  async function run(action: () => Promise<unknown>) {
    if (busy) return;
    setBusy(true);
    setError(null);
    try {
      await action();
    } catch (e) {
      console.error("[wordix] acción falló", e);
      setError(friendlyError(e));
    } finally {
      onChanged();
      setBusy(false);
    }
  }

  const word = finalizeInput(value);
  const wrongLetter = word !== "" && !startsWithLetter(word, letter);
  const canSubmit = word !== "" && !wrongLetter;
  const iVotedEnd = endVotes.some((v) => v.player_id === myId);

  const endBox = (
    <div className="mt-auto flex flex-col items-center gap-1 border-t border-white/10 pt-3 text-center">
      <button type="button" className="btn-ghost text-sm" disabled={busy} onClick={() => run(() => voteEndRound(round.id, !iVotedEnd))}>
        {iVotedEnd ? "Quitar mi voto para terminar" : "Terminar la ronda"}
      </button>
      <p className="text-xs text-mist" aria-live="polite">
        {endVotes.length} de {memberCount} quieren terminar. La ronda acaba cuando todos estén de acuerdo.
      </p>
    </div>
  );

  if (!myProgress) {
    return <p className="text-mist">Preparando tus categorías…</p>;
  }

  if (myProgress.finished) {
    return (
      <div className="flex w-full flex-col items-center gap-4 text-center">
        <p className="font-display text-xl font-bold">¡Completaste todas las categorías!</p>
        <p className="max-w-sm text-mist">Si das STOP, la fase de respuestas termina ya para todos.</p>
        <button type="button" className="btn-primary text-xl" disabled={busy} onClick={() => run(() => pressStop(round.id))}>
          ¡STOP!
        </button>
        {error ? (
          <p role="alert" className="rounded-xl bg-bubble/15 px-4 py-3 text-bubble">
            {error}
          </p>
        ) : null}
      </div>
    );
  }

  return (
    <div className="flex min-h-0 w-full flex-1 flex-col gap-3 text-left">
      <div className="flex items-center justify-between gap-3">
        <p className="text-sm text-mist">
          Letra <span className="font-display text-lg font-bold text-volt">{letter.toUpperCase()}</span> · categoría{" "}
          {currentIndex} de {categories.length}
          {myProgress.pass > 1 ? " · pendientes" : ""}
        </p>
        {msLeft !== null ? (
          <span role="timer" className="rounded-xl bg-bubble/15 px-3 py-1 font-display text-lg font-bold text-bubble">
            {Math.max(0, Math.ceil(msLeft / 1000))} s
          </span>
        ) : (
          <span className="rounded-xl bg-sky/15 px-3 py-1 text-sm font-bold text-sky">Sin límite de tiempo</span>
        )}
      </div>

      <form
        className="flex flex-col gap-3"
        onSubmit={(e) => {
          e.preventDefault();
          if (!canSubmit || !current) return;
          void run(() => submitAnswer(round.id, current.category_id, word));
        }}
      >
        <label htmlFor="answer" className="font-display text-3xl font-bold">
          {current?.name ?? "…"}
        </label>
        <input
          id="answer"
          type="text"
          value={value}
          onChange={(e) => setValue(sanitizeInput(e.target.value, WORD_MAX))}
          autoFocus
          autoComplete="off"
          autoCapitalize="none"
          autoCorrect="off"
          spellCheck={false}
          enterKeyHint="send"
          placeholder={`algo con ${letter}…`}
          className="field"
          aria-invalid={wrongLetter}
        />
        {wrongLetter ? <p className="text-sm text-bubble">Debe empezar con {letter.toUpperCase()}.</p> : null}
        <div className="flex flex-wrap gap-3">
          <button type="submit" className="btn-primary" disabled={!canSubmit || busy}>
            Enviar y seguir
          </button>
          <button
            type="button"
            className="btn-ghost"
            disabled={busy || !current}
            onClick={() => current && run(() => skipCategory(round.id, current.category_id))}
          >
            Saltar
          </button>
        </div>
      </form>

      <p className="text-sm text-mist">
        Respondidas {answered} de {categories.length}
        {pending > 0 ? ` · pendientes ${pending}` : ""}
      </p>

      {error ? (
        <p role="alert" className="rounded-xl bg-bubble/15 px-4 py-3 text-bubble">
          {error}
        </p>
      ) : null}

      {endBox}
    </div>
  );
}
