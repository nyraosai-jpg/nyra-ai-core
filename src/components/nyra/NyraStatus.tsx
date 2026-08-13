import type { VoiceState } from "@/lib/nyra/types";

const labels: Record<VoiceState, string> = {
  idle: "Ready — tap the mic or type to begin",
  listening: "Listening…",
  processing: "Thinking…",
  speaking: "Nyra is speaking…",
  error: "Something went wrong",
};

export function NyraStatus({
  state,
  detail,
}: {
  state: VoiceState;
  detail?: string | undefined;
}) {
  return (
    <div className="text-center" role="status" aria-live="polite">
      <p className="text-sm tracking-[0.28em] uppercase text-muted-foreground">{labels[state]}</p>
      {detail ? <p className="mt-2 text-sm text-foreground/80">{detail}</p> : null}
    </div>
  );
}
