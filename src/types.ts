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

export type ViewName = "intake" | "today" | "deadlines" | "completed";

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
