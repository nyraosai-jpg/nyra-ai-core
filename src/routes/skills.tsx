import { createFileRoute } from "@tanstack/react-router";
import { NyraShell } from "@/components/nyra/NyraShell";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/skills")({
  head: () => ({
    meta: [
      { title: "Skills — Nyra" },
      { name: "description", content: "Nyra's active capabilities and the roadmap ahead." },
      { property: "og:title", content: "Skills — Nyra" },
      { property: "og:description", content: "What Nyra can do today, and what's coming next." },
    ],
  }),
  component: SkillsPage,
});

const skills = [
  { name: "Conversation", desc: "Natural dialogue through the Groq-powered brain.", active: true },
  { name: "Memory", desc: "Save, recall, edit and delete what matters.", active: true },
  { name: "Tasks", desc: "Capture and complete tasks by voice or text.", active: true },
  { name: "Daily planning", desc: "A calm overview of priorities and progress.", active: true },
  { name: "Voice", desc: "Isolated microphone input and ElevenLabs speech.", active: true },
  { name: "Web search", desc: "Live retrieval for fresh information.", active: false },
  { name: "Smart home", desc: "Lights, climate, locks, sensors and media.", active: false },
  { name: "Vision", desc: "Opt-in camera understanding with explicit permission.", active: false },
  { name: "Camera safety", desc: "Privacy-first environmental awareness.", active: false },
];

const phases = [
  ["Phase 1 — Core Nyra", "Voice, brain, conversation, memory, tasks, HUD."],
  ["Phase 2 — Personal intelligence", "Deeper memory, routines, briefings, proactive help."],
  ["Phase 3 — Connected Nyra", "Calendar, email, smart home, device control."],
  ["Phase 4 — Vision", "Camera input, visual understanding, safety awareness."],
  ["Phase 5 — Full Nyra OS", "Proactive agent behaviour and deep automation."],
] as const;

function SkillsPage() {
  return (
    <NyraShell>
      <div className="space-y-8 py-6">
        <header>
          <h1 className="text-2xl font-light tracking-tight">Skills</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Nyra routes each request to a capability. Nothing here is faked.
          </p>
        </header>

        <ul className="grid gap-3 sm:grid-cols-2">
          {skills.map((s) => (
            <li key={s.name} className="rounded-2xl border border-border/60 bg-nyra-panel p-5">
              <div className="flex items-center justify-between gap-3">
                <h2 className="text-sm font-medium">{s.name}</h2>
                <span
                  className={cn(
                    "rounded-full border px-2.5 py-1 text-[10px] uppercase tracking-[0.2em]",
                    s.active
                      ? "border-primary/50 text-primary"
                      : "border-border/60 text-muted-foreground",
                  )}
                >
                  {s.active ? "Active" : "Coming soon"}
                </span>
              </div>
              <p className="mt-2 text-sm text-muted-foreground">{s.desc}</p>
            </li>
          ))}
        </ul>

        <section className="rounded-2xl border border-border/60 bg-nyra-panel p-5">
          <h2 className="text-xs uppercase tracking-[0.3em] text-muted-foreground">Roadmap</h2>
          <ol className="mt-4 space-y-3">
            {phases.map(([title, desc]) => (
              <li key={title}>
                <p className="text-sm text-foreground">{title}</p>
                <p className="text-sm text-muted-foreground">{desc}</p>
              </li>
            ))}
          </ol>
        </section>
      </div>
    </NyraShell>
  );
}
