import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { NyraShell } from "@/components/nyra/NyraShell";
import { getNyraStatus } from "@/lib/nyra/ai.functions";
import { conversationStore, settingsStore } from "@/lib/nyra/storage";
import { locationStore, requestLocation } from "@/lib/nyra/location";
import { isSpeechRecognitionSupported } from "@/lib/nyra/stt";
import type { NyraSettings } from "@/lib/nyra/types";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/settings")({
  head: () => ({
    meta: [
      { title: "Settings — Nyra" },
      { name: "description", content: "Configure Nyra's AI provider, voice, microphone, memory and privacy." },
      { property: "og:title", content: "Settings — Nyra" },
      { property: "og:description", content: "AI provider, voice output, isolation, memory and privacy controls." },
    ],
  }),
  loader: () => getNyraStatus(),
  component: SettingsPage,
});

function SettingsPage() {
  const status = Route.useLoaderData();
  const [settings, setSettings] = useState<NyraSettings>(() => settingsStore.get());
  const [micSupported, setMicSupported] = useState(false);
  const [locationLabel, setLocationLabel] = useState("Not shared");

  useEffect(() => {
    setSettings(settingsStore.get());
    setMicSupported(isSpeechRecognitionSupported());
    const loc = locationStore.get();
    setLocationLabel(loc ? loc.label ?? `${loc.latitude}, ${loc.longitude}` : "Not shared");
  }, []);

  const update = (patch: Partial<NyraSettings>) => {
    settingsStore.set(patch);
    setSettings(settingsStore.get());
  };

  return (
    <NyraShell>
      <div className="space-y-5 py-6">
        <header>
          <h1 className="text-2xl font-light tracking-tight">Settings</h1>
        </header>

        <Section title="AI provider">
          <Row label="Provider" value="Groq" />
          <Row label="Model" value={status.aiModel} />
          <Row
            label="Status"
            value={status.aiConfigured ? "Connected" : "Not configured — set GROQ_API_KEY"}
          />
        </Section>

        <Section title="Voice">
          <Row
            label="ElevenLabs"
            value={status.ttsConfigured ? "Connected" : "Not configured — set ELEVENLABS_API_KEY"}
          />
          <Toggle
            label="Speak replies aloud"
            checked={settings.voiceOutputEnabled}
            onChange={(v) => update({ voiceOutputEnabled: v })}
          />
          <Toggle
            label="Voice isolation (noise suppression, echo cancellation)"
            checked={settings.voiceIsolation}
            onChange={(v) => update({ voiceIsolation: v })}
          />
          <div className="flex items-center justify-between gap-4 py-2">
            <label htmlFor="lang" className="text-sm text-muted-foreground">
              Recognition language
            </label>
            <select
              id="lang"
              value={settings.language}
              onChange={(e) => update({ language: e.target.value })}
              className="min-h-10 rounded-xl border border-border/50 bg-background/40 px-3 text-sm focus-visible:ring-2 focus-visible:ring-ring"
            >
              {["en-US", "en-GB", "pl-PL", "es-ES", "fr-FR", "de-DE"].map((l) => (
                <option key={l} value={l}>
                  {l}
                </option>
              ))}
            </select>
          </div>
        </Section>

        <Section title="Microphone">
          <Row
            label="Browser support"
            value={micSupported ? "Ready" : "Unsupported — use text input"}
          />
          <p className="pt-1 text-xs text-muted-foreground">
            Nyra requests permission each session and never records in the background.
          </p>
        </Section>

        <Section title="Memory">
          <Toggle
            label="Memory enabled"
            checked={settings.memoryEnabled}
            onChange={(v) => update({ memoryEnabled: v })}
          />
          <button
            type="button"
            onClick={() => conversationStore.clear()}
            className="mt-2 min-h-10 rounded-xl border border-border/60 bg-secondary px-4 text-sm text-secondary-foreground hover:border-primary/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            Clear conversation history
          </button>
        </Section>

        <Section title="Connections">
          <Row label="Google Calendar" value={status.calendarConnected ? "Connected" : "Not connected"} />
          <Row label="Spotify" value={status.musicConnected ? "Connected" : "Not connected"} />
          <Row label="Web search" value="Live" />
          <Row label="Location" value={locationLabel} />
          <button
            type="button"
            onClick={async () => {
              const loc = await requestLocation();
              setLocationLabel(loc ? `${loc.latitude}, ${loc.longitude}` : "Permission declined");
            }}
            className="mt-2 min-h-10 rounded-xl border border-border/60 bg-secondary px-4 text-sm text-secondary-foreground hover:border-primary/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            Share location
          </button>
          <button
            type="button"
            onClick={() => {
              locationStore.clear();
              setLocationLabel("Not shared");
            }}
            className="ml-2 mt-2 min-h-10 rounded-xl border border-border/60 px-4 text-sm text-muted-foreground hover:border-destructive/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            Forget location
          </button>
        </Section>

        <Section title="Privacy & protection">
          <p className="text-sm text-muted-foreground">
            Memories, tasks, conversation and your location are stored locally in this browser.
            Audio is transcribed by your browser's speech engine and is not saved. Message text is
            sent to Groq for reasoning and to ElevenLabs for speech. All API keys and account
            connections stay server-side and are never exposed to the browser.
          </p>
          <p className="pt-2 text-sm text-muted-foreground">
            Every action that changes something — a calendar edit, a device command — is described
            and approved before it runs, and logged in Activity. Web pages and calendar content are
            treated as untrusted data, so a malicious page can't instruct Nyra to act on your
            behalf.
          </p>
        </Section>


        <Section title="Appearance">
          <Row label="Theme" value="Midnight (default)" />
        </Section>
      </div>
    </NyraShell>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="rounded-2xl border border-border/60 bg-nyra-panel p-5">
      <h2 className="text-xs uppercase tracking-[0.3em] text-muted-foreground">{title}</h2>
      <div className="mt-3 space-y-1">{children}</div>
    </section>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-4 py-1.5 text-sm">
      <span className="text-muted-foreground">{label}</span>
      <span className="text-right text-foreground">{value}</span>
    </div>
  );
}

function Toggle({
  label,
  checked,
  onChange,
}: {
  label: string;
  checked: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      onClick={() => onChange(!checked)}
      className="flex w-full items-center justify-between gap-4 py-2 text-left text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
    >
      <span className="text-muted-foreground">{label}</span>
      <span
        className={cn(
          "relative h-6 w-11 shrink-0 rounded-full border transition-colors",
          checked ? "border-primary bg-primary/30" : "border-border/70 bg-background/40",
        )}
      >
        <span
          className={cn(
            "absolute top-0.5 h-4 w-4 rounded-full bg-foreground transition-all",
            checked ? "left-6" : "left-0.5",
          )}
        />
      </span>
    </button>
  );
}
