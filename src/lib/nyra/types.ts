// Core domain types for Nyra OS. Kept provider-agnostic on purpose.

export type VoiceState = "idle" | "listening" | "processing" | "speaking" | "error";

/** What the orb is expressing. A superset of VoiceState. */
export type OrbState =
  | "idle"
  | "listening"
  | "thinking"
  | "speaking"
  | "connecting"
  | "device_active"
  | "memory"
  | "error";

/* ---------------- devices ---------------- */

export type DeviceType =
  | "light"
  | "thermostat"
  | "fan"
  | "tv"
  | "speaker"
  | "lock"
  | "sensor"
  | "camera"
  | "switch";

export interface DeviceState {
  value: string;
  on?: boolean;
  brightness?: number;
  temperature?: number;
  volume?: number;
  unit?: string;
}

export interface Device {
  id: string;
  name: string;
  type: DeviceType;
  room: string;
  manufacturer: string;
  capabilities: string[];
  state: DeviceState;
  connected: boolean;
}

export type DeviceAction =
  | "turn_on"
  | "turn_off"
  | "toggle"
  | "set_brightness"
  | "set_temperature"
  | "set_volume"
  | "lock"
  | "unlock"
  | "activate_scene";

export interface Scene {
  id: string;
  name: string;
  source: "home_assistant" | "nyra";
}

/* ---------------- integrations ---------------- */

export type IntegrationState = "connected" | "not_configured" | "error" | "planned";

export interface IntegrationStatus {
  id: string;
  name: string;
  category: "ai" | "voice" | "memory" | "devices" | "vision" | "productivity" | "media" | "context";
  status: IntegrationState;
  detail?: string;
  envKeys: string[];
}

/* ---------------- activity ---------------- */

export type ActivityKind =
  | "listening"
  | "understanding"
  | "thinking"
  | "speaking"
  | "memory"
  | "task"
  | "device"
  | "system"
  | "error";

export interface ActivityEvent {
  id: string;
  kind: ActivityKind;
  message: string;
  detail?: string;
  at: number;
}


export type Role = "user" | "nyra" | "system";

export interface Message {
  id: string;
  role: Role;
  content: string;
  createdAt: number;
  demo?: boolean;
}

export type MemoryType =
  | "personal"
  | "preferences"
  | "routines"
  | "goals"
  | "people"
  | "projects"
  | "notes"
  | "facts";

export interface Memory {
  id: string;
  type: MemoryType;
  content: string;
  importance: 1 | 2 | 3;
  createdAt: number;
  updatedAt: number;
}

export type TaskStatus = "open" | "done";
export type TaskPriority = "low" | "normal" | "high";

export interface Task {
  id: string;
  title: string;
  description?: string;
  status: TaskStatus;
  priority: TaskPriority;
  createdAt: number;
  dueAt?: number;
  completedAt?: number;
}

export interface NyraSettings {
  memoryEnabled: boolean;
  voiceOutputEnabled: boolean;
  voiceIsolation: boolean;
  language: string;
  voiceId: string;
}

export type Intent =
  | "CHAT"
  | "MEMORY_SAVE"
  | "MEMORY_RECALL"
  | "TASK_CREATE"
  | "TASK_LIST"
  | "TASK_COMPLETE"
  | "PLAN_DAY"
  | "HELP"
  | "UNKNOWN";

export interface SkillResult {
  /** Text Nyra should say/show. Empty means: defer to the AI brain. */
  text: string;
  handled: boolean;
  intent: Intent;
}
