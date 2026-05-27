import { supabase } from "./lib/supabase";
import type {
  AppSettings,
  Feedback,
  FeedbackKind,
  FeedbackStrength,
  FeedbackWeakness,
  NewTaskInput,
  Priority,
  Task,
  Teammate,
  UpdateTaskInput,
  UpsertFeedbackInput,
} from "./types";

const SETTING_LAST_VIEW = "last_view";
const SETTING_SHOW_PRIORITIES_BANNER = "show_priorities_banner";

function unwrap<T>(data: T | null, error: { message: string } | null): T {
  if (error) throw new Error(error.message);
  if (data === null || data === undefined) throw new Error("no data");
  return data;
}

async function listTasks(completed: boolean): Promise<Task[]> {
  const q = supabase.from("tasks").select("*");
  const { data, error } = completed
    ? await q.not("completed_at", "is", null).order("completed_at", { ascending: false })
    : await q.is("completed_at", null).order("priority_rank", { ascending: true });
  if (error) throw new Error(error.message);
  return (data ?? []) as Task[];
}

export const api = {
  listIncomplete: () => listTasks(false),
  listCompleted: () => listTasks(true),

  createTask: async (input: NewTaskInput): Promise<Task> => {
    const { data, error } = await supabase.rpc("create_task", {
      p_title: input.title,
      p_notes: input.notes ?? null,
      p_deadline: input.deadline ?? null,
      p_scheduled_date: input.scheduled_date ?? null,
    });
    return unwrap(data as Task | null, error);
  },

  updateTask: async (id: string, input: UpdateTaskInput): Promise<Task> => {
    const patch: Record<string, unknown> = { updated_at: new Date().toISOString() };
    if (input.title !== undefined) patch.title = input.title.trim();
    if (input.notes !== undefined) patch.notes = input.notes;
    if (input.deadline !== undefined) patch.deadline = input.deadline;
    if (input.scheduled_date !== undefined) patch.scheduled_date = input.scheduled_date;

    const { data, error } = await supabase
      .from("tasks")
      .update(patch)
      .eq("id", id)
      .select("*")
      .single();
    return unwrap(data as Task | null, error);
  },

  deleteTask: async (id: string): Promise<void> => {
    const { error } = await supabase.from("tasks").delete().eq("id", id);
    if (error) throw new Error(error.message);
  },

  completeTask: async (id: string): Promise<Task> => {
    const { data, error } = await supabase.rpc("complete_task", { p_id: id });
    return unwrap(data as Task | null, error);
  },

  uncompleteTask: async (id: string): Promise<Task> => {
    const { data, error } = await supabase.rpc("uncomplete_task", { p_id: id });
    return unwrap(data as Task | null, error);
  },

  scheduleForToday: async (id: string): Promise<Task> => {
    const { data, error } = await supabase.rpc("schedule_for_today", { p_id: id });
    return unwrap(data as Task | null, error);
  },

  reorderTask: async (
    id: string,
    beforeId: string | null,
    afterId: string | null
  ): Promise<Task[]> => {
    const { data, error } = await supabase.rpc("reorder_task", {
      p_id: id,
      p_before_id: beforeId,
      p_after_id: afterId,
    });
    if (error) throw new Error(error.message);
    return (data ?? []) as Task[];
  },

  getSettings: async (): Promise<AppSettings> => {
    const { data, error } = await supabase.from("settings").select("key,value");
    if (error) throw new Error(error.message);
    const map = new Map<string, string>();
    for (const row of data ?? []) map.set(row.key, row.value);
    return {
      last_view: map.get(SETTING_LAST_VIEW) ?? "intake",
      show_priorities_banner: map.get(SETTING_SHOW_PRIORITIES_BANNER) !== "false",
    };
  },

  setLastView: async (view: string): Promise<void> => {
    await upsertSetting(SETTING_LAST_VIEW, view);
  },

  setShowPrioritiesBanner: async (value: boolean): Promise<void> => {
    await upsertSetting(SETTING_SHOW_PRIORITIES_BANNER, value ? "true" : "false");
  },

  listPriorities: async (): Promise<Priority[]> => {
    const { data, error } = await supabase
      .from("priorities")
      .select("week_start,text,created_at,updated_at")
      .order("week_start", { ascending: false });
    if (error) throw new Error(error.message);
    return (data ?? []) as Priority[];
  },

  upsertPriority: async (weekStart: string, text: string): Promise<Priority | null> => {
    const { data, error } = await supabase.rpc("upsert_priority", {
      p_week_start: weekStart,
      p_text: text,
    });
    if (error) throw new Error(error.message);
    return (data as Priority | null) ?? null;
  },

  listTeammates: async (includeArchived = false): Promise<Teammate[]> => {
    const q = supabase.from("teammates").select("*");
    const { data, error } = includeArchived
      ? await q.order("name", { ascending: true })
      : await q.is("archived_at", null).order("name", { ascending: true });
    if (error) throw new Error(error.message);
    return (data ?? []) as Teammate[];
  },

  createTeammate: async (name: string): Promise<Teammate> => {
    const trimmed = name.trim();
    if (!trimmed) throw new Error("name is required");
    const { data, error } = await supabase
      .from("teammates")
      .insert({ name: trimmed })
      .select("*")
      .single();
    return unwrap(data as Teammate | null, error);
  },

  renameTeammate: async (id: string, name: string): Promise<Teammate> => {
    const trimmed = name.trim();
    if (!trimmed) throw new Error("name is required");
    const { data, error } = await supabase
      .from("teammates")
      .update({ name: trimmed, updated_at: new Date().toISOString() })
      .eq("id", id)
      .select("*")
      .single();
    return unwrap(data as Teammate | null, error);
  },

  archiveTeammate: async (id: string): Promise<Teammate> => {
    const now = new Date().toISOString();
    const { data, error } = await supabase
      .from("teammates")
      .update({ archived_at: now, updated_at: now })
      .eq("id", id)
      .select("*")
      .single();
    return unwrap(data as Teammate | null, error);
  },

  unarchiveTeammate: async (id: string): Promise<Teammate> => {
    const { data, error } = await supabase
      .from("teammates")
      .update({ archived_at: null, updated_at: new Date().toISOString() })
      .eq("id", id)
      .select("*")
      .single();
    return unwrap(data as Teammate | null, error);
  },

  deleteTeammate: async (id: string): Promise<void> => {
    const { error } = await supabase.from("teammates").delete().eq("id", id);
    if (error) throw new Error(error.message);
  },

  listFeedback: async (teammateId: string): Promise<Feedback[]> => {
    const { data, error } = await supabase
      .from("feedback")
      .select(
        "id, teammate_id, observation_date, synthesis, specific_coaching, created_at, updated_at, " +
          "feedback_strengths (id, text, position), " +
          "feedback_weaknesses (id, text, position)"
      )
      .eq("teammate_id", teammateId)
      .order("observation_date", { ascending: false })
      .order("created_at", { ascending: false });
    if (error) throw new Error(error.message);

    type Row = Omit<Feedback, "strengths" | "weaknesses"> & {
      feedback_strengths: FeedbackStrength[] | null;
      feedback_weaknesses: FeedbackWeakness[] | null;
    };
    const rows = ((data ?? []) as unknown) as Row[];
    return rows.map(({ feedback_strengths, feedback_weaknesses, ...rest }) => ({
      ...rest,
      strengths: (feedback_strengths ?? [])
        .slice()
        .sort((a, b) => a.position - b.position),
      weaknesses: (feedback_weaknesses ?? [])
        .slice()
        .sort((a, b) => a.position - b.position),
    }));
  },

  addQuickFeedback: async (
    teammateId: string,
    kind: FeedbackKind,
    text: string,
    observationDate?: string | null
  ): Promise<Feedback> => {
    const { data, error } = await supabase.rpc("add_quick_feedback", {
      p_teammate_id: teammateId,
      p_kind: kind,
      p_text: text,
      p_observation_date: observationDate ?? null,
    });
    const row = unwrap(
      data as Omit<Feedback, "strengths" | "weaknesses"> | null,
      error
    );
    // RPC returns the feedback row only; quick-add inserts a single child row
    // synchronously, so synthesize the joined shape for the caller.
    const strength: FeedbackStrength | null =
      kind === "strength" ? { id: row.id, text, position: 0 } : null;
    const weakness: FeedbackWeakness | null =
      kind === "weakness" ? { id: row.id, text, position: 0 } : null;
    return {
      ...row,
      strengths: strength ? [strength] : [],
      weaknesses: weakness ? [weakness] : [],
    };
  },

  upsertFeedback: async (input: UpsertFeedbackInput): Promise<Feedback> => {
    const { data, error } = await supabase.rpc("upsert_feedback", {
      p_id: input.id ?? null,
      p_teammate_id: input.teammate_id,
      p_observation_date: input.observation_date,
      p_synthesis: input.synthesis ?? null,
      p_specific_coaching: input.specific_coaching ?? null,
      p_strengths: input.strengths,
      p_weaknesses: input.weaknesses,
    });
    const row = unwrap(
      data as Omit<Feedback, "strengths" | "weaknesses"> | null,
      error
    );
    // RPC returns the feedback row only; re-read joined children so callers
    // always get the full object graph back from an upsert.
    const [strengthsRes, weaknessesRes] = await Promise.all([
      supabase
        .from("feedback_strengths")
        .select("id, text, position")
        .eq("feedback_id", row.id)
        .order("position", { ascending: true }),
      supabase
        .from("feedback_weaknesses")
        .select("id, text, position")
        .eq("feedback_id", row.id)
        .order("position", { ascending: true }),
    ]);
    if (strengthsRes.error) throw new Error(strengthsRes.error.message);
    if (weaknessesRes.error) throw new Error(weaknessesRes.error.message);
    return {
      ...row,
      strengths: (strengthsRes.data ?? []) as FeedbackStrength[],
      weaknesses: (weaknessesRes.data ?? []) as FeedbackWeakness[],
    };
  },

  deleteFeedback: async (id: string): Promise<void> => {
    const { error } = await supabase.from("feedback").delete().eq("id", id);
    if (error) throw new Error(error.message);
  },
};

async function upsertSetting(key: string, value: string) {
  const { error } = await supabase
    .from("settings")
    .upsert({ key, value }, { onConflict: "user_id,key" });
  if (error) throw new Error(error.message);
}
