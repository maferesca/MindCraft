import { z } from "zod";
import { BLOCK_TYPES, preferencesSchema } from "./preferences";

// ---------------------------------------------------------------------------
// Record inputs (validated before writing; the database enforces the same limits)
// ---------------------------------------------------------------------------

const optionalText = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .transform((value) => (value === "" ? null : value))
    .nullable()
    .optional();

export const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Use the format YYYY-MM-DD");

export const taskInputSchema = z.object({
  title: z.string().trim().min(1, "Give the task a title").max(200),
  description: optionalText(4000),
  expected_result: optionalText(1000),
  due_date: isoDate.nullable().optional(),
  due_time: z.string().regex(/^\d{2}:\d{2}(:\d{2})?$/, "Use a valid time").nullable().optional(),
  priority: z.enum(["low", "medium", "high"]).nullable().optional(),
  source_link: optionalText(1000),
  project_id: z.string().uuid().nullable().optional(),
  assignee: optionalText(120),
  status: z.enum(["todo", "in_progress", "done"]).optional(),
});
export type TaskInput = z.infer<typeof taskInputSchema>;

export const stepTextSchema = z.string().trim().min(1, "Write the step").max(500);

export const noteInputSchema = z.object({
  title: optionalText(200),
  body: z.string().max(20000),
  task_id: z.string().uuid().nullable().optional(),
});

const httpUrl = z
  .string()
  .trim()
  .max(2000)
  .refine((value) => {
    try {
      return ["http:", "https:"].includes(new URL(value).protocol);
    } catch {
      return false;
    }
  }, "Use a full link starting with http:// or https://");

export const resourceInputSchema = z.object({
  name: z.string().trim().min(1, "Give the link a name").max(200),
  url: httpUrl,
  description: optionalText(1000),
  task_id: z.string().uuid().nullable().optional(),
  project_id: z.string().uuid().nullable().optional(),
});

export const progressInputSchema = z
  .object({ task_id: z.string().uuid().nullable(), completed_text: optionalText(4000), next_text: optionalText(4000) })
  .refine((value) => Boolean(value.completed_text || value.next_text), { message: "Fill in Completed or Next", path: ["completed_text"] });

export const helpInputSchema = z.object({
  task_id: z.string().uuid().nullable(),
  blocking: z.string().trim().min(1, "Describe what is blocking you").max(4000),
  support: z.string().trim().min(1, "Describe the support you need").max(4000),
});

export const eventInputSchema = z
  .object({
    title: z.string().trim().min(1, "Give the event a title").max(200),
    kind: z.enum(["event", "work_session"]),
    starts_at: z.string().datetime({ offset: true }),
    ends_at: z.string().datetime({ offset: true }),
    task_id: z.string().uuid().nullable().optional(),
    notes: optionalText(2000),
  })
  .refine((value) => new Date(value.ends_at) > new Date(value.starts_at), {
    message: "The end must be after the start",
    path: ["ends_at"],
  });

// ---------------------------------------------------------------------------
// AI proposals. A proposal is a suggestion; nothing changes until the user applies it.
// ---------------------------------------------------------------------------

const proposedTask = z.object({
  title: z.string().trim().min(1).max(200),
  description: z.string().trim().max(1000).optional(),
  expected_result: z.string().trim().max(500).optional(),
  due_date: isoDate.optional(),
  priority: z.enum(["low", "medium", "high"]).optional(),
  steps: z.array(z.string().trim().min(1).max(300)).max(8).optional(),
});

export const proposalSchema = z.discriminatedUnion("type", [
  z.object({
    type: z.literal("create_tasks"),
    summary: z.string().max(400),
    tasks: z.array(proposedTask).min(1).max(10),
    order_explanation: z.string().max(400).optional(),
  }),
  z.object({
    type: z.literal("propose_steps"),
    summary: z.string().max(400),
    task_id: z.string().uuid(),
    steps: z.array(z.string().trim().min(1).max(300)).min(1).max(8),
  }),
  z.object({
    type: z.literal("suggest_blocks"),
    summary: z.string().max(400),
    blocks: z.array(z.object({ block_type: z.enum(BLOCK_TYPES), reason: z.string().max(200).optional() })).min(1).max(5),
  }),
  z.object({
    type: z.literal("suggest_layout"),
    summary: z.string().max(400),
    items: z
      .array(z.object({ block_type: z.enum(BLOCK_TYPES), size: z.enum(["small", "medium", "large"]) }))
      .min(1)
      .max(5),
  }),
  z.object({
    type: z.literal("suggest_preferences"),
    summary: z.string().max(400),
    changes: preferencesSchema.omit({ timer: true }).partial().refine((value) => Object.keys(value).length > 0),
  }),
  z.object({
    type: z.literal("draft_clarification"),
    summary: z.string().max(400),
    task_id: z.string().uuid().optional(),
    message: z.string().trim().min(1).max(1500),
  }),
]);
export type Proposal = z.infer<typeof proposalSchema>;
export const PROPOSAL_TYPES = proposalSchema.options.map((option) => option.shape.type.value);

export const assistantResultSchema = z.object({
  reply: z.string().trim().min(1).max(2000),
  question: z.string().trim().max(300).optional(),
  proposals: z.array(proposalSchema).max(3),
});
export type AssistantResult = z.infer<typeof assistantResultSchema>;

// ---------------------------------------------------------------------------
// Requests from the browser to AI endpoints
// ---------------------------------------------------------------------------

export const assistantContextSchema = z.object({
  mode: z.enum(["chat", "help_me_start", "planning", "missing_information", "onboarding"]),
  task: z
    .object({
      id: z.string().uuid(),
      title: z.string().max(200),
      description: z.string().max(4000).nullable().optional(),
      expected_result: z.string().max(1000).nullable().optional(),
      due_date: z.string().max(20).nullable().optional(),
      priority: z.string().max(10).nullable().optional(),
      status: z.string().max(20),
      steps: z.array(z.object({ text: z.string().max(500), done: z.boolean() })).max(30),
    })
    .nullable()
    .optional(),
  // Titles only, so the assistant can compare tasks without seeing everything.
  otherTasks: z.array(z.object({ id: z.string().uuid(), title: z.string().max(200), status: z.string().max(20), due_date: z.string().max(20).nullable() })).max(30).optional(),
  visibleBlocks: z.array(z.enum(BLOCK_TYPES)).max(20).optional(),
  preferences: z
    .object({
      responseDetail: z.enum(["brief", "balanced", "detailed"]),
      language: z.string().max(40),
      planningStyle: z.string().max(40),
      focusTime: z.string().max(40).optional(),
      startHelp: z.array(z.string().max(40)).max(5).optional(),
      focusMinutes: z.number().int().min(1).max(600).optional(),
    })
    .optional(),
  declined: z.array(z.enum(["timer", "planning", "breaks", "assistance"])).max(4).optional(),
  missingInformation: z.array(z.string().max(60)).max(6).optional(),
  today: isoDate.optional(),
});
export type AssistantContext = z.infer<typeof assistantContextSchema>;

export const assistantRequestSchema = z.object({
  messages: z
    .array(z.object({ role: z.enum(["user", "assistant"]), content: z.string().trim().min(1).max(4000) }))
    .min(1)
    .max(20),
  context: assistantContextSchema,
});
export type AssistantRequest = z.infer<typeof assistantRequestSchema>;
