const LETTERS = ["W", "o", "r", "d", "i", "X"] as const;
const TILTS = ["-rotate-3", "rotate-2", "-rotate-1", "rotate-3", "-rotate-2", "rotate-1"] as const;

export function Logo({ size = "lg" }: { size?: "sm" | "lg" }) {
  const box =
    size === "lg"
      ? "h-12 w-12 rounded-xl text-3xl sm:h-16 sm:w-16 sm:rounded-2xl sm:text-4xl"
      : "h-8 w-8 rounded-lg text-xl";
  const gap = size === "lg" ? "gap-1.5 sm:gap-2" : "gap-1";

  return (
    <div role="img" aria-label="WordiX" className={`flex items-center ${gap}`}>
      {LETTERS.map((letter, index) => {
        const isX = index === LETTERS.length - 1;
        return (
          <span
            key={index}
            aria-hidden="true"
            style={{ animationDelay: `${index * 70}ms` }}
            className={`inline-flex select-none items-center justify-center font-display font-bold shadow-[0_4px_0_0_rgba(0,0,0,0.35)] animate-pop-in ${box} ${TILTS[index]} ${
              isX ? "bg-bubble text-paper" : "bg-paper text-ink-900"
            }`}
          >
            {letter}
          </span>
        );
      })}
    </div>
  );
}
