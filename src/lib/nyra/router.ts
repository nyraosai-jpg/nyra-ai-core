// Intent router + skill registry.
// Skills are deterministic local capabilities. Anything not handled here
// falls through to the AI brain (the CHAT skill).

import {
  isDeviceControl,
  isDeviceStatus,
  isSceneControl,
  runDeviceControlSkill,
  runDeviceStatusSkill,
} from "./skills/devices";
import { memoryStore, taskStore } from "./storage";
import type { Intent, MemoryType, SkillResult } from "./types";

export interface Skill {
  name: string;
  description: string;
  canHandle: (input: string) => boolean;
  execute: (input: string) => SkillResult;
}

const norm = (s: string) => s.toLowerCase().trim();

function classifyMemoryType(text: string): MemoryType {
  const t = norm(text);
  if (/(prefer|like|love|hate|favourite|favorite)/.test(t)) return "preferences";
  if (/(every day|each morning|routine|usually|always at)/.test(t)) return "routines";
  if (/(goal|want to|aim|dream|plan to)/.test(t)) return "goals";
  if (/(my (wife|husband|friend|mum|mom|dad|brother|sister|partner|boss))/.test(t)) return "people";
  if (/(project|company|business|building|app)/.test(t)) return "projects";
  if (/(my name is|i am|i live|i work)/.test(t)) return "personal";
  return "facts";
}

const memorySave: Skill = {
  name: "Memory — save",
  description: "Stores something the user explicitly asks Nyra to remember.",
  canHandle: (input) =>
    /^(remember|please remember|don'?t forget|note that|keep in mind)\b/.test(norm(input)),
  execute: (input) => {
    const content = input
      .replace(/^\s*(please\s+)?(remember|don'?t forget|note)\s*(that|this)?[:,]?\s*/i, "")
      .trim();
    if (!content) {
      return { handled: true, intent: "MEMORY_SAVE", text: "What would you like me to remember?" };
    }
    memoryStore.add({ type: classifyMemoryType(content), content, importance: 2 });
    return { handled: true, intent: "MEMORY_SAVE", text: `Saved. I'll remember that ${content}` };
  },
};

const memoryRecall: Skill = {
  name: "Memory — recall",
  description: "Reads back what Nyra remembers about the user.",
  canHandle: (input) =>
    /(what do you remember|what you remember|remember about me|my memories)/.test(norm(input)),
  execute: () => {
    const all = memoryStore.all();
    if (!all.length) {
      return {
        handled: true,
        intent: "MEMORY_RECALL",
        text: "Nothing yet. Say “remember that…” and I'll keep it for you.",
      };
    }
    const list = all
      .slice(0, 8)
      .map((m) => `• ${m.content}`)
      .join("\n");
    return {
      handled: true,
      intent: "MEMORY_RECALL",
      text: `Here's what I hold for you:\n${list}`,
    };
  },
};

const taskCreate: Skill = {
  name: "Tasks — create",
  description: "Adds a task to Nyra's internal task list.",
  canHandle: (input) =>
    /^(add|create)\b.*\b(task|to my (task )?list|todo)\b/.test(norm(input)) ||
    /^(remind me to|task:)/.test(norm(input)),
  execute: (input) => {
    const title = input
      .replace(/^\s*(add|create)\s+/i, "")
      .replace(/^\s*remind me to\s+/i, "")
      .replace(/^\s*task:\s*/i, "")
      .replace(/\s+(to|on)\s+my\s+(task\s*)?(list|tasks|todo)\s*\.?$/i, "")
      .replace(/\s+as a task\s*\.?$/i, "")
      .replace(/^a\s+task\s+(to\s+)?/i, "")
      .trim();
    if (!title) {
      return { handled: true, intent: "TASK_CREATE", text: "What should the task be called?" };
    }
    const priority = /(urgent|asap|important|high priority)/i.test(input) ? "high" : "normal";
    taskStore.add({ title, priority });
    return { handled: true, intent: "TASK_CREATE", text: `Added “${title}” to your tasks.` };
  },
};

const taskList: Skill = {
  name: "Tasks — list",
  description: "Reads the open tasks back to the user.",
  canHandle: (input) =>
    /(what'?s on my task|my tasks|task list|what do i have to do|todo list)/.test(norm(input)),
  execute: () => {
    const open = taskStore.all().filter((t) => t.status === "open");
    if (!open.length) {
      return { handled: true, intent: "TASK_LIST", text: "Your task list is clear." };
    }
    return {
      handled: true,
      intent: "TASK_LIST",
      text: `You have ${open.length} open ${open.length === 1 ? "task" : "tasks"}:\n${open
        .slice(0, 8)
        .map((t) => `• ${t.title}`)
        .join("\n")}`,
    };
  },
};

const planDay: Skill = {
  name: "Daily plan",
  description: "Summarises today from Nyra's internal task list.",
  canHandle: (input) => /(plan my day|what'?s my day|daily plan|today'?s plan)/.test(norm(input)),
  execute: () => {
    const tasks = taskStore.all();
    const open = tasks.filter((t) => t.status === "open");
    const high = open.filter((t) => t.priority === "high");
    const done = tasks.filter((t) => t.status === "done").length;
    return {
      handled: true,
      intent: "PLAN_DAY",
      text: open.length
        ? `Today: ${open.length} open, ${done} completed. ${
            high.length ? `Start with “${high[0]!.title}”.` : `Start with “${open[0]!.title}”.`
          } This is my internal task list — no calendar is connected yet.`
        : "Nothing scheduled in my task list. Tell me what matters today and I'll capture it.",
    };
  },
};

export const skills: Skill[] = [memorySave, memoryRecall, taskCreate, taskList, planDay];

/** Registry metadata — also rendered on the Skills page. */
export const skillRegistry = [
  ...skills.map((s) => ({ name: s.name, description: s.description, kind: "local" as const })),
  {
    name: "Devices — control",
    description: "Turns devices on/off, dims lights, sets temperature through the device service.",
    kind: "device" as const,
  },
  {
    name: "Devices — status",
    description: "Reports the real state of connected devices.",
    kind: "device" as const,
  },
  {
    name: "Scenes",
    description: "Activates scenes discovered from the connected bridge.",
    kind: "device" as const,
  },
  {
    name: "Chat",
    description: "Everything else is answered by Nyra's brain, grounded in memory.",
    kind: "ai" as const,
  },
];

/** Async router: local skills first, then device skills, then the AI brain. */
export async function routeIntent(input: string): Promise<SkillResult> {
  for (const skill of skills) {
    if (skill.canHandle(input)) {
      const result = skill.execute(input);
      return { ...result, memoryTouched: result.intent.startsWith("MEMORY") };
    }
  }
  if (isDeviceControl(input) || isSceneControl(input)) return runDeviceControlSkill(input);
  if (isDeviceStatus(input)) return runDeviceStatusSkill(input);
  return { handled: false, intent: "CHAT" as Intent, text: "" };
}

/** Compact memory context handed to the brain for grounding. */
export function buildMemoryContext(): string {
  const all = memoryStore.all().slice(0, 12);
  if (!all.length) return "";
  return all.map((m) => `- (${m.type}) ${m.content}`).join("\n");
}
