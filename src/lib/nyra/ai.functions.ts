import { createServerFn } from "@tanstack/react-start";
import { AgentTurnInput, ConfirmInput } from "./agent/schema";
import type { ClientAction } from "./agent/tools.server";

export type NyraReply = {
  text: string;
  demo: boolean;
  error?: string;
  clientActions?: ClientAction[];
  toolsUsed?: string[];
  deviceActive?: boolean;
  memoryTouched?: boolean;
  pending?: { tool: string; argsJson: string; summary: string };
};

/** Runtime configuration status. Safe to expose: contains no secrets. */
export const getNyraStatus = createServerFn({ method: "GET" }).handler(async () => {
  return {
    aiConfigured: Boolean(process.env["GROQ_API_KEY"]),
    aiProvider: "Groq",
    aiModel: process.env["GROQ_MODEL"] || "llama-3.3-70b-versatile",
    ttsConfigured: Boolean(process.env["ELEVENLABS_API_KEY"]),
    ttsProvider: "ElevenLabs",
    calendarConnected: Boolean(process.env["LOVABLE_API_KEY"] && process.env["GOOGLE_CALENDAR_API_KEY"]),
    musicConnected: Boolean(process.env["LOVABLE_API_KEY"] && process.env["SPOTIFY_API_KEY"]),
    searchConnected: true,
  };
});

/** One reasoning turn: the brain may call tools before answering. */
export const nyraTurn = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) => AgentTurnInput.parse(data))
  .handler(async ({ data }): Promise<NyraReply> => {
    const { runAgent } = await import("./agent/run.server");
    const turn = await runAgent(data.messages, {
      nowISO: data.context.nowISO,
      timezone: data.context.timezone,
      location: data.context.location,
      memories: data.context.memories,
      tasks: data.context.tasks,
    });
    return turn;
  });

/** Executes a calendar (or other write) action the user just approved. */
export const nyraConfirm = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) => ConfirmInput.parse(data))
  .handler(async ({ data }): Promise<NyraReply> => {
    const { runConfirmed } = await import("./agent/run.server");
    let args: Record<string, unknown> = {};
    try {
      args = JSON.parse(data.argsJson) as Record<string, unknown>;
    } catch {
      args = {};
    }
    return runConfirmed(data.tool, args, {
      nowISO: data.context.nowISO,
      timezone: data.context.timezone,
      location: data.context.location,
      memories: data.context.memories,
      tasks: data.context.tasks,
    });
  });
