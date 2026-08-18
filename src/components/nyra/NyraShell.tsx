import { Link } from "@tanstack/react-router";
import type { ReactNode } from "react";
import { Activity, Brain, Home, Lightbulb, ListTodo, Link2, Settings, Share2, Sparkles } from "lucide-react";
import { Starfield } from "@/components/nyra/Starfield";

const nav = [
  { to: "/", label: "Home", icon: Home },
  { to: "/memory", label: "Memory", icon: Brain },
  { to: "/tasks", label: "Tasks", icon: ListTodo },
  { to: "/devices", label: "Devices", icon: Lightbulb },
  { to: "/social", label: "Social", icon: Share2 },
  { to: "/connections", label: "Connect", icon: Link2 },
  { to: "/skills", label: "Skills", icon: Sparkles },
  { to: "/activity", label: "Activity", icon: Activity },
  { to: "/settings", label: "Settings", icon: Settings },
] as const;

export function NyraShell({ children }: { children: ReactNode }) {
  return (
    <div className="relative min-h-screen bg-background text-foreground">
      <div className="pointer-events-none absolute inset-0 bg-nyra-aurora" aria-hidden="true" />
      <Starfield count={110} className="fixed inset-0 z-0" />
      <div className="relative mx-auto flex min-h-screen w-full max-w-5xl flex-col px-4 pb-28 pt-6 sm:px-6">
        <header className="flex items-center justify-between">
          <Link to="/" className="group inline-flex items-baseline gap-2">
            <span className="text-lg font-semibold tracking-[0.4em] text-foreground">NYRA</span>
            <span className="text-[10px] uppercase tracking-[0.3em] text-muted-foreground">os</span>
          </Link>
        </header>
        <main className="flex-1">{children}</main>
      </div>

      <nav
        aria-label="Nyra sections"
        className="fixed inset-x-0 bottom-0 z-20 border-t border-border/60 bg-nyra-panel backdrop-blur-xl"
      >
        <ul className="mx-auto flex max-w-5xl items-center justify-between gap-1 overflow-x-auto px-2 py-2 sm:justify-center sm:gap-3">
          {nav.map(({ to, label, icon: Icon }) => (
            <li key={to}>
              <Link
                to={to}
                activeOptions={{ exact: to === "/" }}
                activeProps={{ className: "text-primary" }}
                className="flex min-h-14 min-w-12 shrink-0 flex-col items-center justify-center gap-1 rounded-xl px-3 text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                <Icon className="h-5 w-5" aria-hidden="true" />
                <span className="text-[11px]">{label}</span>
              </Link>
            </li>
          ))}
        </ul>
      </nav>
    </div>
  );
}
