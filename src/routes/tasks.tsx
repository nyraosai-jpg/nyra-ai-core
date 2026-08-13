import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Check, Trash2 } from "lucide-react";
import { NyraShell } from "@/components/nyra/NyraShell";
import { taskStore } from "@/lib/nyra/storage";
import { cn } from "@/lib/utils";
import type { Task, TaskPriority } from "@/lib/nyra/types";

export const Route = createFileRoute("/tasks")({
  head: () => ({
    meta: [
      { title: "Tasks — Nyra" },
      { name: "description", content: "Nyra's internal task list: create, complete and clear tasks." },
      { property: "og:title", content: "Tasks — Nyra" },
      { property: "og:description", content: "Capture tasks by voice or text and let Nyra track them." },
    ],
  }),
  component: TasksPage,
});

function TasksPage() {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [title, setTitle] = useState("");
  const [priority, setPriority] = useState<TaskPriority>("normal");

  useEffect(() => setTasks(taskStore.all()), []);
  const refresh = () => setTasks(taskStore.all());

  const open = tasks.filter((t) => t.status === "open");
  const done = tasks.filter((t) => t.status === "done");

  return (
    <NyraShell>
      <div className="space-y-6 py-6">
        <header>
          <h1 className="text-2xl font-light tracking-tight">Tasks</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Nyra's internal list. No calendar is connected yet.
          </p>
        </header>

        <form
          className="flex flex-col gap-2 rounded-2xl border border-border/60 bg-nyra-panel p-4 sm:flex-row"
          onSubmit={(e) => {
            e.preventDefault();
            if (!title.trim()) return;
            taskStore.add({ title: title.trim(), priority });
            setTitle("");
            refresh();
          }}
        >
          <label htmlFor="task-title" className="sr-only">
            Task title
          </label>
          <input
            id="task-title"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="What needs doing?"
            className="min-h-11 flex-1 rounded-xl border border-border/50 bg-background/40 px-4 text-sm focus:border-primary/60 focus:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          />
          <label htmlFor="task-priority" className="sr-only">
            Priority
          </label>
          <select
            id="task-priority"
            value={priority}
            onChange={(e) => setPriority(e.target.value as TaskPriority)}
            className="min-h-11 rounded-xl border border-border/50 bg-background/40 px-3 text-sm capitalize focus-visible:ring-2 focus-visible:ring-ring"
          >
            <option value="low">low</option>
            <option value="normal">normal</option>
            <option value="high">high</option>
          </select>
          <button
            type="submit"
            className="min-h-11 rounded-xl border border-border/60 bg-secondary px-5 text-sm text-secondary-foreground hover:border-primary/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            Add
          </button>
        </form>

        <TaskList tasks={open} onChange={refresh} emptyText="Your task list is clear." />
        {done.length > 0 ? (
          <>
            <h2 className="text-xs uppercase tracking-[0.3em] text-muted-foreground">Completed</h2>
            <TaskList tasks={done} onChange={refresh} emptyText="" />
          </>
        ) : null}
      </div>
    </NyraShell>
  );
}

function TaskList({
  tasks,
  onChange,
  emptyText,
}: {
  tasks: Task[];
  onChange: () => void;
  emptyText: string;
}) {
  if (!tasks.length) {
    return emptyText ? (
      <p className="rounded-2xl border border-border/60 bg-nyra-panel p-6 text-sm text-muted-foreground">
        {emptyText}
      </p>
    ) : null;
  }
  return (
    <ul className="space-y-3">
      {tasks.map((t) => (
        <li
          key={t.id}
          className="flex items-center justify-between gap-3 rounded-2xl border border-border/60 bg-nyra-panel p-4"
        >
          <div className="flex min-w-0 items-center gap-3">
            <button
              type="button"
              aria-label={t.status === "done" ? `Reopen ${t.title}` : `Complete ${t.title}`}
              onClick={() => {
                taskStore.toggle(t.id);
                onChange();
              }}
              className={cn(
                "flex h-8 w-8 shrink-0 items-center justify-center rounded-full border transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                t.status === "done"
                  ? "border-primary bg-primary/20 text-primary"
                  : "border-border/70 text-transparent hover:border-primary/70",
              )}
            >
              <Check className="h-4 w-4" />
            </button>
            <div className="min-w-0">
              <p className={cn("truncate text-sm", t.status === "done" && "text-muted-foreground line-through")}>
                {t.title}
              </p>
              <p className="text-xs uppercase tracking-widest text-muted-foreground">
                {t.priority} · {new Date(t.createdAt).toLocaleDateString()}
              </p>
            </div>
          </div>
          <button
            type="button"
            aria-label={`Delete task ${t.title}`}
            onClick={() => {
              taskStore.remove(t.id);
              onChange();
            }}
            className="shrink-0 rounded-lg p-2 text-muted-foreground hover:text-destructive focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <Trash2 className="h-4 w-4" />
          </button>
        </li>
      ))}
    </ul>
  );
}
