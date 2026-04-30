import { supabase } from "./lib/supabase";
import type { AppSettings, NewTaskInput, Priority, Task, UpdateTaskInput } from "./types";

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
};

async function upsertSetting(key: string, value: string) {
  const { error } = await supabase
    .from("settings")
    .upsert({ key, value }, { onConflict: "user_id,key" });
  if (error) throw new Error(error.message);
}
