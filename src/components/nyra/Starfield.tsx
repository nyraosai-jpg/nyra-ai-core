import { useMemo } from "react";
import { cn } from "@/lib/utils";

/** Deterministic pseudo-random so SSR and hydration agree. */
function rand(seed: number) {
  const x = Math.sin(seed * 127.1) * 43758.5453;
  return x - Math.floor(x);
}

interface Props {
  count?: number;
  className?: string;
}

/** Ambient star layer for the Nyra HUD. Purely decorative. */
export function Starfield({ count = 90, className }: Props) {
  const stars = useMemo(
    () =>
      Array.from({ length: count }, (_, i) => ({
        top: rand(i + 1) * 100,
        left: rand(i + 51) * 100,
        size: 1 + rand(i + 101) * 2.2,
        delay: rand(i + 151) * 6,
        duration: 3 + rand(i + 201) * 5,
        opacity: 0.25 + rand(i + 251) * 0.6,
      })),
    [count],
  );

  return (
    <div
      aria-hidden="true"
      className={cn("nyra-stars pointer-events-none absolute inset-0 overflow-hidden", className)}
    >
      {stars.map((s, i) => (
        <span
          key={i}
          className="nyra-star"
          style={
            {
              top: `${s.top}%`,
              left: `${s.left}%`,
              width: s.size,
              height: s.size,
              "--star-delay": `${s.delay}s`,
              "--star-duration": `${s.duration}s`,
              "--star-opacity": s.opacity.toFixed(2),
            } as React.CSSProperties
          }
        />
      ))}
    </div>
  );
}
