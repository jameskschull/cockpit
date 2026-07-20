import { Fragment, useCallback, useEffect, useMemo, useState } from "react";
import type { Commitment } from "../types";
import { api } from "../api";
import {
  classNames,
  daysBetween,
  formatDate,
  groupCommitments,
  localIsoDate,
  todayIso,
  waitingBucketFor,
} from "../util";
import { WaitingComposer } from "./WaitingComposer";
import { Calendar } from "./Calendar";

interface Props {
  onOverdueCountChange?: (count: number) => void;
}

interface PickerState {
  id: string;
  anchor: DOMRect;
}

export function WaitingView({ onOverdueCountChange }: Props) {
  const [open, setOpen] = useState<Commitment[]>([]);
  const [closed, setClosed] = useState<Commitment[]>([]);
  const [showClosed, setShowClosed] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [picker, setPicker] = useState<PickerState | null>(null);

  const refresh = useCallback(async () => {
    const [openList, closedList] = await Promise.all([
      api.listCommitments(),
      api.listClosedCommitments(),
    ]);
    setOpen(openList);
    setClosed(closedList);
  }, []);

  useEffect(() => {
    (async () => {
      try {
        await refresh();
        setLoadError(null);
      } catch (e) {
        setLoadError(e instanceof Error ? e.message : String(e));
      } finally {
        setLoaded(true);
      }
    })();
  }, [refresh]);

  const today = todayIso();

  const overdueCount = useMemo(
    () => open.filter((c) => waitingBucketFor(c.expected_date) === "overdue").length,
    [open]
  );

  useEffect(() => {
    onOverdueCountChange?.(overdueCount);
  }, [overdueCount, onOverdueCountChange]);

  const groups = useMemo(() => groupCommitments(open), [open]);

  const handleCreate = useCallback(
    async (fromName: string, what: string, expectedDate: string | null) => {
      await api.createCommitment({ from_name: fromName, what, expected_date: expectedDate });
      await refresh();
    },
    [refresh]
  );

  const handleReceive = useCallback(
    async (id: string) => {
      await api.receiveCommitment(id);
      await refresh();
    },
    [refresh]
  );

  const handleReopen = useCallback(
    async (id: string) => {
      await api.reopenCommitment(id);
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

  const handlePickDate = useCallback(
    async (iso: string) => {
      const p = picker;
      if (!p) return;
      setPicker(null);
      await api.setCommitmentDate(p.id, iso);
      await refresh();
    },
    [picker, refresh]
  );

  const pickerValue = useMemo(
    () => (picker ? open.find((c) => c.id === picker.id)?.expected_date ?? null : null),
    [picker, open]
  );

  if (!loaded) return null;

  const empty = open.length === 0;

  return (
    <>
      <header className="main-header">
        <div className="main-header-row">
          <h1>Waiting on</h1>
        </div>
        <p className="subtitle">Things other people owe you — follow up before they slip.</p>
      </header>

      {loadError && (
        <div className="waiting-error">
          <strong>Couldn’t load commitments.</strong> The <code>commitments</code> table
          may not exist yet — run the new block from <code>supabase/schema.sql</code> in the
          Supabase SQL editor.
          <div className="waiting-error-detail">{loadError}</div>
        </div>
      )}

      <WaitingComposer onSubmit={handleCreate} />

      <div className="waiting-list">
        {groups.map((group) => (
          <Fragment key={group.key}>
            <div
              className={classNames(
                "task-group-divider",
                group.key === "overdue" && "task-group-divider--overdue"
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
                onReceive={() => handleReceive(c.id)}
                onDelete={() => handleDelete(c)}
                onOpenPicker={(anchor) =>
                  setPicker({ id: c.id, anchor: anchor.getBoundingClientRect() })
                }
              />
            ))}
          </Fragment>
        ))}

        {empty && (
          <div className="empty">
            Nothing outstanding. Add what someone owes you above.
          </div>
        )}

        {closed.length > 0 && (
          <>
            <button
              type="button"
              className="waiting-closed-toggle"
              onClick={() => setShowClosed((v) => !v)}
            >
              {showClosed ? "▾" : "▸"} Closed ({closed.length})
            </button>
            {showClosed &&
              closed.map((c) => (
                <ClosedRow
                  key={c.id}
                  commitment={c}
                  onReopen={() => handleReopen(c.id)}
                  onDelete={() => handleDelete(c)}
                />
              ))}
          </>
        )}
      </div>

      {picker && (
        <Calendar
          value={pickerValue}
          anchor={picker.anchor}
          onPick={handlePickDate}
          onClose={() => setPicker(null)}
        />
      )}
    </>
  );
}

function CommitmentRow({
  commitment,
  today,
  onReceive,
  onDelete,
  onOpenPicker,
}: {
  commitment: Commitment;
  today: string;
  onReceive: () => void;
  onDelete: () => void;
  onOpenPicker: (anchor: HTMLElement) => void;
}) {
  const c = commitment;
  const overdue = !!c.expected_date && c.expected_date < today;
  const waited = daysBetween(localIsoDate(c.created_at), today);
  const lateDays = c.expected_date ? daysBetween(c.expected_date, today) : 0;

  const dateLabel = c.expected_date ? formatDate(c.expected_date) : "Set date";

  return (
    <div className={classNames("waiting-row", overdue && "waiting-row--overdue")}>
      <label className="task-checkbox" title="Mark received">
        <input type="checkbox" checked={false} onChange={onReceive} />
        <span className="task-checkbox-box" aria-hidden />
      </label>
      <div className="waiting-main">
        <div className="waiting-what">{c.what}</div>
        <div className="waiting-meta">
          <span className="waiting-from">{c.from_name}</span>
          <span className="waiting-dot">·</span>
          <span>{waited <= 0 ? "added today" : `${waited}d waiting`}</span>
          {overdue && (
            <>
              <span className="waiting-dot">·</span>
              <span className="waiting-late">{lateDays}d late</span>
            </>
          )}
        </div>
      </div>
      <div className="waiting-actions">
        <button
          type="button"
          className={classNames(
            "task-action",
            "waiting-date-action",
            c.expected_date && "task-action--set",
            overdue && "task-action--overdue"
          )}
          data-state={c.expected_date ? "set" : "unset"}
          title="Expected by"
          onClick={(e) => onOpenPicker(e.currentTarget)}
        >
          {dateLabel}
        </button>
        <button type="button" className="task-action task-action--danger" title="Delete" onClick={onDelete}>
          ✕
        </button>
      </div>
    </div>
  );
}

function ClosedRow({
  commitment,
  onReopen,
  onDelete,
}: {
  commitment: Commitment;
  onReopen: () => void;
  onDelete: () => void;
}) {
  const c = commitment;
  return (
    <div className={classNames("waiting-row", "waiting-row--closed")}>
      <label className="task-checkbox" title="Reopen">
        <input type="checkbox" checked onChange={onReopen} />
        <span className="task-checkbox-box" aria-hidden />
      </label>
      <div className="waiting-main">
        <div className="waiting-what waiting-what--closed">{c.what}</div>
        <div className="waiting-meta">
          <span className="waiting-from">{c.from_name}</span>
          <span className="waiting-dot">·</span>
          <span className="waiting-tag">Received</span>
        </div>
      </div>
      <div className="waiting-actions">
        <button type="button" className="task-action" onClick={onReopen}>
          Reopen
        </button>
        <button type="button" className="task-action task-action--danger" title="Delete" onClick={onDelete}>
          ✕
        </button>
      </div>
    </div>
  );
}
