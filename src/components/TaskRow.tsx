import type { CSSProperties } from "react";
import type { DraggableAttributes, DraggableSyntheticListeners } from "@dnd-kit/core";
import type { Task, ViewName } from "../types";
import { classNames, formatDate, isOverdue, todayIso } from "../util";

interface Props {
  task: Task;
  view: ViewName;
  selected: boolean;
  dragHandleProps?: {
    attributes?: DraggableAttributes;
    listeners?: DraggableSyntheticListeners;
    style?: CSSProperties;
    setNodeRef?: (el: HTMLElement | null) => void;
    setActivatorNodeRef?: (el: HTMLElement | null) => void;
    isDragging?: boolean;
  };
  onSelect: () => void;
  onComplete: () => void;
  onUncomplete: () => void;
  onDelete: () => void;
  onScheduleToday: () => void;
  onEdit: () => void;
}

export function TaskRow({
  task,
  view,
  selected,
  dragHandleProps,
  onSelect,
  onComplete,
  onUncomplete,
  onDelete,
  onScheduleToday,
  onEdit,
}: Props) {
  const overdue = isOverdue(task.deadline) && !task.completed_at;
  const scheduledToday = task.scheduled_date === todayIso();
  const canDrag = view === "intake" || view === "today";

  return (
    <div
      ref={(el) => dragHandleProps?.setNodeRef?.(el)}
      className={classNames(
        "task-row",
        selected && "task-row--selected",
        !!task.completed_at && "task-row--completed",
        overdue && "task-row--overdue",
        dragHandleProps?.isDragging && "task-row--dragging"
      )}
      style={dragHandleProps?.style}
      onClick={onSelect}
      onDoubleClick={onEdit}
    >
      {canDrag && (
        <button
          type="button"
          className="task-drag"
          aria-label="Drag to reorder"
          ref={(el) => dragHandleProps?.setActivatorNodeRef?.(el as HTMLElement | null)}
          {...(dragHandleProps?.attributes || {})}
          {...(dragHandleProps?.listeners || {})}
          onClick={(e) => e.stopPropagation()}
        >
          ⋮⋮
        </button>
      )}
      <label
        className="task-checkbox"
        onClick={(e) => e.stopPropagation()}
      >
        <input
          type="checkbox"
          checked={!!task.completed_at}
          onChange={() => (task.completed_at ? onUncomplete() : onComplete())}
        />
        <span className="task-checkbox-box" aria-hidden />
      </label>
      <div className="task-main">
        <div className="task-title">{task.title}</div>
        <div className="task-meta">
          {task.deadline && (
            <span
              className={classNames(
                "task-chip",
                "task-chip--deadline",
                overdue && "task-chip--overdue"
              )}
              title={overdue ? "Overdue" : "Deadline"}
            >
              Due {formatDate(task.deadline)}
            </span>
          )}
          {task.scheduled_date && (
            <span
              className={classNames(
                "task-chip",
                "task-chip--scheduled",
                scheduledToday && "task-chip--today"
              )}
              title="Scheduled date"
            >
              {scheduledToday ? "Today" : `Scheduled ${formatDate(task.scheduled_date)}`}
            </span>
          )}
          {task.notes && <span className="task-notes-indicator" title={task.notes}>note</span>}
        </div>
      </div>
      <div className="task-actions" onClick={(e) => e.stopPropagation()}>
        {!task.completed_at && !scheduledToday && view !== "deadlines" && (
          <button
            type="button"
            className="task-action"
            onClick={onScheduleToday}
            title="Schedule for today (T)"
          >
            Today
          </button>
        )}
        <button
          type="button"
          className="task-action"
          onClick={onEdit}
          title="Edit (Enter)"
        >
          Edit
        </button>
        <button
          type="button"
          className="task-action task-action--danger"
          onClick={onDelete}
          title="Delete"
        >
          ✕
        </button>
      </div>
    </div>
  );
}
