// Google Calendar through the Lovable connector gateway. Server-side only.
// Reads are free; every write is confirmed by the user before it reaches here.

import { gatewayFetch, isConnected } from "./gateway.server";

const BASE = "/calendar/v3";

export const calendarConnected = () => isConnected("google_calendar");

export interface CalendarEvent {
  id: string;
  title: string;
  start: string;
  end: string;
  allDay: boolean;
  location?: string;
  attendees?: number;
  status?: string;
  calendarId: string;
}

interface GEvent {
  id: string;
  summary?: string;
  status?: string;
  location?: string;
  attendees?: unknown[];
  start?: { dateTime?: string; date?: string };
  end?: { dateTime?: string; date?: string };
}

function mapEvent(e: GEvent, calendarId: string): CalendarEvent {
  const allDay = Boolean(e.start?.date && !e.start?.dateTime);
  return {
    id: e.id,
    title: e.summary || "(no title)",
    start: e.start?.dateTime || e.start?.date || "",
    end: e.end?.dateTime || e.end?.date || "",
    allDay,
    ...(e.location ? { location: e.location } : {}),
    ...(e.attendees ? { attendees: e.attendees.length } : {}),
    ...(e.status ? { status: e.status } : {}),
    calendarId,
  };
}

export async function listEvents(args: {
  timeMin: string;
  timeMax: string;
  calendarId?: string;
  maxResults?: number;
}) {
  const calendarId = args.calendarId || "primary";
  const res = await gatewayFetch<{ items?: GEvent[] }>(
    "google_calendar",
    `${BASE}/calendars/${encodeURIComponent(calendarId)}/events`,
    {
      query: {
        timeMin: args.timeMin,
        timeMax: args.timeMax,
        singleEvents: "true",
        orderBy: "startTime",
        maxResults: String(Math.min(args.maxResults ?? 25, 50)),
      },
    },
  );
  if (!res.ok) return { ok: false as const, error: res.error, status: res.status };
  return {
    ok: true as const,
    events: (res.data.items ?? []).map((e) => mapEvent(e, calendarId)),
  };
}

export async function listCalendars() {
  const res = await gatewayFetch<{ items?: Array<{ id: string; summary?: string; primary?: boolean }> }>(
    "google_calendar",
    `${BASE}/users/me/calendarList`,
  );
  if (!res.ok) return { ok: false as const, error: res.error };
  return {
    ok: true as const,
    calendars: (res.data.items ?? []).map((c) => ({
      id: c.id,
      name: c.summary ?? c.id,
      primary: Boolean(c.primary),
    })),
  };
}

export async function createEvent(args: {
  title: string;
  start: string;
  end: string;
  description?: string;
  location?: string;
  calendarId?: string;
  timezone?: string;
}) {
  const calendarId = args.calendarId || "primary";
  const tz = args.timezone || "UTC";
  const res = await gatewayFetch<GEvent>(
    "google_calendar",
    `${BASE}/calendars/${encodeURIComponent(calendarId)}/events`,
    {
      method: "POST",
      body: {
        summary: args.title,
        ...(args.description ? { description: args.description } : {}),
        ...(args.location ? { location: args.location } : {}),
        start: { dateTime: args.start, timeZone: tz },
        end: { dateTime: args.end, timeZone: tz },
      },
    },
  );
  if (!res.ok) return { ok: false as const, error: res.error };
  return { ok: true as const, event: mapEvent(res.data, calendarId) };
}

export async function updateEvent(args: {
  eventId: string;
  title?: string;
  start?: string;
  end?: string;
  location?: string;
  calendarId?: string;
  timezone?: string;
}) {
  const calendarId = args.calendarId || "primary";
  const tz = args.timezone || "UTC";
  const body: Record<string, unknown> = {};
  if (args.title) body["summary"] = args.title;
  if (args.location) body["location"] = args.location;
  if (args.start) body["start"] = { dateTime: args.start, timeZone: tz };
  if (args.end) body["end"] = { dateTime: args.end, timeZone: tz };

  const res = await gatewayFetch<GEvent>(
    "google_calendar",
    `${BASE}/calendars/${encodeURIComponent(calendarId)}/events/${encodeURIComponent(args.eventId)}`,
    { method: "PATCH", body },
  );
  if (!res.ok) return { ok: false as const, error: res.error };
  return { ok: true as const, event: mapEvent(res.data, calendarId) };
}

export async function deleteEvent(args: { eventId: string; calendarId?: string }) {
  const calendarId = args.calendarId || "primary";
  const res = await gatewayFetch<unknown>(
    "google_calendar",
    `${BASE}/calendars/${encodeURIComponent(calendarId)}/events/${encodeURIComponent(args.eventId)}`,
    { method: "DELETE" },
  );
  if (!res.ok) return { ok: false as const, error: res.error };
  return { ok: true as const, deleted: args.eventId };
}
