export function todayIso(): string {
  const d = new Date();
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
