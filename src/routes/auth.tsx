import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { NyraShell } from "@/components/nyra/NyraShell";
import { supabase } from "@/integrations/supabase/client";
import { lovable } from "@/integrations/lovable/index";
import { useSession } from "@/hooks/useSession";

export const Route = createFileRoute("/auth")({
  head: () => ({
    meta: [
      { title: "Sign in to Nyra — your personal AI operating system" },
      {
        name: "description",
        content:
          "Sign in to Nyra to keep your memories, tasks and Google connections private to your own account.",
      },
      { property: "og:title", content: "Sign in to Nyra" },
      {
        property: "og:description",
        content: "Your voice-first AI operating system, private to your account.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: AuthPage,
});

/** Only same-origin relative paths may be used as a post-sign-in target. */
function safeNext(raw: string | null): string {
  if (!raw || !raw.startsWith("/") || raw.startsWith("//")) return "/";
  return raw;
}

function AuthPage() {
  const navigate = useNavigate();
  const { session, loading } = useSession();
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [next, setNext] = useState("/");

  useEffect(() => {
    setNext(safeNext(new URLSearchParams(window.location.search).get("next")));
  }, []);

  useEffect(() => {
    if (!loading && session) void navigate({ to: next, replace: true });
  }, [loading, session, next, navigate]);

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    setBusy(true);
    setMessage(null);
    try {
      if (mode === "signup") {
        const { data, error } = await supabase.auth.signUp({
          email,
          password,
          options: { emailRedirectTo: `${window.location.origin}${next}` },
        });
        if (error) throw error;
        if (!data.session) {
          setMessage("Check your email to confirm your account, then come back and sign in.");
          return;
        }
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
      }
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "That didn't work. Try again.");
    } finally {
      setBusy(false);
    }
  };

  const google = async () => {
    setBusy(true);
    setMessage(null);
    const result = await lovable.auth.signInWithOAuth("google", {
      redirect_uri: `${window.location.origin}/auth?next=${encodeURIComponent(next)}`,
    });
    if (result.error) {
      setMessage("Google sign-in failed. Please try again.");
      setBusy(false);
      return;
    }
    if (result.redirected) return;
    setBusy(false);
  };

  return (
    <NyraShell>
      <div className="mx-auto flex max-w-md flex-col gap-6 pt-10">
        <div className="text-center">
          <h1 className="text-3xl font-light tracking-tight">
            {mode === "signin" ? "Welcome back." : "Create your Nyra account."}
          </h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Your memories, tasks and Google connections stay private to your account.
          </p>
        </div>

        <form
          onSubmit={submit}
          className="space-y-3 rounded-2xl border border-border/60 bg-nyra-panel p-5 backdrop-blur"
        >
          <label className="block text-xs uppercase tracking-[0.2em] text-muted-foreground">
            Email
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              autoComplete="email"
              className="mt-1 min-h-11 w-full rounded-xl border border-border/60 bg-background/60 px-3 text-sm normal-case tracking-normal text-foreground outline-none focus:border-primary/70"
            />
          </label>
          <label className="block text-xs uppercase tracking-[0.2em] text-muted-foreground">
            Password
            <input
              type="password"
              required
              minLength={8}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete={mode === "signin" ? "current-password" : "new-password"}
              className="mt-1 min-h-11 w-full rounded-xl border border-border/60 bg-background/60 px-3 text-sm normal-case tracking-normal text-foreground outline-none focus:border-primary/70"
            />
          </label>
          <button
            type="submit"
            disabled={busy}
            className="min-h-11 w-full rounded-xl border border-primary/60 bg-primary/15 text-sm uppercase tracking-[0.2em] text-foreground transition-colors hover:bg-primary/25 disabled:opacity-50"
          >
            {mode === "signin" ? "Sign in" : "Create account"}
          </button>
        </form>

        <button
          type="button"
          onClick={() => void google()}
          disabled={busy}
          className="min-h-11 rounded-xl border border-border/60 bg-nyra-panel text-sm text-foreground transition-colors hover:border-primary/60 disabled:opacity-50"
        >
          Continue with Google
        </button>

        {message ? (
          <p className="text-center text-sm text-muted-foreground" role="status">
            {message}
          </p>
        ) : null}

        <button
          type="button"
          onClick={() => setMode(mode === "signin" ? "signup" : "signin")}
          className="text-xs uppercase tracking-[0.2em] text-muted-foreground hover:text-foreground"
        >
          {mode === "signin" ? "Need an account? Sign up" : "Already have an account? Sign in"}
        </button>
      </div>
    </NyraShell>
  );
}
