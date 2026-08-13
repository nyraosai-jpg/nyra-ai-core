import { createFileRoute } from "@tanstack/react-router";

/** GET /api/devices — same-origin device list. Never exposes bridge credentials. */
export const Route = createFileRoute("/api/devices")({
  server: {
    handlers: {
      GET: async () => {
        if (!process.env["HOME_ASSISTANT_URL"] || !process.env["HOME_ASSISTANT_TOKEN"]) {
          return Response.json(
            { ok: false, reason: "not_configured", devices: [], scenes: [] },
            { status: 200 },
          );
        }
        try {
          const { listDevices } = await import("@/lib/nyra/devices.server");
          const { devices, scenes } = await listDevices();
          return Response.json({ ok: true, devices, scenes });
        } catch (e) {
          console.error("GET /api/devices failed", e);
          return Response.json({ ok: false, reason: "failed" }, { status: 502 });
        }
      },
    },
  },
});
