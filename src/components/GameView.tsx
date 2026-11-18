"use client";

import { useEffect, useRef, useState } from "react";
import { AnswerForm } from "@/components/AnswerForm";
import { ReviewView } from "@/components/ReviewView";
import { Wheel } from "@/components/Wheel";
import { Spinner } from "@/components/Screen";
import { resolveLetterVote, spinRound, validateRound, voteLetter } from "@/lib/game/api";
import { SPIN_ANIM_MS, SPIN_WAIT_MS, VOTE_TOTAL_MS } from "@/lib/game/rules";
import { friendlyError } from "@/lib/errors";
import { seatStyle } from "@/lib/seatStyles";
import type { Member, Room } from "@/lib/types";
import { useGame } from "@/lib/useGame";

interface GameViewProps {
  room: Room;
  members: Member[];
  myId: string;
  onExit: () => void;
}

const seconds = (ms: number) => Math.max(0, Math.ceil(ms / 1000));

export function GameView({ room, members, myId, onExit }: GameViewProps) {
  const { round, previousRound, votes, categories, myAnswers, progress, endVotes, roundAnswers, reviews, loaded, offset, serverNow, refresh } = useGame(room.id, myId);
  const [busy, setBusy] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const lastResolve = useRef<{ id: string; at: number } | null>(null);
  const lastValidate = useRef<{ id: string; at: number } | null>(null);

  const nameOf = (playerId: string) =>
    members.find((m) => m.playerId === playerId)?.username ?? "jugador";

  const memberIds = new Set(members.map((m) => m.playerId));
  const roundVotes = votes.filter((v) => memberIds.has(v.player_id));
  const startedAt = round ? Date.parse(round.phase_started_at) : 0;
  const elapsed = serverNow - startedAt;
  const status = round?.status;

  // Cierra la votación cuando votaron todos (pasada la animación) o venció el tiempo.
  // Cualquier cliente puede hacerlo; el servidor decide y es idempotente.
  useEffect(() => {
    if (!round || round.status !== "letter_vote") return;
    const allVoted = roundVotes.length >= members.length && elapsed >= SPIN_ANIM_MS;
    const timeUp = elapsed >= VOTE_TOTAL_MS + 400;
    if (!allVoted && !timeUp) return;
    const last = lastResolve.current;
    if (last && last.id === round.id && Date.now() - last.at < 2000) return;
    lastResolve.current = { id: round.id, at: Date.now() };
    resolveLetterVote(round.id)
      .then(() => refresh())
      .catch((e) => console.error("[wordix] no se pudo cerrar la votación", e));
  });

  // Al pasar a revisión se piden las validaciones al servidor. Es seguro que lo pidan
  // varios jugadores: el servidor atiende a uno solo. Se reintenta si algo quedó pendiente.
  useEffect(() => {
    if (!round || round.status !== "reviewing") return;
    if (!roundAnswers.some((a) => a.status === "pending" && a.answer)) return;
    const last = lastValidate.current;
    if (last && last.id === round.id && Date.now() - last.at < 15_000) return;
    lastValidate.current = { id: round.id, at: Date.now() };
    validateRound(round.id)
      .then(() => refresh())
      .catch((e) => console.error("[wordix] no se pudo validar la ronda", e));
  });

  async function run(action: () => Promise<unknown>) {
    if (busy) return;
    setBusy(true);
    setActionError(null);
    try {
      await action();
      await refresh();
    } catch (e) {
      console.error("[wordix] acción de partida falló", e);
      setActionError(friendlyError(e));
    } finally {
      setBusy(false);
    }
  }

  if (!loaded || !round) {
    return <Spinner label="Preparando la partida…" />;
  }

  const handName = nameOf(round.hand_player_id);
  const iAmHand = round.hand_player_id === myId;
  const myVote = votes.find((v) => v.player_id === myId)?.accept;
  const letter = round.letter ? round.letter.toUpperCase() : null;
  const spinStartedAt = status === "spinning" ? null : startedAt;

  return (
    <>
      <header className="flex items-center justify-between gap-3">
        <div>
          <p className="text-sm uppercase tracking-widest text-mist">Sala {room.code}</p>
          <h1 className="font-display text-2xl font-bold">Ronda {round.number}</h1>
        </div>
        <button type="button" className="btn-ghost" onClick={onExit}>
          Inicio
        </button>
      </header>

      <ul className="grid grid-cols-2 gap-2 sm:grid-cols-4" aria-label="Jugadores">
        {members.map((m) => {
          const style = seatStyle(m.seat);
          const isHand = m.playerId === round.hand_player_id;
          const voted = status === "letter_vote" && votes.some((v) => v.player_id === m.playerId);
          return (
            <li
              key={m.playerId}
              className={`flex items-center gap-2 rounded-2xl bg-ink-700 p-2 ring-2 ${
                isHand ? "ring-sun" : "ring-transparent"
              }`}
            >
              <span
                aria-hidden="true"
                className={`inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg font-display text-lg font-bold uppercase ${style.tile}`}
              >
                {m.username.charAt(0)}
              </span>
              <span className="min-w-0 text-sm">
                <span className="block truncate font-bold">
                  {m.username}
                  {m.playerId === myId ? " (tú)" : ""}
                </span>
                <span className="block text-xs text-mist">
                  {isHand
                    ? "mano"
                    : voted
                      ? "ya votó"
                      : status === "answering" && progress.some((p) => p.player_id === m.playerId && p.finished)
                        ? "terminó"
                        : "\u00A0"}
                </span>
              </span>
            </li>
          );
        })}
      </ul>

      {status === "spinning" && previousRound?.status === "letter_rejected" && previousRound.letter ? (
        <p role="status" className="rounded-xl bg-bubble/15 px-4 py-3 text-center text-bubble">
          Se rechazó la letra {previousRound.letter.toUpperCase()}. Nuevo mano: {handName}.
        </p>
      ) : null}

      <section className="card flex flex-col items-center gap-5 text-center">
        <Wheel letter={status === "spinning" ? null : round.letter} startedAtMs={spinStartedAt} offsetMs={offset} />

        {status === "spinning" ? (
          <SpinControls
            iAmHand={iAmHand}
            handName={handName}
            waitedMs={elapsed}
            busy={busy}
            onSpin={() => run(() => spinRound(round.id))}
          />
        ) : null}

        {status === "letter_vote" ? (
          elapsed < SPIN_ANIM_MS ? (
            <p className="font-display text-xl font-bold" aria-live="polite">
              Girando…
            </p>
          ) : (
            <div className="flex w-full flex-col items-center gap-4">
              <p className="text-mist">Salió la letra</p>
              <span className="inline-flex h-24 w-20 items-center justify-center rounded-2xl bg-paper font-display text-6xl font-bold text-ink-900 shadow-[0_5px_0_0_rgba(0,0,0,0.35)] animate-pop-in">
                {letter}
              </span>
              <p className="text-lg">¿Jugamos con esta letra?</p>
              <div className="flex flex-wrap justify-center gap-3">
                <button
                  type="button"
                  className={myVote === true ? "btn-primary" : "btn-ghost"}
                  aria-pressed={myVote === true}
                  disabled={busy}
                  onClick={() => run(() => voteLetter(round.id, true))}
                >
                  Sí, jugar
                </button>
                <button
                  type="button"
                  className={myVote === false ? "btn-primary" : "btn-ghost"}
                  aria-pressed={myVote === false}
                  disabled={busy}
                  onClick={() => run(() => voteLetter(round.id, false))}
                >
                  No, otra letra
                </button>
              </div>
              <p className="text-sm text-mist" aria-live="polite">
                Votaron {roundVotes.length} de {members.length} · quedan {seconds(VOTE_TOTAL_MS - elapsed)} s ·
                si hay empate decide {iAmHand ? "tu voto" : `el voto de ${handName}`}
              </p>
            </div>
          )
        ) : null}

        {status === "answering" ? (
          <AnswerForm
            key={round.id}
            round={round}
            categories={categories}
            myAnswers={myAnswers}
            myProgress={progress.find((p) => p.player_id === myId) ?? null}
            endVotes={endVotes}
            memberCount={members.length}
            myId={myId}
            serverNow={serverNow}
            onChanged={() => void refresh()}
          />
        ) : null}

        {status === "reviewing" ? (
          <div className="flex w-full flex-col items-center gap-4">
            <p className="font-display text-xl font-bold">
              {round.stopped_by ? `${nameOf(round.stopped_by)} dio STOP` : "La ronda terminó por acuerdo"}
            </p>
            <ReviewView
              categories={categories}
              answers={roundAnswers}
              reviews={reviews}
              players={members.map((m) => ({ id: m.playerId, name: m.username }))}
              myId={myId}
            />
          </div>
        ) : null}
      </section>

      {actionError ? (
        <p role="alert" className="rounded-xl bg-bubble/15 px-4 py-3 text-bubble">
          {actionError}
        </p>
      ) : null}
    </>
  );
}

function SpinControls({
  iAmHand,
  handName,
  waitedMs,
  busy,
  onSpin,
}: {
  iAmHand: boolean;
  handName: string;
  waitedMs: number;
  busy: boolean;
  onSpin: () => void;
}) {
  const canAnyoneSpin = waitedMs >= SPIN_WAIT_MS;
  if (iAmHand) {
    return (
      <div className="flex flex-col items-center gap-2">
        <p className="text-mist">Eres el mano de esta ronda</p>
        <button type="button" className="btn-primary text-xl" disabled={busy} onClick={onSpin}>
          Girar la ruleta
        </button>
      </div>
    );
  }
  if (canAnyoneSpin) {
    return (
      <div className="flex flex-col items-center gap-2">
        <p className="text-mist">{handName} no giró la ruleta. Ahora puede hacerlo cualquiera.</p>
        <button type="button" className="btn-primary text-xl" disabled={busy} onClick={onSpin}>
          Girar la ruleta
        </button>
      </div>
    );
  }
  return (
    <p className="text-mist" aria-live="polite">
      Esperando a que {handName} gire la ruleta… ({seconds(SPIN_WAIT_MS - waitedMs)} s)
    </p>
  );
}
