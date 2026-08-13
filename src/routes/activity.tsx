import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { NyraShell } from "@/components/nyra/NyraShell";
import { activityLog } from "@/lib/nyra/activity";
import type { ActivityEvent } from "@/lib/nyra/types";

export const Route = createFileRoute("/activity")({
  head: () => ({
    meta: [
      { title: "Activity — Nyra" },
      { name: "description", content: "A live feed of what Nyra is actually doing on your behalf." },
      { property: "og:title", content: "Activity — Nyra" },
      { property: "og:description", content: "Real system events: listening, reasoning, memory and device actions." },
    ],
  }),
  component: ActivityPage,
});

function ActivityPage() {
  const [events, setEvents] = useState<ActivityEvent[]>([]);

  useEffect(() => {
    setEvents(activityLog.all());
    return activityLog.subscribe(setEvents) as unknown as () => void;
  }, []);

  return (
    <NyraShell>
      <div className="space-y-5 py-6">
        <header className="flex items-center justify-between">
          <h1 className="text-2xl font-light tracking-tight">Activity</h1>
          <button
            type="button"
            onClick={() => activityLog.clear()}
            className="min-h-10 rounded-xl border border-border/60 px-3 text-xs text-muted-foreground hover:border-primary/60"
          >
            Clear
          </button>
        </header>

        <section className="rounded-2xl border border-border/60 bg-nyra-panel p-5">
          {events.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              Nothing yet. Real events appear here as Nyra listens, thinks, remembers and acts.
            </p>
          ) : (
            <ul className="space-y-3">
              {events.map((e) => (
                <li key={e.id} className="flex gap-4 text-sm">
                  <time className="shrink-0 tabular-nums text-muted-foreground">
                    {new Date(e.at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                  </time>
                  <span>
                    <span className="text-foreground/90">{e.message}</span>
                    {e.detail ? (
                      <span className="block text-xs text-muted-foreground">{e.detail}</span>
                    ) : null}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </NyraShell>
  );
}
