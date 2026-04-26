import type { ViewName } from "../types";
import { classNames } from "../util";

interface Props {
  current: ViewName;
  counts: Record<ViewName, number>;
  onChange: (v: ViewName) => void;
}

const ITEMS: { view: ViewName; label: string; hotkey: string }[] = [
  { view: "intake", label: "Intake", hotkey: "1" },
  { view: "today", label: "Today", hotkey: "2" },
  { view: "deadlines", label: "Deadlines", hotkey: "3" },
  { view: "completed", label: "Completed", hotkey: "4" },
];

export function Sidebar({ current, counts, onChange }: Props) {
  return (
    <aside className="sidebar">
      <div className="sidebar-brand">Todo</div>
      <nav className="sidebar-nav">
        {ITEMS.map((item) => (
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
            <span className="sidebar-item-count">{counts[item.view]}</span>
            <span className="sidebar-item-hotkey">{item.hotkey}</span>
          </button>
        ))}
      </nav>
      <footer className="sidebar-footer">
        <div className="shortcut-row"><kbd>⌘</kbd><kbd>N</kbd><span>New task</span></div>
        <div className="shortcut-row"><kbd>Enter</kbd><span>Edit</span></div>
        <div className="shortcut-row"><kbd>Space</kbd><span>Complete</span></div>
        <div className="shortcut-row"><kbd>T</kbd><span>Schedule today</span></div>
        <div className="shortcut-row"><kbd>⌘</kbd><kbd>↑↓</kbd><span>Reorder</span></div>
      </footer>
    </aside>
  );
}
