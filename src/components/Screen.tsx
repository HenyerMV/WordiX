import type { ReactNode } from "react";

export function Screen({ children, wide = false }: { children: ReactNode; wide?: boolean }) {
  return (
    <main
      className={`mx-auto flex min-h-dvh w-full flex-col gap-6 px-4 py-8 sm:gap-8 sm:py-12 ${
        wide ? "max-w-4xl" : "max-w-xl"
      }`}
    >
      {children}
    </main>
  );
}

export function Spinner({ label }: { label: string }) {
  return (
    <div role="status" className="flex flex-col items-center gap-4 py-10 text-mist">
      <span
        aria-hidden="true"
        className="h-10 w-10 animate-spin rounded-full border-4 border-ink-500 border-t-volt"
      />
      <p>{label}</p>
    </div>
  );
}
