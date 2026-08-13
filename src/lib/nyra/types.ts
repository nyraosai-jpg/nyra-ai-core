// Core domain types for Nyra OS. Kept provider-agnostic on purpose.

export type VoiceState = "idle" | "listening" | "processing" | "speaking" | "error";

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
