import type { Connection } from "@/lib/useRoom";

const STATES: Record<Connection, { label: string; dot: string }> = {
  connecting: { label: "Conectando…", dot: "bg-sun animate-pulse-dot" },
  online: { label: "En línea", dot: "bg-volt" },
  offline: { label: "Sin conexión · reconectando…", dot: "bg-bubble animate-pulse-dot" },
};

export function ConnectionBadge({ connection }: { connection: Connection }) {
  const state = STATES[connection];
  return (
    <div
      role="status"
      aria-live="polite"
      className="inline-flex items-center gap-2 rounded-full border border-ink-600 bg-ink-800 px-3 py-1.5 text-sm text-mist"
    >
      <span aria-hidden="true" className={`h-2.5 w-2.5 rounded-full ${state.dot}`} />
      {state.label}
    </div>
  );
}
