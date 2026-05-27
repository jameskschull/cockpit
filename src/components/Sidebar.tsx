import { useDroppable } from "@dnd-kit/core";
import type { ViewName } from "../types";
import { classNames } from "../util";

interface Props {
  current: ViewName;
  counts: Record<ViewName, number>;
  onChange: (v: ViewName) => void;
  onSignOut?: () => void;
}

interface NavItem {
  view: ViewName;
  label: string;
  hotkey: string;
}

const PRIORITIES: NavItem = { view: "priorities", label: "Priorities", hotkey: "1" };
const TASK_ITEMS: NavItem[] = [
  { view: "intake", label: "Intake", hotkey: "2" },
  { view: "today", label: "Today", hotkey: "3" },
  { view: "completed", label: "Completed", hotkey: "4" },
];
const FEEDBACK: NavItem = { view: "feedback", label: "Feedback", hotkey: "5" };

export const TODAY_DROPPABLE_ID = "drop-today";

export function Sidebar({ current, counts, onChange, onSignOut }: Props) {
  const renderItem = (item: NavItem, nested: boolean, sectionStart: boolean) => {
    if (item.view === "today") {
      return (
        <TodayItem
          key={item.view}
          active={current === item.view}
          count={counts.today}
          hotkey={item.hotkey}
          nested={nested}
          onClick={() => onChange("today")}
        />
      );
    }
    return (
      <button
        key={item.view}
        type="button"
        className={classNames(
          "sidebar-item",
          nested && "sidebar-item--nested",
          sectionStart && "sidebar-item--section-start",
          current === item.view && "sidebar-item--active"
        )}
        onClick={() => onChange(item.view)}
      >
        <span className="sidebar-item-label">{item.label}</span>
        <span className="sidebar-item-count" aria-hidden />
        <span className="sidebar-item-hotkey">{item.hotkey}</span>
      </button>
    );
  };

  return (
    <aside className="sidebar">
      <div className="sidebar-brand">Cockpit</div>
      <nav className="sidebar-nav">
        {renderItem(PRIORITIES, false, false)}
        <div className="sidebar-group-label">Tasks</div>
        {TASK_ITEMS.map((item) => renderItem(item, true, false))}
        {renderItem(FEEDBACK, false, true)}
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
  nested,
  onClick,
}: {
  active: boolean;
  count: number;
  hotkey: string;
  nested: boolean;
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
        nested && "sidebar-item--nested",
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
