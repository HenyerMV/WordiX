"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { AnswerForm } from "@/components/AnswerForm";
import { FinalResults } from "@/components/FinalResults";
import { ReviewView } from "@/components/ReviewView";
import { RoundResults } from "@/components/RoundResults";
import { Wheel } from "@/components/Wheel";
import { Spinner } from "@/components/Screen";
import { finishRound, resolveLetterVote, spinRound, startNextRound, validateRound, voteLetter } from "@/lib/game/api";
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
  const { game, results, finishedRounds, round, previousRound, votes, categories, myAnswers, progress, endVotes, roundAnswers, reviews, wordVotes, loaded, offset, serverNow, refresh } = useGame(room.id, myId);
  const [busy, setBusy] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const lastResolve = useRef<{ id: string; at: number } | null>(null);
  const lastValidate = useRef<{ id: string; at: number } | null>(null);
  const lastFinish = useRef<{ id: string; at: number } | null>(null);

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

  // Cuando la revisión termina (nada pendiente ni en votación) se cierra la ronda y se
  // reparten los puntos. Cualquier jugador puede pedirlo; el servidor decide y es idempotente.
  useEffect(() => {
    if (!round || round.status !== "reviewing") return;
    if (roundAnswers.some((a) => (a.status === "pending" || a.status === "in_review") && a.answer)) return;
    if (roundAnswers.length === 0 && elapsed < 6000) return; // aún no llegaron las respuestas
    const last = lastFinish.current;
    if (last && last.id === round.id && Date.now() - last.at < 5000) return;
    lastFinish.current = { id: round.id, at: Date.now() };
    finishRound(round.id)
      .then(() => refresh())
      .catch((e) => console.error("[wordix] no se pudo cerrar la ronda", e));
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
  const players = members.map((m) => ({ id: m.playerId, name: m.username }));
  const pointsOf = (playerId: string) => results.find((r) => r.player_id === playerId)?.total_points ?? 0;
  const totalRounds = room.total_rounds;
  const shownRound = Math.min(status === "finished" ? finishedRounds : finishedRounds + 1, totalRounds);

  if (game?.status === "finished") {
    return (
      <GameShell>
        <header className="flex shrink-0 items-center justify-between gap-2">
          <p className="text-xs uppercase tracking-widest text-mist">Sala {room.code}</p>
        </header>
        <FinalResults players={players} results={results} myId={myId} totalRounds={totalRounds} onExit={onExit} />
      </GameShell>
    );
  }

  const showLetterChip = Boolean(letter) && (status === "answering" || status === "reviewing" || status === "finished");
  const showWheel = status === "spinning" || status === "letter_vote";

  return (
    <GameShell>
      <header className="flex shrink-0 items-center justify-between gap-2">
        <div className="min-w-0">
          <p className="truncate text-xs uppercase tracking-widest text-mist">Sala {room.code}</p>
          <h1 className="font-display text-xl font-bold leading-tight">
            Ronda {shownRound} de {totalRounds}
          </h1>
        </div>
        <div className="flex items-center gap-2">
          {showLetterChip ? (
            <span
              className="inline-flex h-10 w-10 items-center justify-center rounded-2xl bg-volt font-display text-xl font-bold text-ink-900"
              aria-label={`Letra de la ronda: ${letter}`}
            >
              {letter}
            </span>
          ) : null}
          <span
            className="inline-flex h-10 items-center gap-2 rounded-2xl bg-paper px-3 text-ink-900"
            aria-label={`Tu puntaje: ${pointsOf(myId)} puntos`}
          >
            <span className="text-[10px] font-bold uppercase leading-none tracking-wide">Puntos</span>
            <span className="font-display text-xl font-bold leading-none">{pointsOf(myId)}</span>
          </span>
          <button type="button" className="btn-ghost !h-10 !px-4 !py-0 text-sm" onClick={onExit}>
            Inicio
          </button>
        </div>
      </header>

      <ul className="grid shrink-0 gap-1.5" style={{ gridTemplateColumns: `repeat(${members.length}, minmax(0, 1fr))` }} aria-label="Jugadores">
        {members.map((m) => {
          const style = seatStyle(m.seat);
          const isHand = m.playerId === round.hand_player_id;
          const voted = status === "letter_vote" && votes.some((v) => v.player_id === m.playerId);
          const note = isHand
            ? "mano"
            : voted
              ? "ya votó"
              : status === "answering" && progress.some((p) => p.player_id === m.playerId && p.finished)
                ? "terminó"
                : "\u00A0";
          return (
            <li
              key={m.playerId}
              className={`flex min-w-0 flex-col items-center rounded-xl bg-ink-700 px-1.5 pb-1 pt-1.5 ring-2 ${
                isHand ? "ring-sun" : "ring-transparent"
              }`}
            >
              <span aria-hidden="true" className={`mb-1 h-1 w-full rounded-full ${style.tile}`} />
              <span className="max-w-full truncate text-xs font-bold">
                {m.username}
                {m.playerId === myId ? " (tú)" : ""}
              </span>
              <span className="font-display text-lg font-bold leading-none text-volt" aria-label={`${pointsOf(m.playerId)} puntos`}>
                {pointsOf(m.playerId)}
              </span>
              <span className="h-3 text-[10px] leading-3 text-mist">{note}</span>
            </li>
          );
        })}
      </ul>

      {status === "spinning" && previousRound?.status === "letter_rejected" && previousRound.letter ? (
        <p role="status" className="shrink-0 rounded-xl bg-bubble/15 px-3 py-2 text-center text-sm text-bubble">
          Se rechazó la letra {previousRound.letter.toUpperCase()}. Nuevo mano: {handName}.
        </p>
      ) : null}

      <section className="card flex min-h-0 flex-1 flex-col items-center gap-3 overflow-y-auto !p-3 text-center sm:!p-5">
        {showWheel ? (
          <Wheel letter={status === "spinning" ? null : round.letter} startedAtMs={spinStartedAt} offsetMs={offset} />
        ) : null}

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
            <div className="flex w-full flex-col items-center gap-3">
              <div className="flex items-center gap-3">
                <p className="text-mist">Salió la letra</p>
                <span className="inline-flex h-16 w-14 items-center justify-center rounded-2xl bg-paper font-display text-5xl font-bold text-ink-900 shadow-[0_5px_0_0_rgba(0,0,0,0.35)] animate-pop-in">
                  {letter}
                </span>
              </div>
              <p>¿Jugamos con esta letra?</p>
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
              <p className="text-xs text-mist" aria-live="polite">
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
          <div className="flex min-h-0 w-full flex-1 flex-col gap-2">
            <p className="shrink-0 font-display text-lg font-bold">
              {round.stopped_by ? `${nameOf(round.stopped_by)} dio STOP` : "La ronda terminó por acuerdo"}
            </p>
            <ReviewView
              categories={categories}
              answers={roundAnswers}
              reviews={reviews}
              votes={wordVotes}
              players={players}
              myId={myId}
              onChanged={() => void refresh()}
            />
          </div>
        ) : null}

        {status === "finished" ? (
          <div className="flex w-full flex-col items-center gap-3">
            <RoundResults
              players={players}
              answers={roundAnswers}
              results={results}
              myId={myId}
              roundNumber={shownRound}
              totalRounds={totalRounds}
              busy={busy}
              onNext={() => run(() => startNextRound(round.id))}
            />
            <ReviewView
              categories={categories}
              answers={roundAnswers}
              reviews={reviews}
              votes={wordVotes}
              players={players}
              myId={myId}
              onChanged={() => void refresh()}
              collapsible
            />
          </div>
        ) : null}
      </section>

      {actionError ? (
        <p role="alert" className="shrink-0 rounded-xl bg-bubble/15 px-3 py-2 text-sm text-bubble">
          {actionError}
        </p>
      ) : null}
    </GameShell>
  );
}

/** Contenedor de pantalla fija: ocupa justo el alto del dispositivo y no desplaza la página. */
function GameShell({ children }: { children: ReactNode }) {
  return (
    <div className="fixed inset-x-0 top-0 mx-auto flex h-dvh w-full max-w-3xl flex-col gap-2 overflow-hidden p-3 sm:gap-3 sm:p-5">
      {children}
    </div>
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
