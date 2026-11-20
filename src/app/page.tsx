"use client";

import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { Logo } from "@/components/Logo";
import { NameForm } from "@/components/NameForm";
import { usePlayer } from "@/components/PlayerProvider";
import { Screen, Spinner } from "@/components/Screen";
import { friendlyError } from "@/lib/errors";
import { DEFAULT_ROUNDS, ROUND_OPTIONS } from "@/lib/game/rules";
import { ROOM_CODE_LENGTH, isValidRoomCode, sanitizeCode } from "@/lib/game/text";
import { createRoom, joinRoom } from "@/lib/rooms";

const STEPS = [
  {
    title: "Gira la ruleta",
    text: "Sale una letra y todos votan si se juega con ella. Si hay empate, decide el jugador mano.",
  },
  {
    title: "Escribe en 20 segundos",
    text: "Una categoría a la vez, en minúsculas y sin números ni símbolos.",
  },
  {
    title: "Valida y suma",
    text: "Las palabras dudosas las votan los demás. Quien termine primero pulsa STOP.",
  },
] as const;

export default function HomePage() {
  const router = useRouter();
  const { status, player, error, saveName, retry } = usePlayer();
  const [editingName, setEditingName] = useState(false);
  const [code, setCode] = useState("");
  const [rounds, setRounds] = useState<number>(DEFAULT_ROUNDS);
  const [busy, setBusy] = useState<"create" | "join" | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  async function handleCreate() {
    if (busy) return;
    setBusy("create");
    setActionError(null);
    try {
      const room = await createRoom(rounds);
      router.push(`/sala/${room.code}`);
    } catch (e) {
      console.error("[wordix] no se pudo crear la sala", e);
      setActionError(friendlyError(e));
      setBusy(null);
    }
  }

  async function handleJoin(event: FormEvent) {
    event.preventDefault();
    if (busy || !isValidRoomCode(code)) return;
    setBusy("join");
    setActionError(null);
    try {
      const room = await joinRoom(code);
      router.push(`/sala/${room.code}`);
    } catch (e) {
      console.error("[wordix] no se pudo entrar a la sala", e);
      setActionError(friendlyError(e));
      setBusy(null);
    }
  }

  return (
    <Screen wide>
      <header className="flex flex-col items-center gap-2 text-center sm:gap-4">
        <Logo />
        <p className="hidden max-w-md text-balance text-lg text-mist [@media(min-height:760px)]:block">
          Gira la ruleta, llena las categorías antes que los demás y gana la ronda.
        </p>
      </header>

      {status === "loading" ? <Spinner label="Conectando…" /> : null}

      {status === "error" ? (
        <section className="card mx-auto flex w-full max-w-xl flex-col items-center gap-4 text-center">
          <p role="alert">{error}</p>
          <button type="button" className="btn-primary" onClick={retry}>
            Reintentar
          </button>
        </section>
      ) : null}

      {status === "needs_name" ? (
        <div className="mx-auto w-full max-w-xl">
          <NameForm
            title="¿Cómo te llamas?"
            description="Será tu nombre en la sala. Puedes cambiarlo cuando quieras."
            submitLabel="Entrar a WordiX"
            onSubmit={saveName}
          />
        </div>
      ) : null}

      {status === "ready" && player && editingName ? (
        <div className="mx-auto w-full max-w-xl">
          <NameForm
            title="Cambiar nombre"
            initialValue={player.username}
            submitLabel="Guardar nombre"
            onSubmit={async (name) => {
              const message = await saveName(name);
              if (!message) setEditingName(false);
              return message;
            }}
            onCancel={() => setEditingName(false)}
          />
        </div>
      ) : null}

      {status === "ready" && player && !editingName ? (
        <>
          <section className="flex items-center justify-between gap-3 rounded-2xl border border-ink-600 bg-ink-800/70 px-4 py-2">
            <p className="min-w-0 truncate">
              Jugando como{" "}
              <strong className="font-display text-lg font-bold text-volt">{player.username}</strong>
            </p>
            <button
              type="button"
              className="btn-ghost !px-3 !py-1.5 text-sm"
              onClick={() => setEditingName(true)}
            >
              Cambiar nombre
            </button>
          </section>

          {actionError ? (
            <p role="alert" className="rounded-xl bg-bubble/15 px-4 py-2 text-sm text-bubble">
              {actionError}
            </p>
          ) : null}

          <div className="grid gap-3 md:grid-cols-2 md:gap-5">
            <section className="card flex flex-col gap-3 !p-4">
              <div>
                <h2 className="font-display text-xl font-bold sm:text-2xl">Crear sala</h2>
                <p className="mt-0.5 text-sm text-mist">Serás el anfitrión y el primer jugador mano.</p>
              </div>
              <fieldset>
                <legend className="mb-1.5 text-sm font-bold">Número de rondas</legend>
                <div className="grid grid-cols-8 gap-1.5">
                  {ROUND_OPTIONS.map((n) => (
                    <button
                      key={n}
                      type="button"
                      aria-pressed={rounds === n}
                      className={`${rounds === n ? "btn-primary" : "btn-ghost"} !px-0 !py-1.5 text-sm`}
                      onClick={() => setRounds(n)}
                    >
                      {n}
                    </button>
                  ))}
                </div>
              </fieldset>
              <button
                type="button"
                className="btn-primary mt-auto"
                onClick={handleCreate}
                disabled={busy !== null}
              >
                {busy === "create" ? "Creando sala…" : "Crear sala"}
              </button>
            </section>

            <form className="card flex flex-col gap-3 !p-4" onSubmit={handleJoin}>
              <div>
                <h2 className="font-display text-xl font-bold sm:text-2xl">Unirme a una sala</h2>
                <p className="mt-0.5 text-sm text-mist">Escribe el código de {ROOM_CODE_LENGTH} números.</p>
              </div>
              <div>
                <label htmlFor="room-code" className="sr-only">
                  Código de la sala
                </label>
                <input
                  id="room-code"
                  type="text"
                  inputMode="numeric"
                  pattern="[0-9]*"
                  autoComplete="off"
                  value={code}
                  onChange={(e) => setCode(sanitizeCode(e.target.value))}
                  placeholder="000000"
                  maxLength={ROOM_CODE_LENGTH}
                  className="field text-center font-display text-2xl font-bold tracking-[0.35em] !py-2"
                />
              </div>
              <button
                type="submit"
                className="btn-primary mt-auto"
                disabled={busy !== null || !isValidRoomCode(code)}
              >
                {busy === "join" ? "Entrando…" : "Unirme"}
              </button>
            </form>
          </div>

          <section aria-labelledby="como-se-juega" className="hidden pt-1 [@media(min-height:860px)]:block">
            <h2 id="como-se-juega" className="mb-3 font-display text-xl font-bold">
              Cómo se juega
            </h2>
            <ol className="grid gap-3 sm:grid-cols-3">
              {STEPS.map((step, index) => (
                <li key={step.title} className="flex gap-3 rounded-2xl border border-ink-600 p-3">
                  <span
                    aria-hidden="true"
                    className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-paper font-display font-bold text-ink-900"
                  >
                    {index + 1}
                  </span>
                  <div>
                    <h3 className="font-display font-bold">{step.title}</h3>
                    <p className="mt-1 text-sm text-mist">{step.text}</p>
                  </div>
                </li>
              ))}
            </ol>
          </section>
        </>
      ) : null}
    </Screen>
  );
}
