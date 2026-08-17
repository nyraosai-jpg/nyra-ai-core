// Nyra's tool registry. Every tool runs on the server; the browser only ever
// sees the compact result. Write tools are gated behind explicit confirmation.

import * as calendar from "../tools/calendar.server";
import * as spotify from "../tools/spotify.server";
import * as social from "../tools/social.server";
import { getWeather } from "../tools/weather.server";
import { webSearch } from "../tools/search.server";

export interface AgentContext {
  nowISO: string;
  timezone: string;
  location?: { latitude: number; longitude: number; label?: string | undefined } | undefined;
  memories: string[];
  tasks: Array<{ id: string; title: string; priority: string; status: string }>;
}

export type ClientAction =
  | { type: "remember"; content: string }
  | { type: "add_task"; title: string; priority: "low" | "normal" | "high" }
  | { type: "complete_task"; id: string }
  | { type: "request_location" };

export interface ToolDef {
  name: string;
  description: string;
  parameters: Record<string, unknown>;
  /** Write tools never execute until the user confirms. */
  requiresConfirmation?: boolean;
  available: () => boolean;
}

const obj = (properties: Record<string, unknown>, required: string[] = []) => ({
  type: "object",
  properties,
  required,
});
const str = (description: string) => ({ type: "string", description });
const num = (description: string) => ({ type: "number", description });

export const TOOLS: ToolDef[] = [
  {
    name: "get_weather",
    description:
      "Current conditions and the next two days. Uses the user's live location when available, otherwise pass a place name.",
    parameters: obj({ place: str("City name. Omit to use the user's current location.") }),
    available: () => true,
  },
  {
    name: "web_search",
    description:
      "Search the live web for facts, news, prices, opening hours, or anything you do not reliably know. Use it whenever the answer could be recent or specific.",
    parameters: obj({ query: str("Concise search query.") }, ["query"]),
    available: () => true,
  },
  {
    name: "request_location",
    description:
      "Ask the user's browser for their location. Only call this when location is genuinely needed and not already available.",
    parameters: obj({}),
    available: () => true,
  },
  {
    name: "calendar_list_events",
    description:
      "Read Google Calendar events in a time window. Use for 'what's today', 'am I free', conflict checks and briefings. Times are ISO 8601.",
    parameters: obj(
      {
        timeMin: str("Start of window, ISO 8601 with offset."),
        timeMax: str("End of window, ISO 8601 with offset."),
      },
      ["timeMin", "timeMax"],
    ),
    available: calendar.calendarConnected,
  },
  {
    name: "calendar_create_event",
    description: "Create a Google Calendar event. Requires the user's confirmation.",
    parameters: obj(
      {
        title: str("Event title."),
        start: str("Start, ISO 8601 with offset."),
        end: str("End, ISO 8601 with offset."),
        location: str("Optional location."),
        description: str("Optional notes."),
      },
      ["title", "start", "end"],
    ),
    requiresConfirmation: true,
    available: calendar.calendarConnected,
  },
  {
    name: "calendar_update_event",
    description:
      "Move or edit an existing event. Look the event up with calendar_list_events first to get its id. Requires the user's confirmation.",
    parameters: obj(
      {
        eventId: str("Event id from calendar_list_events."),
        eventTitle: str("Human readable title, used in the confirmation prompt."),
        title: str("New title."),
        start: str("New start, ISO 8601 with offset."),
        end: str("New end, ISO 8601 with offset."),
        location: str("New location."),
      },
      ["eventId"],
    ),
    requiresConfirmation: true,
    available: calendar.calendarConnected,
  },
  {
    name: "calendar_delete_event",
    description:
      "Cancel an event. Look it up with calendar_list_events first. Requires the user's confirmation.",
    parameters: obj(
      { eventId: str("Event id."), eventTitle: str("Human readable title for the prompt.") },
      ["eventId"],
    ),
    requiresConfirmation: true,
    available: calendar.calendarConnected,
  },
  {
    name: "remember",
    description:
      "Save a durable fact about the user (preferences, people, routines, goals). Call this proactively whenever the user reveals something worth keeping.",
    parameters: obj({ content: str("The fact, written in third person.") }, ["content"]),
    available: () => true,
  },
  {
    name: "add_task",
    description: "Add a task to the user's list.",
    parameters: obj(
      { title: str("Task title."), priority: { type: "string", enum: ["low", "normal", "high"] } },
      ["title"],
    ),
    available: () => true,
  },
  {
    name: "complete_task",
    description: "Mark one of the user's existing tasks as done, by its id.",
    parameters: obj({ id: str("Task id from the context.") }, ["id"]),
    available: () => true,
  },
  {
    name: "device_action",
    description:
      "Control a connected smart device or activate a scene. Only use ids returned by device_list.",
    parameters: obj(
      {
        id: str("Device or scene id."),
        action: {
          type: "string",
          enum: [
            "turn_on",
            "turn_off",
            "toggle",
            "set_brightness",
            "set_temperature",
            "set_volume",
            "lock",
            "unlock",
            "activate_scene",
          ],
        },
        value: num("Numeric value for brightness, temperature or volume."),
      },
      ["id", "action"],
    ),
    available: () =>
      Boolean(process.env["HOME_ASSISTANT_URL"] && process.env["HOME_ASSISTANT_TOKEN"]),
  },
  {
    name: "device_list",
    description: "List the connected smart devices and scenes with their current state.",
    parameters: obj({}),
    available: () =>
      Boolean(process.env["HOME_ASSISTANT_URL"] && process.env["HOME_ASSISTANT_TOKEN"]),
  },
  {
    name: "music_control",
    description: "Control Spotify playback on the user's account.",
    parameters: obj(
      {
        command: { type: "string", enum: ["play", "pause", "next", "previous", "status"] },
        query: str("Song or artist to play. Only with command 'play'."),
      },
      ["command"],
    ),
    available: spotify.spotifyConnected,
  },
];

export function availableTools() {
  return TOOLS.filter((t) => t.available());
}

export function toolSchemas() {
  return availableTools().map((t) => ({
    type: "function" as const,
    function: { name: t.name, description: t.description, parameters: t.parameters },
  }));
}

export function findTool(name: string) {
  return TOOLS.find((t) => t.name === name);
}

/** Human-readable description of a pending write, shown and spoken before acting. */
export function describeWrite(name: string, args: Record<string, unknown>): string {
  const when = (v: unknown) => {
    if (typeof v !== "string") return "";
    const d = new Date(v);
    return Number.isNaN(d.getTime()) ? v : d.toLocaleString();
  };
  switch (name) {
    case "calendar_create_event":
      return `Create “${args["title"]}” on ${when(args["start"])}`;
    case "calendar_update_event":
      return `Change “${args["eventTitle"] ?? args["eventId"]}”${
        args["start"] ? ` to ${when(args["start"])}` : ""
      }${args["title"] ? `, retitled “${args["title"]}”` : ""}`;
    case "calendar_delete_event":
      return `Cancel “${args["eventTitle"] ?? args["eventId"]}”`;
    default:
      return `Run ${name}`;
  }
}

export interface ExecOutcome {
  result: unknown;
  clientActions: ClientAction[];
  deviceActive?: boolean;
  memoryTouched?: boolean;
}

export async function executeTool(
  name: string,
  args: Record<string, unknown>,
  ctx: AgentContext,
): Promise<ExecOutcome> {
  const clientActions: ClientAction[] = [];
  const s = (k: string) => (typeof args[k] === "string" ? (args[k] as string) : undefined);
  const n = (k: string) => (typeof args[k] === "number" ? (args[k] as number) : undefined);

  switch (name) {
    case "get_weather": {
      const place = s("place");
      const result = await getWeather({
        ...(place ? { place } : {}),
        ...(!place && ctx.location
          ? { latitude: ctx.location.latitude, longitude: ctx.location.longitude }
          : {}),
        timezone: ctx.timezone,
      });
      return { result, clientActions };
    }
    case "web_search":
      return { result: await webSearch(s("query") ?? ""), clientActions };

    case "request_location":
      clientActions.push({ type: "request_location" });
      return {
        result: ctx.location
          ? { ok: true, alreadyKnown: ctx.location.label ?? "known" }
          : { ok: true, asked: true, note: "Permission prompt shown. Tell the user to allow it." },
        clientActions,
      };

    case "calendar_list_events": {
      const result = await calendar.listEvents({
        timeMin: s("timeMin") ?? ctx.nowISO,
        timeMax: s("timeMax") ?? ctx.nowISO,
      });
      return { result, clientActions };
    }
    case "calendar_create_event": {
      const title = s("title") ?? "Untitled";
      const result = await calendar.createEvent({
        title,
        start: s("start") ?? ctx.nowISO,
        end: s("end") ?? ctx.nowISO,
        ...(s("location") ? { location: s("location")! } : {}),
        ...(s("description") ? { description: s("description")! } : {}),
        timezone: ctx.timezone,
      });
      return { result, clientActions };
    }
    case "calendar_update_event": {
      const result = await calendar.updateEvent({
        eventId: s("eventId") ?? "",
        ...(s("title") ? { title: s("title")! } : {}),
        ...(s("start") ? { start: s("start")! } : {}),
        ...(s("end") ? { end: s("end")! } : {}),
        ...(s("location") ? { location: s("location")! } : {}),
        timezone: ctx.timezone,
      });
      return { result, clientActions };
    }
    case "calendar_delete_event":
      return { result: await calendar.deleteEvent({ eventId: s("eventId") ?? "" }), clientActions };

    case "remember": {
      const content = s("content") ?? "";
      if (content) clientActions.push({ type: "remember", content });
      return { result: { ok: Boolean(content) }, clientActions, memoryTouched: true };
    }
    case "add_task": {
      const title = s("title") ?? "";
      const priority = (s("priority") as "low" | "normal" | "high") ?? "normal";
      if (title) clientActions.push({ type: "add_task", title, priority });
      return { result: { ok: Boolean(title), title }, clientActions };
    }
    case "complete_task": {
      const id = s("id") ?? "";
      const task = ctx.tasks.find((t) => t.id === id);
      if (task) clientActions.push({ type: "complete_task", id });
      return { result: task ? { ok: true, title: task.title } : { ok: false, error: "No such task." }, clientActions };
    }

    case "device_list": {
      const { listDevices } = await import("../devices.server");
      try {
        return { result: { ok: true, ...(await listDevices()) }, clientActions };
      } catch {
        return { result: { ok: false, error: "Device bridge unreachable." }, clientActions };
      }
    }
    case "device_action": {
      const { runDeviceAction } = await import("../devices.server");
      try {
        const device = await runDeviceAction(
          s("id") ?? "",
          (s("action") ?? "toggle") as never,
          n("value"),
        );
        return { result: { ok: true, device }, clientActions, deviceActive: true };
      } catch {
        return { result: { ok: false, error: "The device didn't confirm the change." }, clientActions };
      }
    }

    case "music_control": {
      const command = s("command") ?? "status";
      if (command === "status") return { result: await spotify.nowPlaying(), clientActions };
      if (command === "play" && s("query")) {
        return { result: await spotify.playSearch(s("query")!), clientActions, deviceActive: true };
      }
      return {
        result: await spotify.playbackCommand(command as "play" | "pause" | "next" | "previous"),
        clientActions,
        deviceActive: true,
      };
    }

    default:
      return { result: { ok: false, error: `Unknown tool ${name}` }, clientActions };
  }
}
