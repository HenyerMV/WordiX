import { seatStyle } from "@/lib/seatStyles";
import type { Member } from "@/lib/types";

interface PlayerSlotProps {
  seat: number;
  member: Member | undefined;
  isMe: boolean;
  isHost: boolean;
  online: boolean;
}

export function PlayerSlot({ seat, member, isMe, isHost, online }: PlayerSlotProps) {
  if (!member) {
    return (
      <li className="flex items-center gap-4 rounded-2xl border-2 border-dashed border-ink-500 p-4 text-mist">
        <span
          aria-hidden="true"
          className="inline-flex h-14 w-14 shrink-0 items-center justify-center rounded-xl border-2 border-dashed border-ink-500 font-display text-xl"
        >
          {seat}
        </span>
        <span className="animate-pulse-dot">Esperando jugador…</span>
      </li>
    );
  }

  const style = seatStyle(seat);

  return (
    <li
      className={`flex items-center gap-4 rounded-2xl bg-ink-700 p-4 ring-2 animate-pop-in ${
        isMe ? style.ring : "ring-transparent"
      }`}
    >
      <span
        aria-hidden="true"
        className={`inline-flex h-14 w-14 shrink-0 items-center justify-center rounded-xl font-display text-3xl font-bold uppercase shadow-[0_4px_0_0_rgba(0,0,0,0.35)] ${style.tile}`}
      >
        {member.username.charAt(0)}
      </span>
      <div className="min-w-0 flex-1">
        <p className="truncate font-display text-xl font-bold">{member.username}</p>
        <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-mist">
          <span className="inline-flex items-center gap-1.5">
            <span
              aria-hidden="true"
              className={`h-2 w-2 rounded-full ${online ? "bg-volt" : "bg-mist/50"}`}
            />
            {online ? "en línea" : "desconectado"}
          </span>
          {isHost ? <span className="text-sun">anfitrión · primer mano</span> : null}
          {isMe ? <span className="text-paper">tú</span> : null}
        </div>
      </div>
    </li>
  );
}
