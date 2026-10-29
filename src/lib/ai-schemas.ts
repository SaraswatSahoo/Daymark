/**
 * Request and response contracts for the optional AI features. Shared by the
 * server (validation) and the client (typing). Input sizes are bounded so a single
 * request never sends more than necessary to Groq.
 */
import { z } from "zod";

export const AI_LIMITS = {
  noteChars: 12_000,
  shortChars: 4_000,
  rewriteChars: 8_000,
  reviewChars: 12_000,
  reviewItems: 80,
} as const;

export const REWRITE_MODES = ["shorten", "clarify", "reorganize", "fix"] as const;

export const aiRequestSchema = z.discriminatedUnion("op", [
  z.object({
    op: z.literal("summarize"),
    title: z.string().max(300).default(""),
    content: z.string().min(1, "The note is empty.").max(AI_LIMITS.noteChars, "This note is too long to summarize at once."),
  }),
  z.object({
    op: z.literal("extract-tasks"),
    title: z.string().max(300).default(""),
    content: z.string().min(1, "There is no text to extract tasks from.").max(AI_LIMITS.noteChars, "This text is too long. Select a shorter part."),
    today: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  }),
  z.object({
    op: z.literal("title"),
    content: z.string().min(1, "Write something first.").max(AI_LIMITS.shortChars * 2),
  }),
  z.object({
    op: z.literal("breakdown"),
    title: z.string().min(1).max(300),
    description: z.string().max(AI_LIMITS.shortChars).default(""),
    existing: z.array(z.string().max(300)).max(50).default([]),
  }),
  z.object({
    op: z.literal("rewrite"),
    mode: z.enum(REWRITE_MODES),
    text: z.string().min(1, "Select some text first.").max(AI_LIMITS.rewriteChars, "Select less text (max 8,000 characters)."),
  }),
  z.object({
    op: z.literal("weekly-review"),
    range: z.string().max(60),
    completed: z.array(z.string().max(300)).max(AI_LIMITS.reviewItems),
    open: z.array(z.string().max(300)).max(AI_LIMITS.reviewItems),
    notes: z.array(z.string().max(500)).max(40),
    reflection: z.string().max(2000).default(""),
  }),
]);
export type AiRequest = z.input<typeof aiRequestSchema>;

export const extractedTaskSchema = z.object({
  title: z.string().min(1).max(300),
  dueDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable(),
  priority: z.enum(["low", "medium", "high", "urgent"]).nullable(),
  notes: z.string().max(1000).nullable(),
});
export type ExtractedTask = z.infer<typeof extractedTaskSchema>;

export const extractTasksResponseSchema = z.object({ tasks: z.array(extractedTaskSchema).max(15) });
export const titleResponseSchema = z.object({ title: z.string().min(1).max(120) });
export const breakdownResponseSchema = z.object({ subtasks: z.array(z.string().min(1).max(200)).min(1).max(10) });

export type AiResponse =
  | { op: "summarize"; text: string; model: string }
  | { op: "extract-tasks"; tasks: ExtractedTask[]; model: string }
  | { op: "title"; title: string; model: string }
  | { op: "breakdown"; subtasks: string[]; model: string }
  | { op: "rewrite"; text: string; model: string }
  | { op: "weekly-review"; text: string; model: string };

/** JSON Schemas for Groq Structured Outputs (strict mode: all keys required, no extra keys). */
export const JSON_SCHEMAS = {
  extractTasks: {
    type: "object",
    additionalProperties: false,
    required: ["tasks"],
    properties: {
      tasks: {
        type: "array",
        items: {
          type: "object",
          additionalProperties: false,
          required: ["title", "dueDate", "priority", "notes"],
          properties: {
            title: { type: "string", description: "Short imperative task title" },
            dueDate: { type: ["string", "null"], description: "YYYY-MM-DD if a date is explicitly stated, else null" },
            priority: { type: ["string", "null"], enum: ["low", "medium", "high", "urgent", null] },
            notes: { type: ["string", "null"], description: "Optional brief context from the source" },
          },
        },
      },
    },
  },
  title: {
    type: "object",
    additionalProperties: false,
    required: ["title"],
    properties: { title: { type: "string" } },
  },
  breakdown: {
    type: "object",
    additionalProperties: false,
    required: ["subtasks"],
    properties: { subtasks: { type: "array", items: { type: "string" } } },
  },
} as const;
