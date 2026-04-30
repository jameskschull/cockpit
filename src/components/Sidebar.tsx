import { useDroppable } from "@dnd-kit/core";
import type { ViewName } from "../types";
import { classNames } from "../util";

interface Props {
  current: ViewName;
  counts: Record<ViewName, number>;
  onChange: (v: ViewName) => void;
  onSignOut?: () => void;
}

const ITEMS: { view: ViewName; label: string; hotkey: string }[] = [
  { view: "priorities", label: "Priorities", hotkey: "1" },
  { view: "intake", label: "Intake", hotkey: "2" },
  { view: "today", label: "Today", hotkey: "3" },
  { view: "deadlines", label: "Deadlines", hotkey: "4" },
  { view: "completed", label: "Completed", hotkey: "5" },
];

export const TODAY_DROPPABLE_ID = "drop-today";

export function Sidebar({ current, counts, onChange, onSignOut }: Props) {
  return (
    <aside className="sidebar">
      <div className="sidebar-brand">Cockpit</div>
      <nav className="sidebar-nav">
        {ITEMS.map((item) =>
          item.view === "today" ? (
            <TodayItem
              key={item.view}
              active={current === item.view}
              count={counts.today}
              hotkey={item.hotkey}
              onClick={() => onChange("today")}
            />
          ) : (
            <button
              key={item.view}
              type="button"
              className={classNames(
                "sidebar-item",
                current === item.view && "sidebar-item--active"
              )}
              onClick={() => onChange(item.view)}
            >
              <span className="sidebar-item-label">{item.label}</span>
              <span className="sidebar-item-count" aria-hidden />
              <span className="sidebar-item-hotkey">{item.hotkey}</span>
            </button>
          )
        )}
      </nav>
      <footer className="sidebar-footer">
        <div className="shortcut-row"><kbd>⌘</kbd><kbd>N</kbd><span>New task</span></div>
        <div className="shortcut-row"><kbd>⌘</kbd><kbd>S</kbd><span>Toggle sidebar</span></div>
        <div className="shortcut-row"><kbd>Enter</kbd><span>Edit</span></div>
        <div className="shortcut-row"><kbd>Space</kbd><span>Complete</span></div>
        <div className="shortcut-row"><kbd>S</kbd><span>Schedule…</span></div>
        <div className="shortcut-row"><kbd>D</kbd><span>Deadline…</span></div>
        <div className="shortcut-row"><kbd>⌘</kbd><kbd>↑↓</kbd><span>Reorder</span></div>
        {onSignOut && (
          <button type="button" className="sidebar-signout" onClick={onSignOut}>
            Sign out
          </button>
        )}
      </footer>
    </aside>
  );
}

function TodayItem({
  active,
  count,
  hotkey,
  onClick,
}: {
  active: boolean;
  count: number;
  hotkey: string;
  onClick: () => void;
}) {
  const { isOver, setNodeRef } = useDroppable({ id: TODAY_DROPPABLE_ID });
  return (
    <button
      ref={setNodeRef}
      type="button"
      className={classNames(
        "sidebar-item",
        "sidebar-item--today",
        active && "sidebar-item--active",
        isOver && "sidebar-item--drop-over"
      )}
      onClick={onClick}
    >
      <span className="sidebar-item-label">Today</span>
      <span className="sidebar-item-count">{count}</span>
      <span className="sidebar-item-hotkey">{hotkey}</span>
    </button>
  );
}
