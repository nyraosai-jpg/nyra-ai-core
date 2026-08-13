import { cn } from "@/lib/utils";
import type { VoiceState } from "@/lib/nyra/types";

const ringByState: Record<VoiceState, string> = {
  idle: "animate-nyra-breathe",
  listening: "animate-nyra-listen",
  processing: "animate-nyra-think",
  speaking: "animate-nyra-speak",
  error: "",
};

export function NyraOrb({ state, size = 220 }: { state: VoiceState; size?: number }) {
  return (
    <div
      className="relative flex items-center justify-center"
      style={{ width: size, height: size }}
      aria-hidden="true"
    >
      <div
        className={cn(
          "absolute inset-0 rounded-full blur-2xl opacity-70",
          state === "error" ? "bg-nyra-alert-glow" : "bg-nyra-glow",
          ringByState[state],
        )}
      />
      <div className="absolute inset-[12%] rounded-full border border-border/60 bg-nyra-core shadow-nyra" />
      <div
        className={cn(
          "absolute inset-[26%] rounded-full bg-nyra-inner",
          state !== "error" && ringByState[state],
        )}
      />
      <div className="absolute inset-[44%] rounded-full bg-primary/80 blur-md" />
    </div>
  );
}
