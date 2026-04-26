import {
  DndContext,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  arrayMove,
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
  onSelect: (id: string) => void;
  onComplete: (id: string) => void;
  onUncomplete: (id: string) => void;
  onDelete: (id: string) => void;
  onScheduleToday: (id: string) => void;
  onReorder: (movedId: string, beforeId: string | null, afterId: string | null) => void;
  onEdit: (id: string) => void;
}

export function TaskList({
  view,
  tasks,
  selectedId,
  onSelect,
  onComplete,
  onUncomplete,
  onDelete,
  onScheduleToday,
  onReorder,
  onEdit,
}: Props) {
  const canReorder = view === "intake" || view === "today";
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } })
  );

  const empty = tasks.length === 0;

  const onDragEnd = (e: DragEndEvent) => {
    const { active, over } = e;
    if (!over || active.id === over.id) return;
    const oldIdx = tasks.findIndex((t) => t.id === active.id);
    const newIdx = tasks.findIndex((t) => t.id === over.id);
    if (oldIdx < 0 || newIdx < 0) return;
    const reordered = arrayMove(tasks, oldIdx, newIdx);
    const pos = reordered.findIndex((t) => t.id === active.id);
    const beforeId = pos > 0 ? reordered[pos - 1].id : null;
    const afterId = pos < reordered.length - 1 ? reordered[pos + 1].id : null;
    onReorder(String(active.id), beforeId, afterId);
  };

  const body = (
    <div className="task-list">
      {tasks.map((task) => (
        <SortableRow
          key={task.id}
          task={task}
          view={view}
          canReorder={canReorder}
          selected={task.id === selectedId}
          onSelect={() => onSelect(task.id)}
          onComplete={() => onComplete(task.id)}
          onUncomplete={() => onUncomplete(task.id)}
          onDelete={() => onDelete(task.id)}
          onScheduleToday={() => onScheduleToday(task.id)}
          onEdit={() => onEdit(task.id)}
        />
      ))}
      {empty && <div className="empty">{emptyLabel(view)}</div>}
    </div>
  );

  if (!canReorder) return body;

  return (
    <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd}>
      <SortableContext items={tasks.map((t) => t.id)} strategy={verticalListSortingStrategy}>
        {body}
      </SortableContext>
    </DndContext>
  );
}

function SortableRow(props: {
  task: Task;
  view: ViewName;
  canReorder: boolean;
  selected: boolean;
  onSelect: () => void;
  onComplete: () => void;
  onUncomplete: () => void;
  onDelete: () => void;
  onScheduleToday: () => void;
  onEdit: () => void;
}) {
  const { task, canReorder, ...rest } = props;
  const sortable = useSortable({ id: task.id, disabled: !canReorder });
  const style = {
    transform: CSS.Transform.toString(sortable.transform),
    transition: sortable.transition,
  };
  return (
    <TaskRow
      task={task}
      view={props.view}
      selected={props.selected}
      dragHandleProps={
        canReorder
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
      onScheduleToday={rest.onScheduleToday}
      onEdit={rest.onEdit}
    />
  );
}

function emptyLabel(view: ViewName): string {
  switch (view) {
    case "intake":
      return "No tasks yet. Add one above.";
    case "today":
      return "Nothing scheduled for today. Hit T on an Intake task to plan it.";
    case "deadlines":
      return "No deadlines set.";
    case "completed":
      return "Nothing completed yet.";
  }
}
