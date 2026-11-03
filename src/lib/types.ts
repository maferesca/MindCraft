// Domain records. Field names match the database columns (snake_case) so
// rows can pass between Supabase and the UI without a mapping layer.

export type TaskStatus = "todo" | "in_progress" | "blocked" | "done";
export type TaskPriority = "low" | "medium" | "high";
export type BlockType = "task_list" | "calendar" | "next_step" | "focus_timer" | "notes";
export type Breakpoint = "lg" | "md";

export interface Profile {
  user_id: string;
  display_name: string | null;
  timezone: string;
  onboarding_completed: boolean;
}

export interface Task {
  id: string;
  user_id: string;
  title: string;
  description: string | null;
  expected_result: string | null;
  due_date: string | null; // yyyy-MM-dd, never guessed
  priority: TaskPriority | null;
  source_link: string | null;
  status: TaskStatus;
  created_at: string;
  updated_at: string;
}

export interface TaskStep {
  id: string;
  user_id: string;
  task_id: string;
  text: string;
  position: number;
  done: boolean;
  created_at: string;
  updated_at: string;
}

export interface Note {
  id: string;
  user_id: string;
  title: string | null;
  body: string;
  task_id: string | null;
  created_at: string;
  updated_at: string;
}

export interface CalendarEvent {
  id: string;
  user_id: string;
  title: string;
  kind: "event" | "work_session";
  starts_at: string;
  ends_at: string;
  task_id: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export interface GridPosition {
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface WorkspaceBlock {
  id: string;
  user_id: string;
  workspace_id: string;
  block_type: BlockType;
  title: string | null;
  config: Record<string, unknown>;
  layouts: Partial<Record<Breakpoint, GridPosition>>;
  mobile_order: number;
  hidden: boolean;
  created_at: string;
  updated_at: string;
}

export interface Workspace {
  id: string;
  user_id: string;
  name: string;
}

export interface ChatMessage {
  id: string;
  user_id: string;
  conversation_id: string;
  role: "user" | "assistant";
  content: string;
  proposal: unknown | null;
  created_at: string;
}

export interface Streak {
  current_streak: number;
  best_streak: number;
  last_visit_date: string | null;
}

export interface NotificationPreferences {
  user_id: string;
  style: "off" | "friendly" | "playful" | "minimal";
  quiet_hours_start: string | null; // HH:mm[:ss]
  quiet_hours_end: string | null;
  preferred_time: string | null;
  inactivity_days: number;
  snoozed_until: string | null;
}
