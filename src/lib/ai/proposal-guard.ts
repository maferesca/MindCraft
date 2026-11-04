import { proposalSchema, type AssistantContext, type Proposal } from "../schemas";

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

export function sanitizeProposals(raw: unknown, context: AssistantContext, userText: string): Proposal[] {
  if (!Array.isArray(raw)) return [];
  const knownTaskIds = new Set([context.task?.id, ...(context.otherTasks ?? []).map((task) => task.id)].filter(Boolean));
  const statedDate = DATE_HINT.test(userText);
  const statedPriority = PRIORITY_HINT.test(userText);
  const result: Proposal[] = [];

  for (const candidate of raw.slice(0, 10)) {
    if (result.length >= 3) break;
    const parsed = proposalSchema.safeParse(candidate);
    if (!parsed.success) continue;
    const proposal = parsed.data;

    if (proposal.type === "propose_steps" && !knownTaskIds.has(proposal.task_id)) continue;
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
    result.push(proposal);
  }
  return result;
}

function isRealDate(value: string | undefined): boolean {
  if (!value) return false;
  const date = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value;
}
