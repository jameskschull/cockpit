export interface Task {
  id: string;
  title: string;
  notes: string | null;
  deadline: string | null;
  scheduled_date: string | null;
  completed_at: string | null;
  priority_rank: number;
  created_at: string;
  updated_at: string;
}

export type ViewName =
  | "priorities"
  | "intake"
  | "today"
  | "completed"
  | "feedback";

export interface Priority {
  week_start: string;
  text: string;
  created_at: string;
  updated_at: string;
}

export interface AppSettings {
  last_view: string;
  show_priorities_banner: boolean;
}

export interface NewTaskInput {
  title: string;
  notes?: string | null;
  deadline?: string | null;
  scheduled_date?: string | null;
}

export interface UpdateTaskInput {
  title?: string;
  notes?: string | null;
  deadline?: string | null;
  scheduled_date?: string | null;
}

export interface Teammate {
  id: string;
  name: string;
  archived_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface FeedbackStrength {
  id: string;
  text: string;
  position: number;
}

export interface FeedbackWeakness {
  id: string;
  text: string;
  position: number;
}

export interface Feedback {
  id: string;
  teammate_id: string;
  observation_date: string; // YYYY-MM-DD
  synthesis: string | null;
  specific_coaching: string | null;
  strengths: FeedbackStrength[];
  weaknesses: FeedbackWeakness[];
  created_at: string;
  updated_at: string;
}

export type FeedbackKind = "strength" | "weakness";

export interface UpsertFeedbackInput {
  id?: string | null;
  teammate_id: string;
  observation_date: string;
  synthesis?: string | null;
  specific_coaching?: string | null;
  strengths: string[];
  weaknesses: string[];
}
