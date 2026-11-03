// Fictional demonstration data for local demo mode only. It is never written
// to Supabase or mixed with real account records. Names and work items are invented.

import { addDaysToDateString } from "../dates";

export function buildSampleData(userId: string, today: string) {
  const now = new Date().toISOString();
  const base = { user_id: userId, created_at: now, updated_at: now };
  const reportTaskId = crypto.randomUUID();
  const meetingTaskId = crypto.randomUUID();
  const inboxTaskId = crypto.randomUUID();
  const tomorrow = addDaysToDateString(today, 1);

  const tasks = [
    {
      ...base,
      id: reportTaskId,
      title: "Draft the quarterly inventory summary for Northwind Bakery",
      description: "Summarize stock levels from the shared sheet for the fictional Northwind Bakery account.",
      expected_result: "A one-page summary in the team folder",
      due_date: addDaysToDateString(today, 3),
      priority: "high",
      source_link: null,
      status: "in_progress",
    },
    {
      ...base,
      id: meetingTaskId,
      title: "Prepare questions for Thursday's planning meeting",
      description: null,
      expected_result: null,
      due_date: null,
      priority: null,
      source_link: null,
      status: "todo",
    },
    {
      ...base,
      id: inboxTaskId,
      title: "Sort the shared inbox labels",
      description: null,
      expected_result: null,
      due_date: null,
      priority: "low",
      source_link: null,
      status: "todo",
    },
  ];

  const task_steps = [
    { ...base, id: crypto.randomUUID(), task_id: reportTaskId, text: "Open the stock sheet and find last quarter's tab", position: 0, done: true },
    { ...base, id: crypto.randomUUID(), task_id: reportTaskId, text: "Copy the three totals into a new document", position: 1, done: false },
    { ...base, id: crypto.randomUUID(), task_id: reportTaskId, text: "Write two sentences about what changed", position: 2, done: false },
  ];

  const notes = [
    {
      ...base,
      id: crypto.randomUUID(),
      title: "Summary format",
      body: "Kai (fictional team lead) said: one page, totals first, short comments after.",
      task_id: reportTaskId,
    },
  ];

  const calendar_events = [
    {
      ...base,
      id: crypto.randomUUID(),
      title: "Planning meeting (sample)",
      kind: "event",
      starts_at: new Date(`${tomorrow}T10:00:00`).toISOString(),
      ends_at: new Date(`${tomorrow}T10:45:00`).toISOString(),
      task_id: meetingTaskId,
      notes: null,
    },
  ];

  return { tasks, task_steps, notes, calendar_events };
}
