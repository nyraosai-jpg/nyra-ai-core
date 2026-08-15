// Client-safe validation schema for agent turns.

import { z } from "zod";
import { MAX_MESSAGE_CHARS } from "../prompt";

export const AgentContextInput = z.object({
  nowISO: z.string().max(40),
  timezone: z.string().max(60),
  location: z
    .object({
      latitude: z.number().min(-90).max(90),
      longitude: z.number().min(-180).max(180),
      label: z.string().max(120).optional(),
    })
    .optional(),
  memories: z.array(z.string().max(600)).max(24).default([]),
  tasks: z
    .array(
      z.object({
        id: z.string().max(60),
        title: z.string().max(200),
        priority: z.string().max(20),
        status: z.string().max(20),
      }),
    )
    .max(30)
    .default([]),
});

export const AgentTurnInput = z.object({
  messages: z
    .array(
      z.object({
        role: z.enum(["user", "assistant"]),
        content: z.string().min(1).max(MAX_MESSAGE_CHARS),
      }),
    )
    .min(1)
    .max(40),
  context: AgentContextInput,
});

export const ConfirmInput = z.object({
  tool: z.string().max(60),
  argsJson: z.string().max(4000),
  context: AgentContextInput,
});
