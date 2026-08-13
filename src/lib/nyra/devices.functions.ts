import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import type { Device, DeviceAction, IntegrationStatus, Scene } from "./types";

export const DEVICE_ACTIONS = [
  "turn_on",
  "turn_off",
  "toggle",
  "set_brightness",
  "set_temperature",
  "set_volume",
  "lock",
  "unlock",
  "activate_scene",
] as const;

export const ActionInput = z.object({
  id: z.string().min(3).max(120),
  action: z.enum(DEVICE_ACTIONS),
  value: z.number().min(-50).max(1000).optional(),
});

export type DeviceListResult =
  | { ok: true; devices: Device[]; scenes: Scene[] }
  | { ok: false; reason: "not_configured" | "failed"; error: string; devices: []; scenes: [] };

export type DeviceActionResult =
  | { ok: true; device: Device }
  | { ok: false; reason: "not_configured" | "failed" | "unsupported"; error: string };

/** Real integration status. Never fabricated, never exposes secret values. */
export const getIntegrationStatus = createServerFn({ method: "GET" }).handler(
  async (): Promise<IntegrationStatus[]> => {
    const haUrl = process.env["HOME_ASSISTANT_URL"];
    const haToken = process.env["HOME_ASSISTANT_TOKEN"];
    let haConnected = false;
    if (haUrl && haToken) {
      const { pingBridge } = await import("./devices.server");
      haConnected = await pingBridge();
    }

    return [
      {
        id: "groq",
        name: "Groq",
        category: "ai",
        status: process.env["GROQ_API_KEY"] ? "connected" : "not_configured",
        detail: process.env["GROQ_MODEL"] || "llama-3.3-70b-versatile",
        envKeys: ["GROQ_API_KEY", "GROQ_MODEL"],
      },
      {
        id: "elevenlabs",
        name: "ElevenLabs",
        category: "voice",
        status: process.env["ELEVENLABS_API_KEY"] ? "connected" : "not_configured",
        detail: "Text to speech",
        envKeys: ["ELEVENLABS_API_KEY"],
      },
      {
        id: "memory",
        name: "Local memory",
        category: "memory",
        status: "connected",
        detail: "Stored in this browser",
        envKeys: [],
      },
      {
        id: "home_assistant",
        name: "Home Assistant",
        category: "devices",
        status: !haUrl || !haToken ? "not_configured" : haConnected ? "connected" : "error",
        detail:
          !haUrl || !haToken
            ? "Set HOME_ASSISTANT_URL and HOME_ASSISTANT_TOKEN"
            : haConnected
              ? "Bridge reachable"
              : "Configured but unreachable",
        envKeys: ["HOME_ASSISTANT_URL", "HOME_ASSISTANT_TOKEN"],
      },
      {
        id: "matter",
        name: "Matter",
        category: "devices",
        status: "planned",
        detail: "Device abstraction is bridge-agnostic and ready",
        envKeys: [],
      },
      {
        id: "vision",
        name: "Vision",
        category: "vision",
        status: "planned",
        detail: "Camera stays off until explicitly enabled",
        envKeys: [],
      },
      {
        id: "calendar",
        name: "Google Calendar",
        category: "productivity",
        status: "planned",
        envKeys: [],
      },
      { id: "gmail", name: "Gmail", category: "productivity", status: "planned", envKeys: [] },
      { id: "spotify", name: "Spotify", category: "media", status: "planned", envKeys: [] },
      { id: "weather", name: "Weather", category: "context", status: "planned", envKeys: [] },
      { id: "location", name: "Location", category: "context", status: "planned", envKeys: [] },
      { id: "search", name: "Web search", category: "context", status: "planned", envKeys: [] },
    ];
  },
);

export const listDevicesFn = createServerFn({ method: "GET" }).handler(
  async (): Promise<DeviceListResult> => {
    if (!process.env["HOME_ASSISTANT_URL"] || !process.env["HOME_ASSISTANT_TOKEN"]) {
      return {
        ok: false,
        reason: "not_configured",
        error: "No device bridge is connected yet.",
        devices: [],
        scenes: [],
      };
    }
    try {
      const { listDevices } = await import("./devices.server");
      const { devices, scenes } = await listDevices();
      return { ok: true, devices, scenes };
    } catch (e) {
      console.error("device list failed", e);
      return {
        ok: false,
        reason: "failed",
        error: "Nyra couldn't reach your home bridge.",
        devices: [],
        scenes: [],
      };
    }
  },
);

export const runDeviceActionFn = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) => ActionInput.parse(data))
  .handler(async ({ data }): Promise<DeviceActionResult> => {
    if (!process.env["HOME_ASSISTANT_URL"] || !process.env["HOME_ASSISTANT_TOKEN"]) {
      return {
        ok: false,
        reason: "not_configured",
        error: "No device bridge is connected yet.",
      };
    }
    try {
      const { getDevice, runDeviceAction } = await import("./devices.server");
      const existing = await getDevice(data.id);
      if (!existing) return { ok: false, reason: "failed", error: "That device isn't available." };
      if (
        existing.capabilities.length > 0 &&
        !existing.capabilities.includes(data.action) &&
        data.action !== "activate_scene"
      ) {
        return {
          ok: false,
          reason: "unsupported",
          error: `${existing.name} doesn't support that.`,
        };
      }
      const device = await runDeviceAction(data.id, data.action as DeviceAction, data.value);
      return { ok: true, device };
    } catch (e) {
      console.error("device action failed", e);
      return { ok: false, reason: "failed", error: "The device didn't confirm the change." };
    }
  });
