// Home Assistant bridge — SERVER ONLY.
// This is the first concrete implementation of the DeviceBridge contract.
// Matter / other bridges can be added later behind the same interface without
// touching skills, routes or UI.

import type { Device, DeviceAction, DeviceType, Scene } from "./types";

export interface BridgeConfig {
  url: string;
  token: string;
}

export function getHomeAssistantConfig(): BridgeConfig | null {
  const url = process.env["HOME_ASSISTANT_URL"];
  const token = process.env["HOME_ASSISTANT_TOKEN"];
  if (!url || !token) return null;
  return { url: url.replace(/\/+$/, ""), token };
}

const DOMAIN_TO_TYPE: Record<string, DeviceType> = {
  light: "light",
  switch: "switch",
  fan: "fan",
  climate: "thermostat",
  media_player: "speaker",
  lock: "lock",
  sensor: "sensor",
  binary_sensor: "sensor",
  camera: "camera",
  cover: "switch",
  vacuum: "switch",
};

interface HAState {
  entity_id: string;
  state: string;
  attributes: Record<string, unknown>;
}

async function ha(path: string, init?: RequestInit): Promise<Response> {
  const config = getHomeAssistantConfig();
  if (!config) throw new Error("home_assistant_not_configured");
  return fetch(`${config.url}${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${config.token}`,
      "Content-Type": "application/json",
      ...(init?.headers ?? {}),
    },
  });
}

function capabilitiesFor(domain: string, attrs: Record<string, unknown>): string[] {
  const caps: string[] = [];
  if (["light", "switch", "fan", "media_player", "climate"].includes(domain)) {
    caps.push("turn_on", "turn_off", "toggle");
  }
  if (domain === "light" && "brightness" in attrs) caps.push("set_brightness");
  if (domain === "climate") caps.push("set_temperature");
  if (domain === "media_player") caps.push("set_volume");
  if (domain === "lock") caps.push("lock", "unlock");
  return caps;
}

function toDevice(s: HAState, areaByEntity: Record<string, string>): Device | null {
  const domain = s.entity_id.split(".")[0] ?? "";
  const type = DOMAIN_TO_TYPE[domain];
  if (!type) return null;
  const attrs = s.attributes ?? {};
  const brightness = typeof attrs["brightness"] === "number" ? (attrs["brightness"] as number) : undefined;

  return {
    id: s.entity_id,
    name: (attrs["friendly_name"] as string) || s.entity_id,
    type,
    room: areaByEntity[s.entity_id] ?? "Unassigned",
    manufacturer: "Home Assistant",
    capabilities: capabilitiesFor(domain, attrs),
    connected: s.state !== "unavailable" && s.state !== "unknown",
    state: {
      value: s.state,
      on: s.state === "on" || s.state === "playing" || s.state === "heat" || s.state === "cool",
      ...(brightness !== undefined ? { brightness: Math.round((brightness / 255) * 100) } : {}),
      ...(typeof attrs["current_temperature"] === "number"
        ? { temperature: attrs["current_temperature"] as number }
        : {}),
      ...(typeof attrs["unit_of_measurement"] === "string"
        ? { unit: attrs["unit_of_measurement"] as string }
        : {}),
    },
  };
}

/** Best-effort area lookup. Older HA versions may not expose the template API. */
async function fetchAreaMap(): Promise<Record<string, string>> {
  try {
    const res = await ha("/api/template", {
      method: "POST",
      body: JSON.stringify({
        template:
          "{% set ns = namespace(items=[]) %}{% for s in states %}{% set a = area_name(s.entity_id) %}{% if a %}{% set ns.items = ns.items + [s.entity_id ~ '|' ~ a] %}{% endif %}{% endfor %}{{ ns.items | join(';;') }}",
      }),
    });
    if (!res.ok) return {};
    const text = await res.text();
    const map: Record<string, string> = {};
    for (const pair of text.split(";;")) {
      const [entity, area] = pair.split("|");
      if (entity && area) map[entity.trim()] = area.trim();
    }
    return map;
  } catch {
    return {};
  }
}

export async function listDevices(): Promise<{ devices: Device[]; scenes: Scene[] }> {
  const res = await ha("/api/states");
  if (!res.ok) throw new Error(`home_assistant_error_${res.status}`);
  const states = (await res.json()) as HAState[];
  const areaByEntity = await fetchAreaMap();

  const devices = states
    .map((s) => toDevice(s, areaByEntity))
    .filter((d): d is Device => d !== null);

  const scenes: Scene[] = states
    .filter((s) => s.entity_id.startsWith("scene.") || s.entity_id.startsWith("script."))
    .map((s) => ({
      id: s.entity_id,
      name: (s.attributes?.["friendly_name"] as string) || s.entity_id,
      source: "home_assistant" as const,
    }));

  return { devices, scenes };
}

export async function getDevice(id: string): Promise<Device | null> {
  const res = await ha(`/api/states/${encodeURIComponent(id)}`);
  if (res.status === 404) return null;
  if (!res.ok) throw new Error(`home_assistant_error_${res.status}`);
  const state = (await res.json()) as HAState;
  const areaByEntity = await fetchAreaMap();
  return toDevice(state, areaByEntity);
}

async function callService(domain: string, service: string, payload: Record<string, unknown>) {
  const res = await ha(`/api/services/${domain}/${service}`, {
    method: "POST",
    body: JSON.stringify(payload),
  });
  if (!res.ok) throw new Error(`home_assistant_error_${res.status}`);
}

/** Executes a validated action and returns the device state HA actually reports back. */
export async function runDeviceAction(
  id: string,
  action: DeviceAction,
  value?: number,
): Promise<Device> {
  const domain = id.split(".")[0] ?? "";
  const target = { entity_id: id };

  switch (action) {
    case "turn_on":
    case "turn_off":
    case "toggle":
      await callService(domain, action, target);
      break;
    case "set_brightness":
      await callService("light", "turn_on", {
        ...target,
        brightness_pct: Math.max(0, Math.min(100, value ?? 100)),
      });
      break;
    case "set_temperature":
      await callService("climate", "set_temperature", { ...target, temperature: value ?? 20 });
      break;
    case "set_volume":
      await callService("media_player", "volume_set", {
        ...target,
        volume_level: Math.max(0, Math.min(100, value ?? 50)) / 100,
      });
      break;
    case "lock":
    case "unlock":
      await callService("lock", action, target);
      break;
    case "activate_scene":
      await callService(domain === "script" ? "script" : "scene", domain === "script" ? "turn_on" : "turn_on", target);
      break;
  }

  // Give HA a moment to settle, then report the REAL resulting state.
  await new Promise((r) => setTimeout(r, 350));
  const device = await getDevice(id);
  if (!device) throw new Error("device_not_found");
  return device;
}

export async function pingBridge(): Promise<boolean> {
  try {
    const res = await ha("/api/");
    return res.ok;
  } catch {
    return false;
  }
}
