// Server-only helper for Lovable connector gateway calls.
// Credentials never leave the server; the browser never sees a token.

const GATEWAY = "https://connector-gateway.lovable.dev";

export type GatewayResult<T> = { ok: true; data: T } | { ok: false; status: number; error: string };

export function connectorKey(connectorId: string): string | undefined {
  const map: Record<string, string> = {
    google_calendar: "GOOGLE_CALENDAR_API_KEY",
    spotify: "SPOTIFY_API_KEY",
    x: "X_API_KEY",
    linkedin: "LINKEDIN_API_KEY",
    telegram: "TELEGRAM_API_KEY",
  };
  const envName = map[connectorId];
  return envName ? process.env[envName] : undefined;
}

export function isConnected(connectorId: string): boolean {
  return Boolean(process.env["LOVABLE_API_KEY"] && connectorKey(connectorId));
}

export async function gatewayFetch<T>(
  connectorId: string,
  path: string,
  init: { method?: string; query?: Record<string, string>; body?: unknown } = {},
): Promise<GatewayResult<T>> {
  const lovableKey = process.env["LOVABLE_API_KEY"];
  const connKey = connectorKey(connectorId);
  if (!lovableKey || !connKey) {
    return { ok: false, status: 0, error: "not_connected" };
  }

  const url = new URL(`${GATEWAY}/${connectorId}${path}`);
  for (const [k, v] of Object.entries(init.query ?? {})) url.searchParams.set(k, v);

  let res: Response;
  try {
    res = await fetch(url, {
      method: init.method ?? "GET",
      headers: {
        Authorization: `Bearer ${lovableKey}`,
        "X-Connection-Api-Key": connKey,
        "Content-Type": "application/json",
      },
      ...(init.body === undefined ? {} : { body: JSON.stringify(init.body) }),
    });
  } catch (e) {
    console.error(`gateway ${connectorId} network error`, e);
    return { ok: false, status: 0, error: "network_error" };
  }

  const text = await res.text();
  if (!res.ok) {
    console.error(`gateway ${connectorId} ${path} failed [${res.status}]`, text.slice(0, 500));
    return { ok: false, status: res.status, error: text.slice(0, 400) };
  }
  try {
    return { ok: true, data: (text ? JSON.parse(text) : {}) as T };
  } catch {
    return { ok: false, status: res.status, error: "invalid_json" };
  }
}
