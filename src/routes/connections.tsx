import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useCallback, useEffect, useState } from "react";
import { CalendarDays, Check, MapPin, Mail, ShieldCheck, X } from "lucide-react";
import { NyraShell } from "@/components/nyra/NyraShell";
import { useSession } from "@/hooks/useSession";
import {
  GOOGLE_CONSENT,
  type GoogleConnectorId,
} from "@/lib/nyra/google.shared";
import {
  getGoogleConnections,
  revokeGoogleConnect,
  startGoogleConnect,
  completeGoogleConnect,
} from "@/lib/nyra/google.functions";
import { locationStore, requestLocation } from "@/lib/nyra/location";

export const Route = createFileRoute("/connections")({
  head: () => ({
    meta: [
      { title: "Connections — Nyra Calendar, Gmail and location access" },
      {
        name: "description",
        content:
          "Review exactly what Nyra can see before you connect Google Calendar, Gmail or share your location. Revoke access any time.",
      },
      { property: "og:title", content: "Nyra Connections" },
      {
        property: "og:description",
        content: "Consent-first Google Calendar, Gmail and location access for Nyra.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: ConnectionsPage,
});

const CONNECTORS: GoogleConnectorId[] = ["google_calendar", "google_mail"];
const ICONS = { google_calendar: CalendarDays, google_mail: Mail } as const;

function waitForOAuthCompletion(popup: Window, connectorId: string) {
  return new Promise<string | null>((resolve, reject) => {
    let poll: number | undefined;
    const cleanup = () => {
      window.removeEventListener("message", onMessage);
      if (poll !== undefined) window.clearInterval(poll);
    };
    const onMessage = (event: MessageEvent) => {
      const type = event.data?.type;
      if (
        event.origin !== window.location.origin ||
        event.source !== popup ||
        (event.data?.connectorId && event.data.connectorId !== connectorId) ||
        (type !== "appUserConnectorOAuthComplete" && type !== "appUserConnectorOAuthFailed")
      )
        return;
      cleanup();
      if (type === "appUserConnectorOAuthComplete") {
        resolve(typeof event.data?.code === "string" ? event.data.code : null);
        return;
      }
      popup.close();
      reject(new Error("Google did not grant access."));
    };
    window.addEventListener("message", onMessage);
    poll = window.setInterval(() => {
      if (!popup.closed) return;
      cleanup();
      reject(new Error("The Google window closed before finishing."));
    }, 500);
  });
}

function ConnectionsPage() {
  const navigate = useNavigate();
  const { session, loading } = useSession();
  const [connected, setConnected] = useState<Record<string, boolean>>({});
  const [pending, setPending] = useState<GoogleConnectorId | null>(null);
  const [reviewing, setReviewing] = useState<GoogleConnectorId | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [locationOn, setLocationOn] = useState(false);

  useEffect(() => {
    if (!loading && !session) {
      void navigate({
        to: "/auth",
        search: { next: "/connections" } as never,
        replace: true,
      });
    }
  }, [loading, session, navigate]);

  useEffect(() => setLocationOn(Boolean(locationStore.get())), []);

  const refresh = useCallback(async () => {
    if (!session) return;
    try {
      const rows = await getGoogleConnections();
      setConnected(Object.fromEntries(rows.map((r) => [r.connectorId, true])));
    } catch (err) {
      console.error(err);
    }
  }, [session]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const connect = async (connectorId: GoogleConnectorId) => {
    setReviewing(null);
    setError(null);
    setPending(connectorId);
    const popup = window.open("", "nyra-google-oauth", "width=600,height=720");
    if (!popup) {
      setPending(null);
      setError("Allow pop-ups for Nyra, then try connecting again.");
      return;
    }
    try {
      const { authorizationUrl } = await startGoogleConnect({ data: { connectorId } });
      const completion = waitForOAuthCompletion(popup, connectorId);
      popup.location.href = authorizationUrl;
      const code = await completion;
      if (code) await completeGoogleConnect({ data: { code } });
      await refresh();
    } catch (err) {
      popup.close();
      setError(err instanceof Error ? err.message : "Could not connect to Google.");
    } finally {
      setPending(null);
    }
  };

  const revoke = async (connectorId: GoogleConnectorId) => {
    setPending(connectorId);
    setError(null);
    try {
      await revokeGoogleConnect({ data: { connectorId } });
      await refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not disconnect.");
    } finally {
      setPending(null);
    }
  };

  const toggleLocation = async () => {
    if (locationOn) {
      locationStore.clear();
      setLocationOn(false);
      return;
    }
    const ok = Boolean(await requestLocation());
    setLocationOn(ok);
    if (!ok) setError("Your browser declined the location request.");
  };

  if (loading || !session) {
    return (
      <NyraShell>
        <p className="pt-16 text-center text-sm text-muted-foreground">Checking your session…</p>
      </NyraShell>
    );
  }

  return (
    <NyraShell>
      <div className="mx-auto max-w-2xl space-y-8 pt-6">
        <header className="space-y-2">
          <h1 className="text-2xl font-light tracking-tight">Connections</h1>
          <p className="text-sm text-muted-foreground">
            Nyra asks before she looks. Every connection below shows exactly what she can see, and
            you can withdraw it at any moment.
          </p>
          <p className="text-xs text-muted-foreground">Signed in as {session.user.email}</p>
        </header>

        {error ? (
          <p className="rounded-xl border border-destructive/50 bg-destructive/10 p-3 text-sm" role="alert">
            {error}
          </p>
        ) : null}

        <ul className="space-y-4">
          {CONNECTORS.map((id) => {
            const info = GOOGLE_CONSENT[id];
            const Icon = ICONS[id];
            const isConnected = Boolean(connected[id]);
            const open = reviewing === id;
            return (
              <li
                key={id}
                className="rounded-2xl border border-border/60 bg-nyra-panel p-5 backdrop-blur"
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="flex items-start gap-3">
                    <Icon className="mt-1 h-5 w-5 text-primary" aria-hidden="true" />
                    <div>
                      <h2 className="text-base font-medium">{info.name}</h2>
                      <p className="text-sm text-muted-foreground">{info.summary}</p>
                    </div>
                  </div>
                  <span
                    className={`shrink-0 rounded-full px-3 py-1 text-[10px] uppercase tracking-[0.2em] ${
                      isConnected
                        ? "border border-primary/50 text-primary"
                        : "border border-border/60 text-muted-foreground"
                    }`}
                  >
                    {isConnected ? "Connected" : "Not connected"}
                  </span>
                </div>

                {open ? (
                  <div className="mt-4 space-y-3 rounded-xl border border-primary/30 bg-background/40 p-4">
                    <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">
                      What you are granting
                    </p>
                    <ul className="space-y-1 text-sm">
                      {info.grants.map((g) => (
                        <li key={g} className="flex gap-2">
                          <Check className="mt-0.5 h-4 w-4 shrink-0 text-primary" aria-hidden="true" />
                          <span>{g}</span>
                        </li>
                      ))}
                    </ul>
                    <ul className="space-y-1 text-sm text-muted-foreground">
                      {info.limits.map((l) => (
                        <li key={l} className="flex gap-2">
                          <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
                          <span>{l}</span>
                        </li>
                      ))}
                    </ul>
                    <div className="flex gap-2 pt-1">
                      <button
                        type="button"
                        onClick={() => void connect(id)}
                        disabled={pending === id}
                        className="min-h-11 flex-1 rounded-xl border border-primary/60 bg-primary/15 text-sm transition-colors hover:bg-primary/25 disabled:opacity-50"
                      >
                        {pending === id ? "Opening Google…" : "Approve and continue"}
                      </button>
                      <button
                        type="button"
                        onClick={() => setReviewing(null)}
                        className="min-h-11 rounded-xl border border-border/60 px-4 text-sm text-muted-foreground hover:text-foreground"
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="mt-4 flex gap-2">
                    {isConnected ? (
                      <button
                        type="button"
                        onClick={() => void revoke(id)}
                        disabled={pending === id}
                        className="min-h-11 rounded-xl border border-border/60 px-4 text-sm text-muted-foreground transition-colors hover:text-foreground disabled:opacity-50"
                      >
                        <X className="mr-1 inline h-4 w-4" aria-hidden="true" />
                        Disconnect
                      </button>
                    ) : null}
                    <button
                      type="button"
                      onClick={() => setReviewing(id)}
                      className="min-h-11 rounded-xl border border-primary/60 bg-primary/10 px-4 text-sm transition-colors hover:bg-primary/20"
                    >
                      {isConnected ? "Review access" : "Connect"}
                    </button>
                  </div>
                )}
              </li>
            );
          })}

          <li className="rounded-2xl border border-border/60 bg-nyra-panel p-5 backdrop-blur">
            <div className="flex items-start justify-between gap-4">
              <div className="flex items-start gap-3">
                <MapPin className="mt-1 h-5 w-5 text-primary" aria-hidden="true" />
                <div>
                  <h2 className="text-base font-medium">Location</h2>
                  <p className="text-sm text-muted-foreground">
                    Lets Nyra answer local questions like weather and travel time. Stored only on
                    this device and never sent to Google.
                  </p>
                </div>
              </div>
              <span
                className={`shrink-0 rounded-full px-3 py-1 text-[10px] uppercase tracking-[0.2em] ${
                  locationOn
                    ? "border border-primary/50 text-primary"
                    : "border border-border/60 text-muted-foreground"
                }`}
              >
                {locationOn ? "Shared" : "Off"}
              </span>
            </div>
            <button
              type="button"
              onClick={() => void toggleLocation()}
              className="mt-4 min-h-11 rounded-xl border border-primary/60 bg-primary/10 px-4 text-sm transition-colors hover:bg-primary/20"
            >
              {locationOn ? "Stop sharing location" : "Share my location"}
            </button>
          </li>
        </ul>

        <p className="text-xs text-muted-foreground">
          Prefer to review everything else?{" "}
          <Link to="/settings" className="text-primary underline-offset-4 hover:underline">
            Open settings
          </Link>
          .
        </p>
      </div>
    </NyraShell>
  );
}
