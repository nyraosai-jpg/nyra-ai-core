import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { MAX_CONTEXT_MESSAGES, MAX_MESSAGE_CHARS, NYRA_SYSTEM_PROMPT } from "./prompt";

const ReplyInput = z.object({
  messages: z
    .array(
      z.object({
        // Client-provided system prompts are never trusted.
        role: z.enum(["user", "assistant"]),
        content: z.string().min(1).max(MAX_MESSAGE_CHARS),
      }),
    )
    .min(1)
    .max(40),
  memoryContext: z.string().max(4000).optional(),
});

export type NyraReply = {
  text: string;
  demo: boolean;
  error?: string;
};

/** Runtime configuration status. Safe to expose: contains no secrets. */
export const getNyraStatus = createServerFn({ method: "GET" }).handler(async () => {
  return {
    aiConfigured: Boolean(process.env["GROQ_API_KEY"]),
    aiProvider: "Groq",
    aiModel: process.env["GROQ_MODEL"] || "llama-3.3-70b-versatile",
    ttsConfigured: Boolean(process.env["ELEVENLABS_API_KEY"]),
    ttsProvider: "ElevenLabs",
  };
});

export const nyraReply = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) => ReplyInput.parse(data))
  .handler(async ({ data }): Promise<NyraReply> => {
    const apiKey = process.env["GROQ_API_KEY"];
    const model = process.env["GROQ_MODEL"] || "llama-3.3-70b-versatile";

    const recent = data.messages.slice(-MAX_CONTEXT_MESSAGES);

    if (!apiKey) {
      const last = recent[recent.length - 1]?.content ?? "";
      return {
        demo: true,
        text: `Demo mode — my reasoning engine isn't configured yet, so this is a simulated reply. You said: "${last.slice(0, 160)}". Add a Groq API key in Settings to bring me fully online.`,
      };
    }

    const system = data.memoryContext
      ? `${NYRA_SYSTEM_PROMPT}\n\nWhat you remember about the user:\n${data.memoryContext}`
      : NYRA_SYSTEM_PROMPT;

    try {
      const res = await fetch("https://api.groq.com/openai/v1/chat/completions", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model,
          temperature: 0.7,
          max_tokens: 700,
          messages: [{ role: "system", content: system }, ...recent],
        }),
      });

      if (!res.ok) {
        const detail = await res.text().catch(() => "");
        console.error(`Groq request failed [${res.status}]`, detail.slice(0, 500));
        return {
          demo: false,
          text: "",
          error:
            res.status === 401
              ? "Nyra's brain rejected the configured key. Check the AI configuration."
              : "Nyra's brain is temporarily unavailable. Please try again in a moment.",
        };
      }

      const json = (await res.json()) as {
        choices?: Array<{ message?: { content?: string } }>;
      };
      const text = json.choices?.[0]?.message?.content?.trim();
      if (!text) {
        return { demo: false, text: "", error: "Nyra received an empty response. Try again." };
      }
      return { demo: false, text };
    } catch {
      return {
        demo: false,
        text: "",
        error: "Nyra couldn't reach the service. Please check your connection and try again.",
      };
    }
  });
