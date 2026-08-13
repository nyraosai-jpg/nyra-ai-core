import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Trash2 } from "lucide-react";
import { NyraShell } from "@/components/nyra/NyraShell";
import { memoryStore } from "@/lib/nyra/storage";
import type { Memory, MemoryType } from "@/lib/nyra/types";

export const Route = createFileRoute("/memory")({
  head: () => ({
    meta: [
      { title: "Memory — Nyra" },
      { name: "description", content: "Everything Nyra remembers about you, visible and removable." },
      { property: "og:title", content: "Memory — Nyra" },
      { property: "og:description", content: "Review, edit and delete what Nyra remembers." },
    ],
  }),
  component: MemoryPage,
});

const types: MemoryType[] = [
  "personal",
  "preferences",
  "routines",
  "goals",
  "people",
  "projects",
  "notes",
  "facts",
];

function MemoryPage() {
  const [memories, setMemories] = useState<Memory[]>([]);
  const [content, setContent] = useState("");
  const [type, setType] = useState<MemoryType>("facts");

  useEffect(() => setMemories(memoryStore.all()), []);

  const refresh = () => setMemories(memoryStore.all());

  return (
    <NyraShell>
      <div className="space-y-6 py-6">
        <header>
          <h1 className="text-2xl font-light tracking-tight">Memory</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Nyra only stores what you ask her to. Stored privately on this device.
          </p>
        </header>

        <form
          className="flex flex-col gap-2 rounded-2xl border border-border/60 bg-nyra-panel p-4 sm:flex-row"
          onSubmit={(e) => {
            e.preventDefault();
            if (!content.trim()) return;
            memoryStore.add({ content: content.trim(), type, importance: 2 });
            setContent("");
            refresh();
          }}
        >
          <label htmlFor="memory-content" className="sr-only">
            Memory content
          </label>
          <input
            id="memory-content"
            value={content}
            onChange={(e) => setContent(e.target.value)}
            placeholder="Something Nyra should remember…"
            className="min-h-11 flex-1 rounded-xl border border-border/50 bg-background/40 px-4 text-sm focus:border-primary/60 focus:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          />
          <label htmlFor="memory-type" className="sr-only">
            Memory category
          </label>
          <select
            id="memory-type"
            value={type}
            onChange={(e) => setType(e.target.value as MemoryType)}
            className="min-h-11 rounded-xl border border-border/50 bg-background/40 px-3 text-sm capitalize focus-visible:ring-2 focus-visible:ring-ring"
          >
            {types.map((t) => (
              <option key={t} value={t}>
                {t}
              </option>
            ))}
          </select>
          <button
            type="submit"
            className="min-h-11 rounded-xl border border-border/60 bg-secondary px-5 text-sm text-secondary-foreground transition-colors hover:border-primary/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            Save
          </button>
        </form>

        {memories.length === 0 ? (
          <p className="rounded-2xl border border-border/60 bg-nyra-panel p-6 text-sm text-muted-foreground">
            No memories yet. Say “remember that…” on the home screen.
          </p>
        ) : (
          <ul className="space-y-3">
            {memories.map((m) => (
              <li
                key={m.id}
                className="flex items-start justify-between gap-4 rounded-2xl border border-border/60 bg-nyra-panel p-4"
              >
                <div className="min-w-0">
                  <p className="text-sm text-foreground">{m.content}</p>
                  <p className="mt-1 text-xs uppercase tracking-widest text-muted-foreground">
                    {m.type} · importance {m.importance} ·{" "}
                    {new Date(m.createdAt).toLocaleDateString()}
                  </p>
                </div>
                <button
                  type="button"
                  aria-label={`Delete memory: ${m.content.slice(0, 40)}`}
                  onClick={() => {
                    memoryStore.remove(m.id);
                    refresh();
                  }}
                  className="shrink-0 rounded-lg p-2 text-muted-foreground transition-colors hover:text-destructive focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </NyraShell>
  );
}
