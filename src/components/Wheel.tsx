"use client";

import { useEffect, useRef } from "react";
import { LETTERS, SPIN_ANIM_MS } from "@/lib/game/rules";

const SIZE = 300;
const C = SIZE / 2;
const R = 140;
const STEP = 360 / LETTERS.length;
const COLORS = ["#C6FF3D", "#FF4D8D", "#3DD9FF", "#FFC93D"];

function point(angleDeg: number, radius: number) {
  const a = (angleDeg * Math.PI) / 180;
  return { x: C + radius * Math.sin(a), y: C - radius * Math.cos(a) };
}

const SEGMENTS = LETTERS.map((letter, i) => {
  const a1 = i * STEP;
  const a2 = (i + 1) * STEP;
  const p1 = point(a1, R);
  const p2 = point(a2, R);
  const fill = COLORS[i % COLORS.length];
  return {
    letter,
    fill,
    mid: a1 + STEP / 2,
    textColor: fill === "#FF4D8D" ? "#F4F1FF" : "#100B26",
    d: `M ${C} ${C} L ${p1.x.toFixed(2)} ${p1.y.toFixed(2)} A ${R} ${R} 0 0 1 ${p2.x.toFixed(2)} ${p2.y.toFixed(2)} Z`,
  };
});

interface WheelProps {
  /** Letra elegida por el servidor, o null si todavía no se giró. */
  letter: string | null;
  /** Momento (hora del servidor, ms) en que se giró la ruleta. */
  startedAtMs: number | null;
  /** Diferencia entre la hora del servidor y la de este dispositivo. */
  offsetMs: number;
}

/**
 * Ruleta del abecedario. Su posición depende solo de la hora del servidor, así
 * todos los jugadores ven la misma animación y se detiene en la misma letra.
 */
export function Wheel({ letter, startedAtMs, offsetMs }: WheelProps) {
  const groupRef = useRef<SVGGElement>(null);

  useEffect(() => {
    const group = groupRef.current;
    if (!group) return;
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const index = letter ? LETTERS.indexOf(letter) : -1;
    const finalAngle = index >= 0 ? 360 * 5 + (360 - (index + 0.5) * STEP) : 0;
    let frame = 0;

    function paint(rotation: number) {
      group?.setAttribute("transform", `rotate(${rotation.toFixed(2)} ${C} ${C})`);
    }

    function loop() {
      const now = Date.now() + offsetMs;
      if (index < 0 || startedAtMs === null) {
        paint(reduced ? 0 : (now / 60) % 360);
        if (!reduced) frame = requestAnimationFrame(loop);
        return;
      }
      const progress = Math.min(Math.max((now - startedAtMs) / SPIN_ANIM_MS, 0), 1);
      if (reduced || progress >= 1) {
        paint(finalAngle);
        return;
      }
      paint(finalAngle * (1 - Math.pow(1 - progress, 3)));
      frame = requestAnimationFrame(loop);
    }

    loop();
    return () => cancelAnimationFrame(frame);
  }, [letter, startedAtMs, offsetMs]);

  return (
    <svg
      viewBox={`0 0 ${SIZE} ${SIZE + 10}`}
      className="mx-auto max-h-[34dvh] w-full max-w-xs shrink-0 drop-shadow-[0_10px_0_rgba(0,0,0,0.3)]"
      role="img"
      aria-label={letter ? `Ruleta detenida en la letra ${letter.toUpperCase()}` : "Ruleta del abecedario"}
    >
      <circle cx={C} cy={C} r={R + 8} fill="#221A4A" />
      <g ref={groupRef}>
        {SEGMENTS.map((s) => (
          <g key={s.letter}>
            <path d={s.d} fill={s.fill} stroke="#100B26" strokeWidth="1.5" />
            <text
              transform={`rotate(${s.mid} ${C} ${C})`}
              x={C}
              y={C - 114}
              textAnchor="middle"
              dominantBaseline="middle"
              fontSize="17"
              fontWeight="800"
              fill={s.textColor}
              style={{ fontFamily: "var(--font-display), system-ui, sans-serif" }}
            >
              {s.letter.toUpperCase()}
            </text>
          </g>
        ))}
      </g>
      <circle cx={C} cy={C} r="22" fill="#100B26" stroke="#F4F1FF" strokeWidth="4" />
      <polygon points={`${C - 13},2 ${C + 13},2 ${C},30`} fill="#F4F1FF" stroke="#100B26" strokeWidth="3" strokeLinejoin="round" />
    </svg>
  );
}
