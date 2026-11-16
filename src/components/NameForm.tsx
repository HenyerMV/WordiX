"use client";

import { useState, type FormEvent } from "react";
import { NAME_MAX, NAME_MIN, sanitizeInput, validateName } from "@/lib/game/text";

interface NameFormProps {
  title: string;
  description?: string;
  initialValue?: string;
  submitLabel: string;
  /** Devuelve un mensaje de error, o null si todo salió bien. */
  onSubmit: (name: string) => Promise<string | null>;
  onCancel?: () => void;
}

export function NameForm({
  title,
  description,
  initialValue = "",
  submitLabel,
  onSubmit,
  onCancel,
}: NameFormProps) {
  const [value, setValue] = useState(initialValue);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const check = validateName(value);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    if (!check.ok || busy) return;
    setBusy(true);
    setError(null);
    const message = await onSubmit(check.value);
    // Si todo salió bien, el padre cambia de pantalla y este formulario se desmonta.
    if (message) {
      setError(message);
      setBusy(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="card flex flex-col gap-4" noValidate>
      <div>
        <h2 className="font-display text-2xl font-bold">{title}</h2>
        {description ? <p className="mt-1 text-mist">{description}</p> : null}
      </div>

      <div className="flex flex-col gap-2">
        <label htmlFor="username" className="text-sm font-medium text-mist">
          Tu nombre de jugador
        </label>
        <input
          id="username"
          name="username"
          type="text"
          value={value}
          onChange={(e) => setValue(sanitizeInput(e.target.value, NAME_MAX))}
          maxLength={NAME_MAX}
          autoComplete="off"
          autoCapitalize="none"
          autoCorrect="off"
          spellCheck={false}
          enterKeyHint="go"
          placeholder="por ejemplo: luna"
          className="field"
          aria-describedby="username-help"
        />
        <p id="username-help" className="flex justify-between gap-3 text-sm text-mist/80">
          <span>
            Solo letras minúsculas, sin números ni símbolos ({NAME_MIN} a {NAME_MAX}).
          </span>
          <span aria-hidden="true">
            {value.length}/{NAME_MAX}
          </span>
        </p>
      </div>

      {error ? (
        <p role="alert" className="rounded-xl bg-bubble/15 px-3 py-2 text-sm text-bubble">
          {error}
        </p>
      ) : null}

      <div className="flex flex-col gap-3 sm:flex-row-reverse">
        <button type="submit" className="btn-primary sm:flex-1" disabled={!check.ok || busy}>
          {busy ? "Guardando…" : submitLabel}
        </button>
        {onCancel ? (
          <button type="button" className="btn-ghost" onClick={onCancel} disabled={busy}>
            Cancelar
          </button>
        ) : null}
      </div>
    </form>
  );
}
