// Local persistence layer (development-grade). Designed so a database can be
// swapped in behind these same repository functions without touching the UI.

import type { Memory, Message, NyraSettings, Task } from "./types";

const KEYS = {
  memories: "nyra.memories.v1",
  tasks: "nyra.tasks.v1",
  messages: "nyra.conversation.v1",
  settings: "nyra.settings.v1",
} as const;

const isBrowser = () => typeof window !== "undefined";

function read<T>(key: string, fallback: T): T {
  if (!isBrowser()) return fallback;
  try {
    const raw = window.localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}

function write<T>(key: string, value: T) {
  if (!isBrowser()) return;
  try {
    window.localStorage.setItem(key, JSON.stringify(value));
  } catch {
    /* storage full or blocked — non-fatal */
  }
}

export const uid = () =>
  isBrowser() && "randomUUID" in crypto ? crypto.randomUUID() : Math.random().toString(36).slice(2);

/* ---------------- memories ---------------- */
export const memoryStore = {
  all: () => read<Memory[]>(KEYS.memories, []),
  save: (list: Memory[]) => write(KEYS.memories, list),
  add(memory: Omit<Memory, "id" | "createdAt" | "updatedAt">): Memory {
    const now = Date.now();
    const created: Memory = { ...memory, id: uid(), createdAt: now, updatedAt: now };
    this.save([created, ...this.all()]);
    return created;
  },
  update(id: string, patch: Partial<Memory>) {
    this.save(
      this.all().map((m) => (m.id === id ? { ...m, ...patch, updatedAt: Date.now() } : m)),
    );
  },
  remove(id: string) {
    this.save(this.all().filter((m) => m.id !== id));
  },
};

/* ---------------- tasks ---------------- */
export const taskStore = {
  all: () => read<Task[]>(KEYS.tasks, []),
  save: (list: Task[]) => write(KEYS.tasks, list),
  add(task: Omit<Task, "id" | "createdAt" | "status"> & { status?: Task["status"] }): Task {
    const created: Task = {
      ...task,
      status: task.status ?? "open",
      id: uid(),
      createdAt: Date.now(),
    };
    this.save([created, ...this.all()]);
    return created;
  },
  update(id: string, patch: Partial<Task>) {
    this.save(this.all().map((t) => (t.id === id ? { ...t, ...patch } : t)));
  },
  toggle(id: string) {
    this.save(
      this.all().map((t) => {
        if (t.id !== id) return t;
        if (t.status === "done") {
          const { completedAt: _done, ...rest } = t;
          return { ...rest, status: "open" as const };
        }
        return { ...t, status: "done" as const, completedAt: Date.now() };
      }),
    );
  },
  remove(id: string) {
    this.save(this.all().filter((t) => t.id !== id));
  },
};

/* ---------------- conversation ---------------- */
export const conversationStore = {
  all: () => read<Message[]>(KEYS.messages, []),
  save: (list: Message[]) => write(KEYS.messages, list.slice(-60)),
  clear: () => write(KEYS.messages, []),
};

/* ---------------- settings ---------------- */
export const DEFAULT_SETTINGS: NyraSettings = {
  memoryEnabled: true,
  voiceOutputEnabled: true,
  voiceIsolation: true,
  language: "en-US",
  voiceId: "EXAVITQu4vr4xnSDxMaL",
};

export const settingsStore = {
  get: (): NyraSettings => ({ ...DEFAULT_SETTINGS, ...read(KEYS.settings, {}) }),
  set: (patch: Partial<NyraSettings>) =>
    write(KEYS.settings, { ...settingsStore.get(), ...patch }),
};
