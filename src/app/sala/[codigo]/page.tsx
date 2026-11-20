"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useState } from "react";
import { ConnectionBadge } from "@/components/ConnectionBadge";
import { CopyButton } from "@/components/CopyButton";
import { Logo } from "@/components/Logo";
import { NameForm } from "@/components/NameForm";
import { GameView } from "@/components/GameView";
import { PlayerSlot } from "@/components/PlayerSlot";
import { usePlayer } from "@/components/PlayerProvider";
import { Screen, Spinner } from "@/components/Screen";
import { friendlyError } from "@/lib/errors";
import { startGame } from "@/lib/game/api";
import { isValidRoomCode } from "@/lib/game/text";
import { useRoom } from "@/lib/useRoom";

function MessageCard({ message, actionLabel, onAction }: {
  message: string;
  actionLabel: string;
  onAction: () => void;
}) {
  return (
    <section className="card flex flex-col items-center gap-4 text-center">
      <p role="alert">{message}</p>
      <button type="button" className="btn-primary" onClick={onAction}>
        {actionLabel}
      </button>
    </section>
  );
}

export default function RoomPage() {
  const router = useRouter();
  const params = useParams<{ codigo: string }>();
  const code = params.codigo;
  const validCode = isValidRoomCode(code);

  const { status, player, error: playerError, saveName, retry } = usePlayer();
  const myId = validCode && status === "ready" && player ? player.id : null;
  const { phase, error, room, members, onlineIds, connection, leave } = useRoom(code, myId);
  const [leaving, setLeaving] = useState(false);
  const [leaveError, setLeaveError] = useState<string | null>(null);
  const [starting, setStarting] = useState(false);
  const [startError, setStartError] = useState<string | null>(null);

  async function handleLeave() {
    if (leaving) return;
    setLeaving(true);
    setLeaveError(null);
    try {
      await leave();
      router.push("/");
    } catch (e) {
      console.error("[wordix] no se pudo salir de la sala", e);
      setLeaveError(friendlyError(e));
      setLeaving(false);
    }
  }

  const goHome = () => router.push("/");

  if (!validCode) {
    return (
      <Screen>
        <Logo size="sm" />
        <MessageCard message="Ese código de sala no es válido. Debe tener 6 números." actionLabel="Volver al inicio" onAction={goHome} />
      </Screen>
    );
  }

  if (status === "loading") {
    return (
      <Screen>
        <Logo size="sm" />
        <Spinner label="Conectando…" />
      </Screen>
    );
  }

  if (status === "error") {
    return (
      <Screen>
        <Logo size="sm" />
        <MessageCard message={playerError ?? "No pudimos conectarnos."} actionLabel="Reintentar" onAction={retry} />
      </Screen>
    );
  }

  if (status === "needs_name") {
    return (
      <Screen>
        <Logo size="sm" />
        <NameForm
          title={`Entrar a la sala ${code}`}
          description="Antes de entrar, escribe tu nombre de jugador."
          submitLabel="Entrar a la sala"
          onSubmit={saveName}
        />
      </Screen>
    );
  }

  if (phase === "error") {
    return (
      <Screen>
        <Logo size="sm" />
        <MessageCard message={error ?? "No pudimos entrar a la sala."} actionLabel="Volver al inicio" onAction={goHome} />
      </Screen>
    );
  }

  if (phase === "joining" || !room) {
    return (
      <Screen>
        <Logo size="sm" />
        <Spinner label={`Entrando a la sala ${code}…`} />
      </Screen>
    );
  }

  if (room.status !== "waiting" && myId) {
    return (
      <Screen wide>
        <GameView room={room} members={members} myId={myId} onExit={goHome} />
      </Screen>
    );
  }

  const isHost = room.host_id === myId;
  const canStart = members.length >= 2;
  const hostName = members.find((m) => m.playerId === room.host_id)?.username ?? "el anfitrión";

  async function handleStart() {
    if (starting || !room) return;
    setStarting(true);
    setStartError(null);
    try {
      await startGame(room.id);
    } catch (e) {
      console.error("[wordix] no se pudo empezar la partida", e);
      setStartError(friendlyError(e));
    } finally {
      setStarting(false);
    }
  }

  const slots = Array.from({ length: room.max_players }, (_, index) => index + 1);
  const memberBySeat = new Map(members.map((member) => [member.seat, member]));

  return (
    <Screen>
      <header className="flex items-center justify-between gap-3">
        <Link href="/" aria-label="WordiX, volver al inicio" onClick={(e) => { e.preventDefault(); void handleLeave(); }}>
          <Logo size="sm" />
        </Link>
        <ConnectionBadge connection={connection} />
      </header>

      <section className="card text-center !p-3 sm:!p-5">
        <p className="text-xs uppercase tracking-widest text-mist">
          Código de la sala · {room.total_rounds} rondas
        </p>
        <div className="mt-2 flex justify-center gap-1.5 sm:gap-2" aria-label={`Código ${code.split("").join(" ")}`}>
          {code.split("").map((digit, index) => (
            <span
              key={index}
              aria-hidden="true"
              style={{ animationDelay: `${index * 60}ms` }}
              className="inline-flex h-11 w-9 items-center justify-center rounded-xl bg-paper font-display text-2xl font-bold text-ink-900 shadow-[0_4px_0_0_rgba(0,0,0,0.35)] animate-pop-in sm:h-16 sm:w-14 sm:text-4xl"
            >
              {digit}
            </span>
          ))}
        </div>
        <div className="mt-3 flex flex-wrap justify-center gap-2">
          <CopyButton label="Copiar código" getText={() => code} />
          <CopyButton label="Copiar enlace" getText={() => `${window.location.origin}/sala/${code}`} />
        </div>
      </section>

      <section className="card !p-3 sm:!p-5" aria-labelledby="jugadores">
        <div className="mb-2 flex items-baseline justify-between gap-3">
          <h2 id="jugadores" className="font-display text-lg font-bold">
            Jugadores
          </h2>
          <p className="text-sm text-mist" aria-live="polite">
            {members.length} de {room.max_players}
          </p>
        </div>
        <ul className="grid grid-cols-2 gap-2">
          {slots.map((seat) => {
            const member = memberBySeat.get(seat);
            const isMe = member?.playerId === myId;
            return (
              <PlayerSlot
                key={seat}
                seat={seat}
                member={member}
                isMe={isMe}
                isHost={member?.playerId === room.host_id}
                online={member ? (isMe ? connection !== "offline" : onlineIds.has(member.playerId)) : false}
              />
            );
          })}
        </ul>
        <p className="mt-2 text-xs text-mist">
          {members.length < 2
            ? "Se necesitan al menos 2 jugadores. Comparte el código para que se unan."
            : "Pueden jugar de 2 a 4 personas."}
        </p>
      </section>

      {leaveError ? (
        <p role="alert" className="rounded-xl bg-bubble/15 px-4 py-2 text-sm text-bubble">
          {leaveError}
        </p>
      ) : null}

      <div className="mt-auto flex flex-col items-center gap-2">
        {isHost ? (
          <>
            <button type="button" className="btn-primary w-full text-xl sm:w-auto" onClick={handleStart} disabled={!canStart || starting}>
              {starting ? "Empezando…" : "Empezar partida"}
            </button>
            {!canStart ? <p className="text-xs text-mist">Se activa cuando haya 2 o más jugadores.</p> : null}
          </>
        ) : (
          <p className="text-center text-mist" aria-live="polite">
            Esperando a que {hostName} empiece la partida…
          </p>
        )}
        {startError ? (
          <p role="alert" className="text-sm text-bubble">
            {startError}
          </p>
        ) : null}
        <button type="button" className="btn-ghost !py-2 text-sm" onClick={handleLeave} disabled={leaving}>
          {leaving ? "Saliendo…" : "Salir de la sala"}
        </button>
      </div>
    </Screen>
  );
}
