// Browser-safe constants for Nyra's Google connections. No secrets here.

export const GATEWAY_BASE_URL = "https://connector-gateway.lovable.dev";

export type GoogleConnectorId = "google_calendar" | "google_mail";

export const GOOGLE_SCOPES: Record<GoogleConnectorId, string[]> = {
  google_calendar: [
    "https://www.googleapis.com/auth/userinfo.email",
    "https://www.googleapis.com/auth/userinfo.profile",
    "https://www.googleapis.com/auth/calendar",
  ],
  google_mail: [
    "https://www.googleapis.com/auth/userinfo.email",
    "https://www.googleapis.com/auth/userinfo.profile",
    "https://www.googleapis.com/auth/gmail.readonly",
  ],
};

/** Plain-language consent rows shown before the Google window opens. */
export const GOOGLE_CONSENT: Record<
  GoogleConnectorId,
  { name: string; summary: string; grants: string[]; limits: string[] }
> = {
  google_calendar: {
    name: "Google Calendar",
    summary: "Lets Nyra read your schedule and, with your approval, change events.",
    grants: [
      "Read your calendars and upcoming events",
      "Create, move or cancel events — only after you approve each change",
      "See your Google name and email so Nyra knows whose calendar this is",
    ],
    limits: [
      "Nyra never changes an event without an explicit yes from you",
      "Your Google credentials stay encrypted on the server, never in the browser",
    ],
  },
  google_mail: {
    name: "Gmail",
    summary: "Lets Nyra read recent mail so she can summarise what needs your attention.",
    grants: [
      "Read your Gmail messages and labels",
      "See your Google name and email address",
    ],
    limits: [
      "Read-only: Nyra cannot send, delete or archive mail",
      "Message contents are used for the answer you asked for and never stored",
    ],
  },
};

export function googleConnectorEnv(connectorId: GoogleConnectorId): string {
  return `${connectorId.toUpperCase()}_APP_USER_CONNECTOR_CLIENT_API_KEY`;
}
