"use client";

import { useState } from "react";

type CopyState = "idle" | "copied" | "failed";

export function CopyButton({ label, getText }: { label: string; getText: () => string }) {
  const [state, setState] = useState<CopyState>("idle");

  async function copy() {
    try {
      await navigator.clipboard.writeText(getText());
      setState("copied");
    } catch {
      setState("failed");
    }
    setTimeout(() => setState("idle"), 1800);
  }

  return (
    <button type="button" className="btn-ghost !px-4 !py-2 text-sm" onClick={copy}>
      <span aria-live="polite">
        {state === "copied" ? "¡Copiado!" : state === "failed" ? "No se pudo copiar" : label}
      </span>
    </button>
  );
}
