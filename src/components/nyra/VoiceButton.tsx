import { Mic, Square } from "lucide-react";
import { cn } from "@/lib/utils";
import type { VoiceState } from "@/lib/nyra/types";

interface Props {
  state: VoiceState;
  disabled?: boolean;
  onStart: () => void;
  onStop: () => void;
}

export function VoiceButton({ state, disabled, onStart, onStop }: Props) {
  const listening = state === "listening";
  const speaking = state === "speaking";

  return (
    <button
      type="button"
      disabled={disabled || state === "processing"}
      aria-label={listening ? "Stop listening" : "Start speaking to Nyra"}
      aria-pressed={listening}
      onClick={() => (listening || speaking ? onStop() : onStart())}
      className={cn(
        "group inline-flex h-20 w-20 items-center justify-center rounded-full border border-border/70",
        "bg-nyra-panel backdrop-blur transition-all duration-300",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background",
        "hover:border-primary/70 hover:shadow-nyra disabled:opacity-50 disabled:cursor-not-allowed",
        listening && "border-primary shadow-nyra",
      )}
    >
      {listening || speaking ? (
        <Square className="h-7 w-7 text-primary" />
      ) : (
        <Mic className="h-8 w-8 text-foreground/90 transition-colors group-hover:text-primary" />
      )}
    </button>
  );
}
