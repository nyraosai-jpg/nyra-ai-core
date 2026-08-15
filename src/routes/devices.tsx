import { createFileRoute } from "@tanstack/react-router";
import { NyraShell } from "@/components/nyra/NyraShell";
import { listDevicesFn } from "@/lib/nyra/devices.functions";
import type { Device } from "@/lib/nyra/types";

export const Route = createFileRoute("/devices")({
  head: () => ({
    meta: [
      { title: "Devices — Nyra" },
      { name: "description", content: "Connect your home to Nyra and see real device state by room." },
      { property: "og:title", content: "Devices — Nyra" },
      { property: "og:description", content: "Nyra connects to compatible devices through Home Assistant." },
    ],
  }),
  loader: () => listDevicesFn(),
  component: DevicesPage,
});

function DevicesPage() {
  const result = Route.useLoaderData();

  if (!result.ok) {
    return (
      <NyraShell>
        <div className="space-y-5 py-6">
          <h1 className="text-2xl font-light tracking-tight">Devices</h1>
          <section className="rounded-2xl border border-border/60 bg-nyra-panel p-6">
            <h2 className="text-lg">Connect your things</h2>
            <p className="mt-2 text-sm text-muted-foreground">
              No tokens needed. Anything with an account — Spotify today, Hue, Tuya, LIFX and
              Google Home next — connects by signing in once, and Nyra controls it by voice.
            </p>
            <p className="mt-4 text-sm text-muted-foreground">
              Lights and plugs that only live on your local network can't be reached from a browser
              tab. When you host Nyra on your laptop, a small local bridge unlocks those — it plugs
              into this same device layer, no configuration in the app.
            </p>
            <p className="mt-4 text-xs uppercase tracking-[0.2em] text-muted-foreground">
              Status: {result.reason === "not_configured" ? "No bridge connected" : "Bridge unreachable"}
            </p>
          </section>
          <p className="text-xs text-muted-foreground">
            The device layer is bridge-agnostic, so account-based and local devices appear side by
            side once connected.
          </p>
        </div>
      </NyraShell>
    );
  }

  const rooms = new Map<string, Device[]>();
  for (const d of result.devices) {
    rooms.set(d.room, [...(rooms.get(d.room) ?? []), d]);
  }

  return (
    <NyraShell>
      <div className="space-y-5 py-6">
        <header>
          <h1 className="text-2xl font-light tracking-tight">Devices</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {result.devices.length} devices · {rooms.size} rooms · {result.scenes.length} scenes
          </p>
        </header>

        {[...rooms.entries()].map(([room, devices]) => (
          <section key={room} className="rounded-2xl border border-border/60 bg-nyra-panel p-5">
            <h2 className="text-xs uppercase tracking-[0.3em] text-muted-foreground">{room}</h2>
            <ul className="mt-3 space-y-2">
              {devices.map((d) => (
                <li key={d.id} className="flex items-center justify-between gap-4 py-1.5 text-sm">
                  <span className="flex items-center gap-2">
                    <span
                      className={
                        d.connected
                          ? "h-1.5 w-1.5 rounded-full bg-primary"
                          : "h-1.5 w-1.5 rounded-full bg-muted-foreground/60"
                      }
                      aria-hidden="true"
                    />
                    <span>{d.name}</span>
                    <span className="text-xs text-muted-foreground">{d.type}</span>
                  </span>
                  <span className="text-right text-muted-foreground">
                    {d.connected ? d.state.value : "offline"}
                    {d.state.brightness !== undefined ? ` · ${d.state.brightness}%` : ""}
                    {d.state.temperature !== undefined
                      ? ` · ${d.state.temperature}${d.state.unit ?? "°"}`
                      : ""}
                  </span>
                </li>
              ))}
            </ul>
          </section>
        ))}

        {result.scenes.length > 0 ? (
          <section className="rounded-2xl border border-border/60 bg-nyra-panel p-5">
            <h2 className="text-xs uppercase tracking-[0.3em] text-muted-foreground">Scenes</h2>
            <ul className="mt-3 flex flex-wrap gap-2">
              {result.scenes.map((s) => (
                <li
                  key={s.id}
                  className="rounded-full border border-border/60 px-3 py-1.5 text-xs text-muted-foreground"
                >
                  {s.name}
                </li>
              ))}
            </ul>
          </section>
        ) : null}
      </div>
    </NyraShell>
  );
}
