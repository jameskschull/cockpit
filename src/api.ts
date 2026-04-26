import { invoke } from "@tauri-apps/api/core";
import type { AppSettings, NewTaskInput, Priority, Task, UpdateTaskInput } from "./types";

export const api = {
  listIncomplete: () => invoke<Task[]>("list_incomplete"),
  listCompleted: () => invoke<Task[]>("list_completed"),
  createTask: (input: NewTaskInput) => invoke<Task>("create_task", { input }),
  updateTask: (id: string, input: UpdateTaskInput) =>
    invoke<Task>("update_task", { id, input }),
  deleteTask: (id: string) => invoke<void>("delete_task", { id }),
  completeTask: (id: string) => invoke<Task>("complete_task", { id }),
  uncompleteTask: (id: string) => invoke<Task>("uncomplete_task", { id }),
  scheduleForToday: (id: string) => invoke<Task>("schedule_for_today", { id }),
  reorderTask: (id: string, beforeId: string | null, afterId: string | null) =>
    invoke<Task[]>("reorder_task", { id, beforeId, afterId }),
  getSettings: () => invoke<AppSettings>("get_settings"),
  setLastView: (view: string) => invoke<void>("set_last_view", { view }),
  setShowPrioritiesBanner: (value: boolean) =>
    invoke<void>("set_show_priorities_banner", { value }),
  listPriorities: () => invoke<Priority[]>("list_priorities"),
  upsertPriority: (weekStart: string, text: string) =>
    invoke<Priority | null>("upsert_priority", { weekStart, text }),
};
