import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

const SpeakInput = z.object({
  text: z.string().min(1).max(2000),
  voiceId: z.string().min(4).max(64).optional(),
});

export type SpeakResult =
  | { ok: true; audioBase64: string; mimeType: string }
  | { ok: false; error: string; reason: "not_configured" | "failed" };

/**
 * Server-side ElevenLabs bridge. The API key never reaches the browser;
 * the client receives base64 audio it can play directly.
 */
export const nyraSpeak = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) => SpeakInput.parse(data))
  .handler(async ({ data }): Promise<SpeakResult> => {
    const apiKey = process.env["ELEVENLABS_API_KEY"];
    if (!apiKey) {
      return {
        ok: false,
        reason: "not_configured",
        error: "Voice output isn't configured yet. You can still use Nyra in text mode.",
      };
    }

    const voiceId = data.voiceId || "EXAVITQu4vr4xnSDxMaL"; // Sarah — calm, warm

    try {
      const res = await fetch(
        `https://api.elevenlabs.io/v1/text-to-speech/${voiceId}?output_format=mp3_44100_128`,
        {
          method: "POST",
          headers: { "xi-api-key": apiKey, "Content-Type": "application/json" },
          body: JSON.stringify({
            text: data.text,
            model_id: "eleven_multilingual_v2",
            voice_settings: {
              stability: 0.5,
              similarity_boost: 0.75,
              style: 0.35,
              use_speaker_boost: true,
            },
          }),
        },
      );

      if (!res.ok) {
        const detail = await res.text().catch(() => "");
        console.error(`ElevenLabs request failed [${res.status}]`, detail.slice(0, 300));
        return { ok: false, reason: "failed", error: "Nyra's voice service is unavailable right now." };
      }

      const buffer = await res.arrayBuffer();
      return {
        ok: true,
        mimeType: "audio/mpeg",
        audioBase64: Buffer.from(buffer).toString("base64"),
      };
    } catch {
      return { ok: false, reason: "failed", error: "Nyra couldn't reach the voice service." };
    }
  });
