// Live activity log. Records only REAL system events emitted by Nyra's runtime.

import type { ActivityEvent, ActivityKind } from "./types";
import { uid } from "./storage";

const KEY = "nyra.activity.v1";
const LIMIT = 120;

type Listener = (events: ActivityEvent[]) => void;
const listeners = new Set<Listener>();

function read(): ActivityEvent[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(KEY);
    return raw ? (JSON.parse(raw) as ActivityEvent[]) : [];
  } catch {
    return [];
  }
}

function write(events: ActivityEvent[]) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(KEY, JSON.stringify(events.slice(0, LIMIT)));
  } catch {
    /* non-fatal */
  }
}

export const activityLog = {
  all: () => read(),
  subscribe(listener: Listener) {
    listeners.add(listener);
    return () => listeners.delete(listener);
  },
  push(kind: ActivityKind, message: string, detail?: string): ActivityEvent {
    const event: ActivityEvent = {
      id: uid(),
      kind,
      message,
      ...(detail ? { detail } : {}),
      at: Date.now(),
    };
    const next = [event, ...read()].slice(0, LIMIT);
    write(next);
    listeners.forEach((l) => l(next));
    return event;
  },
  clear() {
    write([]);
    listeners.forEach((l) => l([]));
  },
};
