import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";

const ActionBody = z.object({
  action: z.enum([
    "turn_on",
    "turn_off",
    "toggle",
    "set_brightness",
    "set_temperature",
    "set_volume",
    "lock",
    "unlock",
    "activate_scene",
  ]),
  value: z.number().min(-50).max(1000).optional(),
});

function notConfigured() {
  return Response.json({ ok: false, reason: "not_configured" }, { status: 200 });
}

/** GET /api/devices/:id  ·  POST /api/devices/:id (action payload) */
export const Route = createFileRoute("/api/devices/$id")({
  server: {
    handlers: {
      GET: async ({ params }) => {
        if (!process.env["HOME_ASSISTANT_URL"] || !process.env["HOME_ASSISTANT_TOKEN"]) {
          return notConfigured();
        }
        const { getDevice } = await import("@/lib/nyra/devices.server");
        const device = await getDevice(params.id);
        if (!device) return Response.json({ ok: false, reason: "not_found" }, { status: 404 });
        return Response.json({ ok: true, device });
      },
      POST: async ({ params, request }) => {
        if (!process.env["HOME_ASSISTANT_URL"] || !process.env["HOME_ASSISTANT_TOKEN"]) {
          return notConfigured();
        }
        const parsed = ActionBody.safeParse(await request.json().catch(() => null));
        if (!parsed.success) {
          return Response.json({ ok: false, reason: "invalid_action" }, { status: 400 });
        }
        try {
          const { getDevice, runDeviceAction } = await import("@/lib/nyra/devices.server");
          const existing = await getDevice(params.id);
          if (!existing) return Response.json({ ok: false, reason: "not_found" }, { status: 404 });
          if (
            existing.capabilities.length > 0 &&
            parsed.data.action !== "activate_scene" &&
            !existing.capabilities.includes(parsed.data.action)
          ) {
            return Response.json({ ok: false, reason: "unsupported" }, { status: 422 });
          }
          const device = await runDeviceAction(params.id, parsed.data.action, parsed.data.value);
          return Response.json({ ok: true, device });
        } catch (e) {
          console.error("device action failed", e);
          return Response.json({ ok: false, reason: "failed" }, { status: 502 });
        }
      },
    },
  },
});
