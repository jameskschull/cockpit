import type { Task } from "./types";

export function todayIso(): string {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

/** Local YYYY-MM-DD for an RFC 3339 / ISO timestamp (server stores UTC). */
export function localIsoDate(rfc: string): string {
  const d = new Date(rfc);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export function isOverdue(deadline: string | null): boolean {
  if (!deadline) return false;
  return deadline < todayIso();
}

export function formatDate(iso: string | null): string {
  if (!iso) return "";
  const [y, m, d] = iso.split("-").map(Number);
  const date = new Date(y, m - 1, d);
  return date.toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: date.getFullYear() !== new Date().getFullYear() ? "numeric" : undefined,
  });
}

export function classNames(...parts: Array<string | false | null | undefined>): string {
  return parts.filter(Boolean).join(" ");
}

function isoFromDate(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function dateFromIso(iso: string): Date {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(y, m - 1, d);
}

/** ISO date (YYYY-MM-DD) for the Monday of the week containing `date`. */
export function mondayOfWeek(date: Date = new Date()): string {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  const dow = d.getDay(); // 0=Sun..6=Sat
  const offset = dow === 0 ? -6 : 1 - dow;
  d.setDate(d.getDate() + offset);
  return isoFromDate(d);
}

/** ISO date (YYYY-MM-DD) for the Monday of the week after the given Monday. */
export function nextMonday(mondayIso: string): string {
  const d = dateFromIso(mondayIso);
  d.setDate(d.getDate() + 7);
  return isoFromDate(d);
}

/**
 * The Monday that anchors the user's *current* work week.
 *
 * Mon–Fri: the calendar week containing the date.
 * Sat–Sun: the upcoming work week (the just-ended week rolls into "past").
 *
 * Why: the user treats the work week as Mon–Fri. The moment Friday ends, focus
 * shifts to planning the next week, so "This week" should follow that mental model.
 */
export function currentWorkWeekMonday(date: Date = new Date()): string {
  const monday = mondayOfWeek(date);
  const dow = date.getDay(); // 0=Sun..6=Sat
  if (dow === 0 || dow === 6) {
    return nextMonday(monday);
  }
  return monday;
}

/** Intake grouping buckets, in display order. */
export type IntakeBucket = "today" | "week" | "later" | "unscheduled";

const INTAKE_BUCKET_ORDER: IntakeBucket[] = ["today", "week", "later", "unscheduled"];

const INTAKE_BUCKET_LABEL: Record<IntakeBucket, string> = {
  today: "Today",
  week: "This Week",
  later: "Later",
  unscheduled: "Unscheduled",
};

/**
 * Bucket a task's scheduled date relative to the current work week.
 *
 * - today: due today or overdue (anything scheduled on or before today)
 * - week: later this work week (before next Monday)
 * - later: next Monday onward
 * - unscheduled: no scheduled date
 */
export function intakeBucketFor(scheduledDate: string | null, reference: Date = new Date()): IntakeBucket {
  if (!scheduledDate) return "unscheduled";
  const today = isoFromDate(reference);
  if (scheduledDate <= today) return "today";
  const nextMon = nextMonday(currentWorkWeekMonday(reference));
  if (scheduledDate < nextMon) return "week";
  return "later";
}

export interface TaskGroup {
  key: IntakeBucket;
  label: string;
  tasks: Task[];
}

/**
 * Group incomplete tasks into Today / This Week / Later / Unscheduled sections,
 * preserving the incoming (priority) order within each section. Empty sections
 * are omitted.
 */
export function groupIntakeTasks(tasks: Task[], reference: Date = new Date()): TaskGroup[] {
  const buckets = new Map<IntakeBucket, Task[]>();
  for (const task of tasks) {
    const key = intakeBucketFor(task.scheduled_date, reference);
    const list = buckets.get(key);
    if (list) list.push(task);
    else buckets.set(key, [task]);
  }
  return INTAKE_BUCKET_ORDER.filter((key) => buckets.has(key)).map((key) => ({
    key,
    label: INTAKE_BUCKET_LABEL[key],
    tasks: buckets.get(key)!,
  }));
}

/** "Apr 27 – May 3, 2026" given the Monday's ISO date. */
export function weekRangeLabel(mondayIso: string): string {
  const start = dateFromIso(mondayIso);
  const end = new Date(start);
  end.setDate(end.getDate() + 6);
  const sameYear = start.getFullYear() === end.getFullYear();
  const startOpts: Intl.DateTimeFormatOptions = { month: "short", day: "numeric" };
  const endOpts: Intl.DateTimeFormatOptions = sameYear
    ? { month: "short", day: "numeric", year: "numeric" }
    : { month: "short", day: "numeric", year: "numeric" };
  return `${start.toLocaleDateString(undefined, startOpts)} – ${end.toLocaleDateString(undefined, endOpts)}`;
}
