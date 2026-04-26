import type { CSSProperties } from "react";
import type { DraggableAttributes, DraggableSyntheticListeners } from "@dnd-kit/core";
import type { Task, ViewName } from "../types";
import { classNames, formatDate, isOverdue, todayIso } from "../util";

interface Props {
  task: Task;
  view: ViewName;
  selected: boolean;
  canDrag: boolean;
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
  onOpenPicker: (kind: "schedule" | "deadline", anchor: HTMLElement) => void;
  onEdit: () => void;
}

export function TaskRow({
  task,
  selected,
  canDrag,
  dragHandleProps,
  onSelect,
  onComplete,
  onUncomplete,
  onDelete,
  onOpenPicker,
  onEdit,
}: Props) {
  const overdue = isOverdue(task.deadline) && !task.completed_at;
  const scheduledToday = task.scheduled_date === todayIso();
  const hasSchedule = !!task.scheduled_date;
  const hasDeadline = !!task.deadline;

  const scheduleLabel = hasSchedule
    ? scheduledToday
      ? "Scheduled Today →"
      : `Scheduled ${formatDate(task.scheduled_date)} →`
    : "Schedule";
  const deadlineLabel = hasDeadline ? `Due ${formatDate(task.deadline)} →` : "Deadline";

  return (
    <div
      ref={(el) => dragHandleProps?.setNodeRef?.(el)}
      data-task-id={task.id}
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
      <label className="task-checkbox" onClick={(e) => e.stopPropagation()}>
        <input
          type="checkbox"
          checked={!!task.completed_at}
          onChange={() => (task.completed_at ? onUncomplete() : onComplete())}
        />
        <span className="task-checkbox-box" aria-hidden />
      </label>
      <div className="task-main">
        <div className="task-title">{task.title}</div>
        {task.notes && (
          <div className="task-meta">
            <span className="task-notes-indicator" title={task.notes}>note</span>
          </div>
        )}
      </div>
      <div className="task-actions" onClick={(e) => e.stopPropagation()}>
        {!task.completed_at && (
          <>
            <DateAction
              label={scheduleLabel}
              value={task.scheduled_date}
              kind="schedule"
              hint="Schedule (S)"
              onOpen={onOpenPicker}
            />
            <DateAction
              label={deadlineLabel}
              value={task.deadline}
              kind="deadline"
              hint="Deadline (D)"
              overdue={overdue}
              onOpen={onOpenPicker}
            />
          </>
        )}
        <button
          type="button"
          className="task-action task-action-edit"
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

interface DateActionProps {
  label: string;
  value: string | null;
  kind: "schedule" | "deadline";
  hint: string;
  overdue?: boolean;
  onOpen: (kind: "schedule" | "deadline", anchor: HTMLElement) => void;
}

function DateAction({ label, value, kind, hint, overdue, onOpen }: DateActionProps) {
  const set = !!value;
  return (
    <button
      type="button"
      className={classNames(
        "task-action",
        "task-action--date",
        `task-action--${kind}`,
        set && "task-action--set",
        overdue && set && "task-action--overdue"
      )}
      data-state={set ? "set" : "unset"}
      data-kind={kind}
      title={hint}
      onClick={(e) => onOpen(kind, e.currentTarget)}
    >
      {label}
    </button>
  );
}
