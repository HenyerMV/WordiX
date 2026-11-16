"use client";

import { useEffect, useRef, useState } from "react";
import { friendlyError } from "@/lib/errors";
import { pressStop, saveAnswers, type AnswerMap } from "@/lib/game/api";
import { ANSWER_GRACE_MS, STOP_WAIT_MS } from "@/lib/game/rules";
import { finalizeInput, sanitizeInput, startsWithLetter } from "@/lib/game/text";
import type { GameCategory, MyAnswer, Round } from "@/lib/types";

interface AnswerFormProps {
  round: Round;
  categories: GameCategory[];
  savedAnswers: MyAnswer[];
  serverNow: number;
  stopperName: string | null;
  iStopped: boolean;
  onChanged: () => void;
}

const AUTOSAVE_MS = 1200;
const WORD_MAX = 40;

export function AnswerForm({
  round,
  categories,
  savedAnswers,
  serverNow,
  stopperName,
  iStopped,
  onChanged,
}: AnswerFormProps) {
  const letter = round.letter ?? "";
  const [values, setValues] = useState<Record<number, string>>({});
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const hydrated = useRef(false);
  const dirty = useRef(false);
  const finalSent = useRef(false);
  const valuesRef = useRef(values);
  valuesRef.current = values;

  // Recupera lo ya guardado (por ejemplo, si el jugador recargó la página).
  useEffect(() => {
    if (hydrated.current || savedAnswers.length === 0) return;
    hydrated.current = true;
    const restored: Record<number, string> = {};
    for (const a of savedAnswers) if (a.answer) restored[a.category_id] = a.answer;
    setValues(restored);
  }, [savedAnswers]);

  function payload(): AnswerMap {
    const out: AnswerMap = {};
    for (const c of categories) out[c.category_id] = finalizeInput(valuesRef.current[c.category_id] ?? "");
    return out;
  }

  // Guardado automático mientras escribe.
  useEffect(() => {
    if (!dirty.current) return;
    const timer = window.setTimeout(() => {
      dirty.current = false;
      saveAnswers(round.id, payload()).catch((e) => console.error("[wordix] no se pudo guardar", e));
    }, AUTOSAVE_MS);
    return () => window.clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [values, round.id]);

  const stoppedAt = round.stopped_at ? Date.parse(round.stopped_at) : null;
  const msLeft = stoppedAt ? stoppedAt + STOP_WAIT_MS - serverNow : null;

  // Al llegar a 0 cada cliente envía lo último que escribió (el servidor da un margen).
  useEffect(() => {
    if (!stoppedAt || finalSent.current) return;
    if (serverNow < stoppedAt + STOP_WAIT_MS) return;
    finalSent.current = true;
    saveAnswers(round.id, payload())
      .catch((e) => console.error("[wordix] no se pudo enviar lo último", e))
      .finally(() => onChanged());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  });

  const closed = msLeft !== null && msLeft <= -ANSWER_GRACE_MS;
  const allValid = categories.length > 0 && categories.every((c) => {
    const v = finalizeInput(values[c.category_id] ?? "");
    return v !== "" && startsWithLetter(v, letter);
  });

  async function onStop() {
    if (busy) return;
    setBusy(true);
    setError(null);
    try {
      await pressStop(round.id, payload());
      dirty.current = false;
      onChanged();
    } catch (e) {
      console.error("[wordix] STOP falló", e);
      setError(friendlyError(e));
      onChanged();
    } finally {
      setBusy(false);
    }
  }

  const stopped = round.stopped_by !== null;

  return (
    <div className="flex w-full flex-col gap-4 text-left">
      <div className="flex items-center justify-between gap-3">
        <p className="text-mist">
          Escribe una palabra por categoría que empiece con{" "}
          <span className="font-display text-xl font-bold text-volt">{letter.toUpperCase()}</span>
        </p>
        {stopped && msLeft !== null ? (
          <span
            role="timer"
            aria-live="polite"
            className="rounded-xl bg-bubble/15 px-3 py-1 font-display text-lg font-bold text-bubble"
          >
            {Math.max(0, Math.ceil(msLeft / 1000))} s
          </span>
        ) : null}
      </div>

      {stopped ? (
        <p role="status" className="rounded-xl bg-bubble/15 px-4 py-3 text-bubble">
          {iStopped ? "¡Diste STOP!" : `¡${stopperName ?? "Alguien"} dio STOP!`} Todos tienen 20 segundos para terminar.
        </p>
      ) : null}

      <ul className="grid gap-3 sm:grid-cols-2">
        {categories.map((c) => {
          const v = values[c.category_id] ?? "";
          const bad = v.trim() !== "" && !startsWithLetter(v.trim(), letter);
          const id = `cat-${c.category_id}`;
          return (
            <li key={c.category_id} className="flex flex-col gap-1">
              <label htmlFor={id} className="text-sm font-medium text-mist">
                {c.name}
              </label>
              <input
                id={id}
                type="text"
                value={v}
                disabled={closed}
                onChange={(e) => {
                  dirty.current = true;
                  const next = sanitizeInput(e.target.value, WORD_MAX);
                  setValues((prev) => ({ ...prev, [c.category_id]: next }));
                }}
                autoComplete="off"
                autoCapitalize="none"
                autoCorrect="off"
                spellCheck={false}
                placeholder={`con ${letter}…`}
                className="field"
                aria-invalid={bad}
              />
              {bad ? <span className="text-xs text-bubble">Debe empezar con {letter.toUpperCase()}.</span> : null}
            </li>
          );
        })}
      </ul>

      <div className="flex flex-col items-center gap-2">
        {!stopped ? (
          <button type="button" className="btn-primary text-xl" disabled={!allValid || busy} onClick={onStop}>
            ¡STOP!
          </button>
        ) : null}
        {!stopped && !allValid ? (
          <p className="text-sm text-mist">STOP se activa cuando completes todas las categorías.</p>
        ) : null}
        {closed ? <p className="text-mist">Se acabó el tiempo. Enviando respuestas…</p> : null}
        {error ? (
          <p role="alert" className="rounded-xl bg-bubble/15 px-4 py-3 text-bubble">
            {error}
          </p>
        ) : null}
      </div>
    </div>
  );
}
