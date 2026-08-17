import { cn } from "@/lib/utils";
import type { OrbState } from "@/lib/nyra/types";

const PARTICLES = [
  { size: 4, radius: 46, duration: 22, delay: 0 },
  { size: 3, radius: 52, duration: 28, delay: -6 },
  { size: 5, radius: 40, duration: 18, delay: -11 },
  { size: 2, radius: 56, duration: 34, delay: -3 },
  { size: 3, radius: 34, duration: 26, delay: -18 },
  { size: 4, radius: 60, duration: 30, delay: -22 },
];

const ringSpeed: Record<OrbState, string> = {
  idle: "8s",
  listening: "2.2s",
  thinking: "3s",
  speaking: "1.4s",
  connecting: "1.8s",
  device_active: "1.2s",
  memory: "3.2s",
  error: "4s",
};

interface Props {
  state: OrbState;
  /** 0..1 live audio amplitude. Only supplied when genuinely measured. */
  level?: number;
  size?: number;
}

export function NyraOrb({ state, level = 0, size = 240 }: Props) {
  const alive = state === "listening" || state === "speaking";
  const energy = alive ? Math.min(1, level) : 0;

  return (
    <div
      className={cn("nyra-orb relative flex items-center justify-center", `nyra-orb--${state}`)}
      style={
        {
          width: size,
          height: size,
          "--orb-energy": energy.toFixed(3),
          "--orb-ring-speed": ringSpeed[state],
        } as React.CSSProperties
      }
      aria-hidden="true"
    >
      {/* ambient glow */}
      <div className="nyra-orb__aura absolute inset-[-22%] rounded-full" />

      {/* expanding energy rings */}
      <span className="nyra-orb__ring absolute inset-[8%] rounded-full" />
      <span className="nyra-orb__ring nyra-orb__ring--2 absolute inset-[8%] rounded-full" />

      {/* orbiting particles */}
      <div className="nyra-orb__orbit absolute inset-0">
        {PARTICLES.map((p, i) => (
          <span
            key={i}
            className="nyra-orb__particle"
            style={
              {
                width: p.size,
                height: p.size,
                "--p-radius": `${p.radius}%`,
                "--p-duration": `${p.duration}s`,
                "--p-delay": `${p.delay}s`,
                "--p-angle": `${(360 / PARTICLES.length) * i}deg`,
              } as React.CSSProperties
            }
          />
        ))}
      </div>

      {/* body */}
      <div className="nyra-orb__shell absolute inset-[16%] rounded-full" />
      <div className="nyra-orb__inner absolute inset-[28%] rounded-full" />

      {/* humanoid silhouette: head, neck, shoulders */}
      <div className="nyra-orb__figure absolute inset-[16%] rounded-full">
        <span className="nyra-orb__head" />
        <span className="nyra-orb__neck" />
        <span className="nyra-orb__shoulders" />
        <span className="nyra-orb__halo" />
      </div>

      {/* stars inside the orb */}
      <div className="nyra-orb__stars absolute inset-[16%] rounded-full">
        {STARS.map((s, i) => (
          <span
            key={i}
            className="nyra-orb__star"
            style={
              {
                top: `${s.top}%`,
                left: `${s.left}%`,
                width: s.size,
                height: s.size,
                "--star-delay": `${s.delay}s`,
                "--star-duration": `${s.duration}s`,
                "--star-opacity": "0.9",
              } as React.CSSProperties
            }
          />
        ))}
      </div>

      <div className="nyra-orb__core absolute inset-[42%] rounded-full" />
      <div className="nyra-orb__highlight absolute inset-[16%] rounded-full" />
    </div>
  );
}
