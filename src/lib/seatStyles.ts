// Un color por asiento. Las clases están escritas completas para que Tailwind
// las detecte al compilar.
export const SEAT_STYLES = [
  { tile: "bg-volt text-ink-900", ring: "ring-volt/60" },
  { tile: "bg-bubble text-paper", ring: "ring-bubble/60" },
  { tile: "bg-sky text-ink-900", ring: "ring-sky/60" },
  { tile: "bg-sun text-ink-900", ring: "ring-sun/60" },
] as const;

export function seatStyle(seat: number) {
  const index = Math.min(Math.max(seat - 1, 0), SEAT_STYLES.length - 1);
  return SEAT_STYLES[index];
}
