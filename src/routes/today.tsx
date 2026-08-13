import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { NyraShell } from "@/components/nyra/NyraShell";
import { taskStore } from "@/lib/nyra/storage";
import type { Task } from "@/lib/nyra/types";

export const Route = createFileRoute("/today")({
  head: () => ({
    meta: [
      { title: "Today — Nyra" },
      { name: "description", content: "Nyra's daily overview: priorities, open tasks and progress." },
      { property: "og:title", content: "Today — Nyra" },
      { property: "og:description", content: "A calm daily overview built from Nyra's task list." },
    ],
  }),
  component: TodayPage,
});

function TodayPage() {
  const [tasks, setTasks] = useState<Task[]>([]);
  useEffect(() => setTasks(taskStore.all()), []);

  const open = tasks.filter((t) => t.status === "open");
  const high = open.filter((t) => t.priority === "high");
  const done = tasks.filter((t) => t.status === "done");

  return (
    <NyraShell>
      <div className="space-y-6 py-6">
        <header>
          <h1 className="text-2xl font-light tracking-tight">Today</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {new Date().toLocaleDateString(undefined, {
              weekday: "long",
              day: "numeric",
              month: "long",
            })}
          </p>
        </header>

        <div className="grid gap-3 sm:grid-cols-3">
          <Stat label="Open" value={open.length} />
          <Stat label="Priority" value={high.length} />
          <Stat label="Completed" value={done.length} />
        </div>

        <section className="rounded-2xl border border-border/60 bg-nyra-panel p-5">
          <h2 className="text-xs uppercase tracking-[0.3em] text-muted-foreground">
            Today's priorities
          </h2>
          {open.length === 0 ? (
            <p className="mt-3 text-sm text-muted-foreground">
              Nothing captured yet.{" "}
              <Link to="/tasks" className="text-primary underline-offset-4 hover:underline">
                Add a task
              </Link>
              .
            </p>
          ) : (
            <ul className="mt-3 space-y-2">
              {[...high, ...open.filter((t) => t.priority !== "high")].slice(0, 6).map((t) => (
                <li key={t.id} className="flex items-center gap-3 text-sm">
                  <span className="h-1.5 w-1.5 rounded-full bg-primary" aria-hidden="true" />
                  {t.title}
                </li>
              ))}
            </ul>
          )}
          <p className="mt-4 text-xs text-muted-foreground">
            These are Nyra's internal tasks — calendar and email integrations arrive in a later
            phase.
          </p>
        </section>
      </div>
    </NyraShell>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-2xl border border-border/60 bg-nyra-panel p-5">
      <p className="text-3xl font-light">{value}</p>
      <p className="mt-1 text-xs uppercase tracking-[0.3em] text-muted-foreground">{label}</p>
    </div>
  );
}
