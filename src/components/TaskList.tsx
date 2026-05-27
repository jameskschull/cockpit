import {
  SortableContext,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import type { Task, ViewName } from "../types";
import { TaskRow } from "./TaskRow";

interface Props {
  view: ViewName;
  tasks: Task[];
  selectedId: string | null;
  completingIds?: ReadonlySet<string>;
  onSelect: (id: string) => void;
  onComplete: (id: string) => void;
  onUncomplete: (id: string) => void;
  onDelete: (id: string) => void;
  onOpenPicker: (id: string, kind: "schedule" | "deadline", anchor: HTMLElement) => void;
  onEdit: (id: string) => void;
}

export function TaskList({
  view,
  tasks,
  selectedId,
  completingIds,
  onSelect,
  onComplete,
  onUncomplete,
  onDelete,
  onOpenPicker,
  onEdit,
}: Props) {
  // Drag is enabled wherever a row can be dropped on Today; reorder is enforced
  // by the App-level drag-end handler.
  const canDrag = view === "intake" || view === "today" || view === "deadlines";
  const empty = tasks.length === 0;

  return (
    <SortableContext items={tasks.map((t) => t.id)} strategy={verticalListSortingStrategy}>
      <div className="task-list">
        {tasks.map((task) => (
          <SortableRow
            key={task.id}
            task={task}
            view={view}
            canDrag={canDrag}
            selected={task.id === selectedId}
            isCompleting={completingIds?.has(task.id)}
            onSelect={() => onSelect(task.id)}
            onComplete={() => onComplete(task.id)}
            onUncomplete={() => onUncomplete(task.id)}
            onDelete={() => onDelete(task.id)}
            onOpenPicker={(kind, anchor) => onOpenPicker(task.id, kind, anchor)}
            onEdit={() => onEdit(task.id)}
          />
        ))}
        {empty && <div className="empty">{emptyLabel(view)}</div>}
      </div>
    </SortableContext>
  );
}

function SortableRow(props: {
  task: Task;
  view: ViewName;
  canDrag: boolean;
  selected: boolean;
  isCompleting?: boolean;
  onSelect: () => void;
  onComplete: () => void;
  onUncomplete: () => void;
  onDelete: () => void;
  onOpenPicker: (kind: "schedule" | "deadline", anchor: HTMLElement) => void;
  onEdit: () => void;
}) {
  const { task, canDrag, isCompleting, ...rest } = props;
  const sortable = useSortable({ id: task.id, disabled: !canDrag || !!isCompleting });
  const style = {
    transform: CSS.Transform.toString(sortable.transform),
    transition: sortable.transition,
  };
  return (
    <TaskRow
      task={task}
      view={props.view}
      selected={props.selected}
      canDrag={canDrag}
      isCompleting={isCompleting}
      dragHandleProps={
        canDrag
          ? {
              attributes: sortable.attributes,
              listeners: sortable.listeners,
              style,
              setNodeRef: sortable.setNodeRef,
              setActivatorNodeRef: sortable.setActivatorNodeRef,
              isDragging: sortable.isDragging,
            }
          : undefined
      }
      onSelect={rest.onSelect}
      onComplete={rest.onComplete}
      onUncomplete={rest.onUncomplete}
      onDelete={rest.onDelete}
      onOpenPicker={rest.onOpenPicker}
      onEdit={rest.onEdit}
    />
  );
}

function emptyLabel(view: ViewName): string {
  switch (view) {
    case "priorities":
      return "";
    case "intake":
      return "No tasks yet. Add one above.";
    case "today":
      return "Nothing scheduled for today. Hit T on an Intake task to plan it, or drag one onto Today.";
    case "deadlines":
      return "No deadlines set.";
    case "completed":
      return "Nothing completed yet.";
    case "feedback":
      return "";
  }
}
