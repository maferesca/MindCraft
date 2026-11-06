import { BLOCK_TYPES } from "../preferences";
import { proposalSchema, type AssistantContext, type Proposal } from "../schemas";
import { normalizeTitle } from "../task-plan";

// Words that show the user actually stated a date or a priority. If none
// appear, any date or priority in a proposal was invented and is removed.
const DATE_HINT =
  /\d|today|tomorrow|tonight|monday|tuesday|wednesday|thursday|friday|saturday|sunday|week|month|deadline|due|january|february|march|april|may|june|july|august|september|october|november|december|morgen|heute|mañana|hoy|demain|aujourd|domani|oggi|amanhã|hoje/i;
const PRIORITY_HINT = /urgent|asap|priority|important|critical|high|low|dringend|wichtig|urgente|importante|prioridad|priorit/i;

// Chat bubbles show plain text, so bold or italic markers would appear literally.
// List markers and line breaks are kept because they read correctly as text.
export function stripInlineMarkdown(text: string): string {
  return text.replace(/\*\*([^*\n]+)\*\*/g, "$1").replace(/__([^_\n]+)__/g, "$1").replace(/`([^`\n]+)`/g, "$1");
}

// Repairs what can be repaired, so one bad optional field does not lose a useful
// plan. A task id is kept only if it is the selected task, the one allowed destination.
function repairTaskPlan(candidate: Record<string, unknown>, context: AssistantContext) {
  const blockType = (value: unknown) => (value as { block_type?: string } | null | undefined)?.block_type;
  const isValid = (value: unknown) => (BLOCK_TYPES as readonly unknown[]).includes(blockType(value));
  const plan = { ...candidate };
  const blockIds = (context.taskBlocks ?? []).map((block) => block.id);
  if (!blockIds.includes(plan.task_block_id as string)) delete plan.task_block_id;
  if (!isValid(plan.recommended_block)) delete plan.recommended_block;
  if (!isValid(plan.alternative_block) || !plan.recommended_block || blockType(plan.alternative_block) === blockType(plan.recommended_block)) {
    delete plan.alternative_block;
  }
  if (plan.task_id && plan.task_id !== context.task?.id) return null;
  if (plan.task && typeof plan.task === "object") {
    const task = { ...(plan.task as Record<string, unknown>) };
    if (typeof plan.summary !== "string" || !plan.summary.trim()) plan.summary = typeof task.title === "string" ? task.title.slice(0, 400) : "Suggested plan";
    const minutes = task.estimated_minutes;
    if (typeof minutes !== "number" || !Number.isInteger(minutes) || minutes < 1 || minutes > 600) delete task.estimated_minutes;
    for (const field of ["deliverable", "done_when"]) if (!task[field]) delete task[field];
    plan.task = task;
  }
  return plan;
}

const WORD = /[\p{L}\p{N}]{4,}/gu;

// A field only counts as stated if most of its words came from the person or
// the selected task. The model cannot promote its own suggestion to a requirement.
function supportedBySource(text: string | undefined, source: string) {
  const words = text?.toLowerCase().match(WORD);
  if (!words?.length) return false;
  return words.filter((word) => source.includes(word)).length / words.length >= 0.6;
}

// The buttons set how many steps fit their purpose. In chat, the person's own words decide.
function stepLimit(context: AssistantContext) {
  if (context.helpRequest === "steps" || context.helpRequest === "smaller") {
    return { one_step: 1, short_list: 5, full_overview: 12 }[context.preferences?.planningStyle ?? ""] ?? 12;
  }
  return context.helpRequest ? 1 : 12;
}

// Steps go before the written work when they are what to do now, so the current step
// changes. Guided steps asked for as a plan keep their place at the end.
function stepsComeFirst(context: AssistantContext) {
  if (!context.helpRequest) return false;
  return !(context.helpRequest === "steps" && context.preferences?.planningStyle === "short_list");
}

// A missing label must not lose a useful suggestion, so the card gets a plain one.
function withSummary(candidate: Record<string, unknown>, fallback: string) {
  return typeof candidate.summary === "string" && candidate.summary.trim() ? candidate : { ...candidate, summary: fallback };
}

function repairSteps(candidate: Record<string, unknown>) {
  const rest: Record<string, unknown> = { ...withSummary(candidate, "Suggested steps") };
  delete rest.insert_first;
  return Array.isArray(rest.steps) ? { ...rest, steps: rest.steps.slice(0, 24) } : rest;
}

function freshSteps(steps: string[], task: AssistantContext["task"], taskId: string) {
  const seen = new Set(task?.id === taskId ? task.steps.map((step) => normalizeTitle(step.text)) : []);
  return steps.filter((step) => {
    const key = normalizeTitle(step);
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

export function sanitizeProposals(raw: unknown, context: AssistantContext, userText: string): Proposal[] {
  if (!Array.isArray(raw)) return [];
  const knownTaskIds = new Set([context.task?.id, ...(context.otherTasks ?? []).map((task) => task.id), ...(context.group?.tasks ?? []).map((task) => task.id)].filter(Boolean));
  const knownBlockIds = new Set((context.taskBlocks ?? []).map((block) => block.id));
  const statedDate = DATE_HINT.test(userText);
  const statedPriority = PRIORITY_HINT.test(userText);
  const result: Proposal[] = [];

  for (const candidate of raw.slice(0, 10)) {
    if (result.length >= 3) break;
    const kind = candidate && typeof candidate === "object" ? (candidate as { type?: unknown }).type : null;
    const repaired =
      kind === "task_plan"
        ? repairTaskPlan(candidate as Record<string, unknown>, context)
        : kind === "propose_steps"
          ? repairSteps(candidate as Record<string, unknown>)
          : kind === "record_missing_info"
            ? withSummary(candidate as Record<string, unknown>, "Missing information")
            : candidate;
    const parsed = proposalSchema.safeParse(repaired);
    if (!parsed.success) continue;
    const proposal = parsed.data;

    if (proposal.type === "move_task" && (!knownTaskIds.has(proposal.task_id) || !knownBlockIds.has(proposal.task_block_id))) continue;
    if (proposal.type === "propose_steps") {
      if (!knownTaskIds.has(proposal.task_id)) continue;
      proposal.steps = freshSteps(proposal.steps, context.task, proposal.task_id).slice(0, stepLimit(context));
      if (!proposal.steps.length) continue;
      if (stepsComeFirst(context)) proposal.insert_first = true;
    }
    if (proposal.type === "record_missing_info") {
      if (proposal.task_id !== context.task?.id) continue;
      const recorded = (context.missingInformation ?? []).map(normalizeTitle);
      if (recorded.includes(normalizeTitle(proposal.missing))) continue;
    }
    if (proposal.type === "draft_clarification" && proposal.task_id && !knownTaskIds.has(proposal.task_id)) {
      delete proposal.task_id;
    }
    if (proposal.type === "create_tasks") {
      proposal.tasks = proposal.tasks.map((task) => {
        const clean = { ...task };
        if (!statedDate || !isRealDate(clean.due_date)) delete clean.due_date;
        if (!statedPriority) delete clean.priority;
        return clean;
      });
    }
    if (proposal.type === "task_plan") {
      // A plan always has a first action and a deliverable to follow, which is what
      // the Task guide shows. With no reason from the model, the card shows its purpose.
      if (!proposal.recommended_block && !proposal.block_limitation) proposal.recommended_block = { block_type: "next_step" };
      if (!statedDate || !isRealDate(proposal.task.due_date)) delete proposal.task.due_date;
      if (!statedPriority) delete proposal.task.priority;
      const source = [userText, context.task?.title, context.task?.description, context.task?.expected_result].filter(Boolean).join("\n").toLowerCase();
      proposal.stated_by_user = proposal.stated_by_user?.filter((field) => supportedBySource(proposal.task[field], source));
    }
    result.push(proposal);
  }
  return result;
}

const FIGURE = /[$€£]\s?\d[\d,.]*|\d[\d,.]*\s?%|\b\d{1,3}(?:,\d{3})+\b/g;

export const NO_INVENTED_FIGURES_REPLY =
  "I can't open files or sheets, so I can't fill in real figures. Paste the numbers here and I'll help you draft it, or use the plan to start from your source.";

// A model can write a convincing report from nothing. Figures the person never gave
// must not reach them, so a reply with several of those is replaced.
export function withoutInventedFigures(reply: string, knownText: string) {
  const invented = (reply.match(FIGURE) ?? []).filter((figure) => !knownText.includes(figure.replace(/[$€£\s%]/g, "")));
  return invented.length >= 2 ? NO_INVENTED_FIGURES_REPLY : reply;
}

export const NO_PLAN_REPLY = "I couldn't prepare that plan this time. Please try again, or add the task yourself.";

// Some replies announce a plan and then include none, which leaves nothing to act on.
export function withoutEmptyPromise(reply: string, proposals: Proposal[], question?: string) {
  const announcesPlan = reply.length < 200 && /\bplan\b/i.test(reply);
  return announcesPlan && !proposals.length && !question ? NO_PLAN_REPLY : reply;
}

// When someone asks where to begin, the answer is one action. If the model only
// wrote it in the reply, this keeps it one press away from being saved to the task.
export function ensureFirstAction(proposals: Proposal[], context: AssistantContext, reply: string): Proposal[] {
  const task = context.task;
  const step = reply.trim();
  if (context.helpRequest !== "where_to_begin" || !task || proposals.length || !step || step.length > 300 || step.includes("\n")) return proposals;
  return [{ type: "propose_steps", summary: "Suggested first action", task_id: task.id, steps: [step], insert_first: true }];
}

function isRealDate(value: string | undefined): boolean {
  if (!value) return false;
  const date = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value;
}
