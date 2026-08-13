import { useEffect, useRef, useState } from "react";
import { SendHorizonal } from "lucide-react";
import { cn } from "@/lib/utils";
import type { Message } from "@/lib/nyra/types";

interface Props {
  messages: Message[];
  partial: string;
  disabled?: boolean;
  onSend: (text: string) => void;
}

export function ConversationPanel({ messages, partial, disabled, onSend }: Props) {
  const [draft, setDraft] = useState("");
  const endRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    endRef.current?.scrollIntoView({ block: "end" });
  }, [messages.length, partial]);

  const recent = messages.slice(-8);

  return (
    <section
      aria-label="Conversation with Nyra"
      className="w-full rounded-2xl border border-border/60 bg-nyra-panel backdrop-blur-xl"
    >
      <div className="max-h-[38vh] min-h-[120px] space-y-3 overflow-y-auto px-5 py-5">
        {recent.length === 0 && !partial ? (
          <p className="text-sm text-muted-foreground">
            Speak or type. Try “remember that I prefer mornings”, “add finish my website to my
            tasks”, or “plan my day”.
          </p>
        ) : null}
        {recent.map((m) => (
          <div
            key={m.id}
            className={cn("flex", m.role === "user" ? "justify-end" : "justify-start")}
          >
            <div
              className={cn(
                "max-w-[85%] whitespace-pre-wrap rounded-xl px-4 py-2.5 text-sm leading-relaxed",
                m.role === "user"
                  ? "bg-secondary text-secondary-foreground"
                  : "border border-border/60 bg-card text-card-foreground",
              )}
            >
              {m.content}
              {m.demo ? (
                <span className="mt-1 block text-[11px] uppercase tracking-widest text-muted-foreground">
                  demo response
                </span>
              ) : null}
            </div>
          </div>
        ))}
        {partial ? (
          <div className="flex justify-end">
            <div className="max-w-[85%] rounded-xl bg-secondary/60 px-4 py-2.5 text-sm italic text-muted-foreground">
              {partial}
            </div>
          </div>
        ) : null}
        <div ref={endRef} />
      </div>

      <form
        className="flex items-center gap-2 border-t border-border/60 px-3 py-3"
        onSubmit={(e) => {
          e.preventDefault();
          if (!draft.trim()) return;
          onSend(draft);
          setDraft("");
        }}
      >
        <label htmlFor="nyra-input" className="sr-only">
          Message Nyra
        </label>
        <input
          id="nyra-input"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          placeholder="Type to Nyra…"
          autoComplete="off"
          className="min-h-11 flex-1 rounded-xl border border-border/50 bg-background/40 px-4 text-sm text-foreground placeholder:text-muted-foreground focus:border-primary/60 focus:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        />
        <button
          type="submit"
          disabled={disabled || !draft.trim()}
          aria-label="Send message to Nyra"
          className="inline-flex h-11 w-11 items-center justify-center rounded-xl border border-border/60 bg-secondary text-secondary-foreground transition-colors hover:border-primary/60 disabled:opacity-40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          <SendHorizonal className="h-4 w-4" />
        </button>
      </form>
    </section>
  );
}
