import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { NyraShell } from "@/components/nyra/NyraShell";
import { NyraOrb } from "@/components/nyra/NyraOrb";
import { NyraStatus } from "@/components/nyra/NyraStatus";
import { VoiceButton } from "@/components/nyra/VoiceButton";
import { ConversationPanel } from "@/components/nyra/ConversationPanel";
import { StatusPill } from "@/components/nyra/SystemStatus";
import { useNyra } from "@/hooks/useNyra";
import { getNyraStatus } from "@/lib/nyra/ai.functions";
import { getIntegrationStatus } from "@/lib/nyra/devices.functions";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Nyra — Your personal AI operating system" },
      {
        name: "description",
        content:
          "Nyra listens, understands, routes, acts and remembers. A living, voice-first personal AI operating system.",
      },
      { property: "og:title", content: "Nyra — Your personal AI operating system" },
      {
        property: "og:description",
        content: "Speak. Think. Remember. Act. Nyra is a voice-first personal AI operating system.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  loader: async () => ({
    status: await getNyraStatus(),
    integrations: await getIntegrationStatus(),
  }),
  component: HomePage,
});

function greeting() {
  const h = new Date().getHours();
  if (h < 5) return "Still awake.";
  if (h < 12) return "Good morning.";
  if (h < 18) return "Good afternoon.";
  return "Good evening.";
}

function HomePage() {
  const { status, integrations } = Route.useLoaderData();
  const nyra = useNyra(status);
  const [hello, setHello] = useState("Hello.");
  const [micSupported, setMicSupported] = useState(false);

  useEffect(() => {
    setHello(greeting());
    setMicSupported(nyra.micSupported);
  }, [nyra.micSupported]);

  const devices = integrations.find((i) => i.id === "home_assistant");

  return (
    <NyraShell>
      <div className="flex flex-col items-center gap-8 pt-6 sm:pt-10">
        <div className="text-center">
          <h1 className="text-3xl font-light tracking-tight sm:text-4xl">{hello}</h1>
          <p className="mt-2 text-muted-foreground">How can I help?</p>
        </div>

        <NyraOrb state={nyra.state} level={nyra.level} />

        <NyraStatus label={nyra.statusLabel} detail={nyra.partial || undefined} />

        <div className="flex flex-col items-center gap-3">
          <VoiceButton
            state={nyra.state}
            disabled={!micSupported}
            onStart={() => void nyra.startListening()}
            onStop={() => {
              nyra.stopListening();
              nyra.stopSpeaking();
            }}
          />
          <button
            type="button"
            onClick={() => void nyra.setHandsFree(!nyra.settings.handsFree)}
            disabled={!micSupported}
            className="min-h-10 rounded-full border border-border/60 bg-nyra-panel px-4 text-xs uppercase tracking-[0.2em] text-muted-foreground transition-colors hover:border-primary/60 hover:text-foreground disabled:opacity-50"
          >
            {nyra.settings.handsFree ? "Hands-free on" : "Hands-free off"}
          </button>
          <p className="max-w-xs text-center text-[11px] text-muted-foreground">
            {nyra.settings.handsFree
              ? `Say “${nyra.settings.wakeWord}” followed by your request. Only works while this tab is open.`
              : "Turn on hands-free to wake Nyra with your voice."}
          </p>
        </div>

        <div className="flex flex-wrap items-center justify-center gap-2">
          <StatusPill
            label="AI"
            ok={status.aiConfigured}
            okText={status.aiModel}
            offText="Not configured"
          />
          <StatusPill
            label="Voice"
            ok={status.ttsConfigured}
            okText="ElevenLabs ready"
            offText="Not configured"
          />
          <StatusPill label="Memory" ok okText="Online" offText="Off" />
          <StatusPill
            label="Devices"
            ok={devices?.status === "connected"}
            okText="Home Assistant"
            offText="Not connected"
          />
          <StatusPill
            label="Mic"
            ok={micSupported}
            okText={nyra.audioReactive ? "Audio-reactive" : "Ready"}
            offText="Unsupported browser"
          />
        </div>

        <ConversationPanel
          messages={nyra.messages}
          partial={nyra.partial}
          disabled={nyra.state === "thinking"}
          onSend={(text) => void nyra.send(text)}
        />

        <p className="max-w-xl text-center text-xs leading-relaxed text-muted-foreground">
          Nyra only listens while you activate listening or hands-free mode. Audio is processed in
          your browser and never stored. Replies are generated by an external AI provider when
          configured.
        </p>
      </div>
    </NyraShell>
  );
}
