// DEVICE_CONTROL / DEVICE_STATUS / SCENE_CONTROL skills.
// These talk to the device service (server functions), never to Home Assistant
// directly, and never claim success unless the service confirms it.

import { listDevicesFn, runDeviceActionFn } from "../devices.functions";
import type { Device, DeviceAction, SkillResult } from "../types";

const norm = (s: string) => s.toLowerCase().trim();

const DEVICE_WORDS =
  /(light|lights|lamp|thermostat|temperature|heating|fan|tv|television|speaker|music|lock|door|switch|plug|blinds?|curtains?)/;

export function isDeviceControl(input: string): boolean {
  const t = norm(input);
  if (/^(activate|run|start)\s+(scene|movie mode|good morning|good night|focus|relax)/.test(t)) return true;
  return (
    (/(turn|switch|set|dim|brighten|lock|unlock|open|close|play|pause)/.test(t) &&
      DEVICE_WORDS.test(t)) ||
    /turn (everything|it all) off/.test(t)
  );
}

export function isDeviceStatus(input: string): boolean {
  const t = norm(input);
  return (
    /(what devices|which devices|devices connected|is the .* (on|off)|what'?s the temperature|are the .* on)/.test(
      t,
    ) || /(device status|my home status)/.test(t)
  );
}

export function isSceneControl(input: string): boolean {
  return /(activate|run)\s+.*(scene|mode)/.test(norm(input));
}

function scoreDevice(device: Device, text: string): number {
  const t = norm(text);
  let score = 0;
  const name = norm(device.name);
  if (t.includes(name)) score += 6;
  for (const word of name.split(/\s+/)) {
    if (word.length > 2 && t.includes(word)) score += 2;
  }
  const room = norm(device.room);
  if (room && room !== "unassigned" && t.includes(room)) score += 4;
  if (device.type === "light" && /(light|lights|lamp)/.test(t)) score += 2;
  if (device.type === "thermostat" && /(temperature|thermostat|heating)/.test(t)) score += 2;
  if (device.type === "speaker" && /(speaker|music|tv|television)/.test(t)) score += 2;
  if (device.type === "lock" && /(lock|door)/.test(t)) score += 2;
  if (device.type === "fan" && /\bfan\b/.test(t)) score += 2;
  return score;
}

function parseAction(text: string): { action: DeviceAction; value?: number } | null {
  const t = norm(text);
  const number = t.match(/(\d{1,3})\s*(%|percent|degrees?)?/);
  const value = number?.[1] ? Number(number[1]) : undefined;

  if (/\bunlock\b/.test(t)) return { action: "unlock" };
  if (/\block\b/.test(t)) return { action: "lock" };
  if (/(dim|set).*(to\s*\d{1,3}\s*(%|percent))/.test(t) && value !== undefined)
    return { action: "set_brightness", value };
  if (/(temperature|thermostat|degrees)/.test(t) && value !== undefined)
    return { action: "set_temperature", value };
  if (/volume/.test(t) && value !== undefined) return { action: "set_volume", value };
  if (/(turn|switch|put)\s+(on|up)/.test(t) || /\bon\b/.test(t.replace(/turn off/g, "")))
    return { action: "turn_on" };
  if (/(turn|switch)\s+off/.test(t) || /\boff\b/.test(t)) return { action: "turn_off" };
  if (/toggle/.test(t)) return { action: "toggle" };
  return null;
}

function describe(device: Device): string {
  const s = device.state;
  if (s.temperature !== undefined) return `${device.name} is at ${s.temperature}${s.unit ?? "°"}`;
  if (s.brightness !== undefined && s.on) return `${device.name} is on at ${s.brightness}%`;
  if (s.on !== undefined) return `${device.name} is ${s.on ? "on" : "off"}`;
  return `${device.name} is ${s.value}`;
}

const NOT_CONNECTED =
  "No home bridge is connected yet, so I can't control anything physical. Open Devices to connect your home.";

export async function runDeviceStatusSkill(input: string): Promise<SkillResult> {
  const list = await listDevicesFn();
  if (!list.ok) {
    return { handled: true, intent: "DEVICE_STATUS", text: NOT_CONNECTED };
  }
  const scored = list.devices
    .map((d) => ({ d, score: scoreDevice(d, input) }))
    .filter((x) => x.score >= 4)
    .sort((a, b) => b.score - a.score);

  if (scored.length === 0) {
    const rooms = new Set(list.devices.map((d) => d.room));
    return {
      handled: true,
      intent: "DEVICE_STATUS",
      text: list.devices.length
        ? `You have ${list.devices.length} devices across ${rooms.size} ${rooms.size === 1 ? "room" : "rooms"}.`
        : "Your bridge is connected but reports no devices yet.",
    };
  }
  return {
    handled: true,
    intent: "DEVICE_STATUS",
    text: scored
      .slice(0, 4)
      .map((x) => describe(x.d))
      .join(". "),
  };
}

export async function runDeviceControlSkill(input: string): Promise<SkillResult> {
  const list = await listDevicesFn();
  if (!list.ok) {
    return { handled: true, intent: "DEVICE_CONTROL", text: NOT_CONNECTED };
  }

  const t = norm(input);

  // Scene / mode requests first.
  if (isSceneControl(input)) {
    const scene = list.scenes.find((s) => t.includes(norm(s.name)));
    if (!scene) {
      return {
        handled: true,
        intent: "SCENE_CONTROL",
        text: list.scenes.length
          ? `I couldn't find that scene. You have: ${list.scenes.slice(0, 6).map((s) => s.name).join(", ")}.`
          : "Your bridge doesn't expose any scenes yet.",
      };
    }
    const result = await runDeviceActionFn({ data: { id: scene.id, action: "activate_scene" } });
    return {
      handled: true,
      intent: "SCENE_CONTROL",
      text: result.ok ? `${scene.name} activated.` : result.error,
      ...(result.ok ? { deviceActive: true } : {}),
    };
  }

  const parsed = parseAction(input);
  if (!parsed) {
    return { handled: true, intent: "DEVICE_CONTROL", text: "What would you like me to do with it?" };
  }

  // "Turn everything off"
  if (/(everything|all the lights|all lights)/.test(t)) {
    const targets = list.devices.filter(
      (d) => d.state.on && ["light", "switch", "fan", "speaker"].includes(d.type),
    );
    if (!targets.length) {
      return { handled: true, intent: "DEVICE_CONTROL", text: "Everything is already off." };
    }
    const results = await Promise.all(
      targets.map((d) => runDeviceActionFn({ data: { id: d.id, action: "turn_off" } })),
    );
    const done = results.filter((r) => r.ok).length;
    return {
      handled: true,
      intent: "DEVICE_CONTROL",
      text:
        done === targets.length
          ? `Done. Turned off ${done} ${done === 1 ? "device" : "devices"}.`
          : `I turned off ${done} of ${targets.length} devices. The rest didn't confirm.`,
      deviceActive: done > 0,
    };
  }

  const scored = list.devices
    .map((d) => ({ d, score: scoreDevice(d, input) }))
    .filter((x) => x.score >= 4)
    .sort((a, b) => b.score - a.score);

  if (!scored.length) {
    return {
      handled: true,
      intent: "DEVICE_CONTROL",
      text: "I couldn't match that to a device in your home. Check the Devices page for exact names.",
    };
  }

  const targets = scored.filter((x) => x.score >= scored[0]!.score - 1).slice(0, 4);
  const results = await Promise.all(
    targets.map((x) =>
      runDeviceActionFn({
        data: {
          id: x.d.id,
          action: parsed.action,
          ...(parsed.value !== undefined ? { value: parsed.value } : {}),
        },
      }),
    ),
  );

  const confirmed = results.filter((r) => r.ok);
  if (!confirmed.length) {
    const first = results[0];
    return {
      handled: true,
      intent: "DEVICE_CONTROL",
      text: first && !first.ok ? first.error : "The device didn't confirm the change.",
    };
  }

  return {
    handled: true,
    intent: "DEVICE_CONTROL",
    text: `Done. ${confirmed.map((r) => (r.ok ? describe(r.device) : "")).join(". ")}.`,
    deviceActive: true,
  };
}
