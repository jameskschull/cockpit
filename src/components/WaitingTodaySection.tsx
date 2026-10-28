import { Fragment, useCallback, useEffect, useMemo, useState } from "react";
import type { Commitment } from "../types";
import { api } from "../api";
import { classNames, groupOwedForToday, todayIso, waitingBucketFor } from "../util";
import { CommitmentRow } from "./WaitingView";

interface Props {
  onOverdueCountChange?: (count: number) => void;
}

const COLLAPSED_KEY = "cockpit.todayWaitingCollapsed";

/**
 * Commitments due today (or overdue) and later this week, shown beneath the
 * Today task list so follow-ups don't get lost in the Waiting On view.
 */
export function WaitingTodaySection({ onOverdueCountChange }: Props) {
  const [open, setOpen] = useState<Commitment[]>([]);
  const [collapsed, setCollapsed] = useState(
    () => localStorage.getItem(COLLAPSED_KEY) === "1"
  );

  const refresh = useCallback(async () => {
    setOpen(await api.listCommitments());
  }, []);

  useEffect(() => {
    // The commitments table may not exist yet; Waiting On surfaces that error.
    refresh().catch(() => {});
  }, [refresh]);

  const toggleCollapsed = useCallback(() => {
    setCollapsed((prev) => {
      localStorage.setItem(COLLAPSED_KEY, prev ? "0" : "1");
      return !prev;
    });
  }, []);

  const today = todayIso();

  const overdueCount = useMemo(
    () => open.filter((c) => waitingBucketFor(c.expected_date) === "overdue").length,
    [open]
  );

  useEffect(() => {
    onOverdueCountChange?.(overdueCount);
  }, [overdueCount, onOverdueCountChange]);

  const groups = useMemo(() => groupOwedForToday(open), [open]);
  const total = groups.reduce((n, g) => n + g.commitments.length, 0);

  const handleReceive = useCallback(
    async (id: string) => {
      await api.receiveCommitment(id);
      await refresh();
    },
    [refresh]
  );

  const handleDelete = useCallback(
    async (c: Commitment) => {
      const ok = window.confirm(
        `Delete "${c.what}" from ${c.from_name}? This cannot be undone.`
      );
      if (!ok) return;
      await api.deleteCommitment(c.id);
      await refresh();
    },
    [refresh]
  );

  if (total === 0) return null;

  return (
    <>
      <button
        type="button"
        className={classNames(
          "task-group-divider",
          "waiting-today-toggle",
          overdueCount > 0 && "task-group-divider--overdue"
        )}
        aria-expanded={!collapsed}
        onClick={toggleCollapsed}
      >
        <span className="task-group-label">
          {collapsed ? "▸" : "▾"} Waiting on
        </span>
        <span className="task-group-count">{total}</span>
      </button>
      {!collapsed &&
        groups.map((group) => (
          <Fragment key={group.key}>
            <div
              className={classNames(
                "task-group-divider",
                "waiting-today-subgroup",
                group.commitments.some((c) => c.expected_date! < today) &&
                  "task-group-divider--overdue"
              )}
              aria-hidden="true"
            >
              <span className="task-group-label">{group.label}</span>
              <span className="task-group-count">{group.commitments.length}</span>
            </div>
            {group.commitments.map((c) => (
              <CommitmentRow
                key={c.id}
                commitment={c}
                today={today}
                compact
                onReceive={() => handleReceive(c.id)}
                onDelete={() => handleDelete(c)}
              />
            ))}
          </Fragment>
        ))}
    </>
  );
}
