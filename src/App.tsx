import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  DndContext,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import { arrayMove } from "@dnd-kit/sortable";
import type { Priority, Task, ViewName } from "./types";
import { api } from "./api";
import { currentWorkWeekMonday, todayIso } from "./util";
import { Sidebar, TODAY_DROPPABLE_ID } from "./components/Sidebar";
import { TaskList } from "./components/TaskList";
import { TaskEditor } from "./components/TaskEditor";
import { NewTaskBar } from "./components/NewTaskBar";
import { Priorities } from "./components/Priorities";
import { PrioritiesBanner } from "./components/PrioritiesBanner";
import { Calendar } from "./components/Calendar";

interface PickerState {
  taskId: string;
  kind: "schedule" | "deadline";
  anchor: DOMRect;
}

const KNOWN_VIEWS: ViewName[] = ["priorities", "intake", "today", "deadlines", "completed"];

export default function App() {
  const [view, setView] = useState<ViewName>("intake");
  const [incomplete, setIncomplete] = useState<Task[]>([]);
  const [completed, setCompleted] = useState<Task[]>([]);
  const [priorities, setPriorities] = useState<Priority[]>([]);
  const [showBanner, setShowBanner] = useState(true);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [picker, setPicker] = useState<PickerState | null>(null);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [loaded, setLoaded] = useState(false);
  const newTaskInputRef = useRef<HTMLInputElement | null>(null);

  const refreshIncomplete = useCallback(async () => {
    setIncomplete(await api.listIncomplete());
  }, []);

  const refreshCompleted = useCallback(async () => {
    setCompleted(await api.listCompleted());
  }, []);

  const refreshPriorities = useCallback(async () => {
    setPriorities(await api.listPriorities());
  }, []);

  useEffect(() => {
    (async () => {
      try {
        const settings = await api.getSettings();
        if (KNOWN_VIEWS.includes(settings.last_view as ViewName)) {
          setView(settings.last_view as ViewName);
        }
        setShowBanner(settings.show_priorities_banner);
      } catch {
        // ignore
      }
      await Promise.all([refreshIncomplete(), refreshCompleted(), refreshPriorities()]);
      setLoaded(true);
    })();
  }, [refreshIncomplete, refreshCompleted, refreshPriorities]);

  useEffect(() => {
    if (!loaded) return;
    api.setLastView(view).catch(() => {});
  }, [view, loaded]);

  const today = todayIso();

  const visibleTasks = useMemo(() => {
    if (view === "intake") return incomplete;
    if (view === "today") return incomplete.filter((t) => t.scheduled_date === today);
    if (view === "deadlines")
      return incomplete
        .filter((t) => t.deadline !== null)
        .slice()
        .sort((a, b) =>
          a.deadline! < b.deadline! ? -1 : a.deadline! > b.deadline! ? 1 : a.priority_rank - b.priority_rank
        );
    if (view === "completed") return completed;
    return [];
  }, [view, incomplete, completed, today]);

  useEffect(() => {
    if (selectedId && !visibleTasks.some((t) => t.id === selectedId)) {
      setSelectedId(visibleTasks[0]?.id ?? null);
    } else if (!selectedId && visibleTasks.length > 0) {
      setSelectedId(visibleTasks[0].id);
    }
  }, [visibleTasks, selectedId]);

  const selectedTask = useMemo(
    () => visibleTasks.find((t) => t.id === selectedId) ?? null,
    [visibleTasks, selectedId]
  );

  const refreshAll = useCallback(async () => {
    await Promise.all([refreshIncomplete(), refreshCompleted()]);
  }, [refreshIncomplete, refreshCompleted]);

  const handleCreate = useCallback(
    async (title: string) => {
      const t = title.trim();
      if (!t) return;
      const task = await api.createTask({ title: t });
      await refreshIncomplete();
      setSelectedId(task.id);
    },
    [refreshIncomplete]
  );

  const handleComplete = useCallback(
    async (id: string) => {
      await api.completeTask(id);
      await refreshAll();
    },
    [refreshAll]
  );

  const handleUncomplete = useCallback(
    async (id: string) => {
      await api.uncompleteTask(id);
      await refreshAll();
    },
    [refreshAll]
  );

  const handleDelete = useCallback(
    async (id: string) => {
      const task = incomplete.find((t) => t.id === id) ?? completed.find((t) => t.id === id);
      if (!task) return;
      const ok = window.confirm(`Delete "${task.title}"? This cannot be undone.`);
      if (!ok) return;
      await api.deleteTask(id);
      if (selectedId === id) setSelectedId(null);
      if (editingId === id) setEditingId(null);
      await refreshAll();
    },
    [incomplete, completed, selectedId, editingId, refreshAll]
  );

  const handleScheduleToday = useCallback(
    async (id: string) => {
      await api.scheduleForToday(id);
      await refreshIncomplete();
    },
    [refreshIncomplete]
  );

  const handleReorderInList = useCallback(
    async (movedId: string, beforeId: string | null, afterId: string | null) => {
      await api.reorderTask(movedId, beforeId, afterId);
      await refreshIncomplete();
    },
    [refreshIncomplete]
  );

  const handleUpdate = useCallback(
    async (id: string, patch: Parameters<typeof api.updateTask>[1]) => {
      await api.updateTask(id, patch);
      await refreshAll();
    },
    [refreshAll]
  );

  const handlePrioritySave = useCallback(
    async (weekStart: string, text: string) => {
      await api.upsertPriority(weekStart, text);
      await refreshPriorities();
    },
    [refreshPriorities]
  );

  const handleToggleBanner = useCallback(
    async (value: boolean) => {
      setShowBanner(value);
      await api.setShowPrioritiesBanner(value);
    },
    []
  );

  const focusNewTask = useCallback(() => {
    newTaskInputRef.current?.focus();
  }, []);

  const handleOpenPicker = useCallback(
    (taskId: string, kind: "schedule" | "deadline", anchor: HTMLElement) => {
      setPicker((cur) => {
        if (cur && cur.taskId === taskId && cur.kind === kind) return null;
        return { taskId, kind, anchor: anchor.getBoundingClientRect() };
      });
    },
    []
  );

  const handleClosePicker = useCallback(() => setPicker(null), []);

  const handlePickDate = useCallback(
    async (iso: string) => {
      const p = picker;
      if (!p) return;
      setPicker(null);
      const patch =
        p.kind === "schedule" ? { scheduled_date: iso } : { deadline: iso };
      await api.updateTask(p.taskId, patch);
      await refreshAll();
    },
    [picker, refreshAll]
  );

  const triggerRowDatePicker = useCallback(
    (taskId: string, kind: "schedule" | "deadline") => {
      const btn = document.querySelector<HTMLElement>(
        `.task-row[data-task-id="${taskId}"] [data-kind="${kind}"]`
      );
      if (!btn) return;
      handleOpenPicker(taskId, kind, btn);
    },
    [handleOpenPicker]
  );

  // Keyboard shortcuts.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      const typing =
        !!target &&
        (target.tagName === "INPUT" ||
          target.tagName === "TEXTAREA" ||
          target.isContentEditable);

      if ((e.metaKey || e.ctrlKey) && (e.key === "n" || e.key === "N")) {
        e.preventDefault();
        focusNewTask();
        return;
      }
      if (
        (e.metaKey || e.ctrlKey) &&
        !e.shiftKey &&
        !e.altKey &&
        (e.key === "s" || e.key === "S")
      ) {
        e.preventDefault();
        setSidebarOpen((prev) => !prev);
        return;
      }

      if (typing) return;

      const bareKey = !e.metaKey && !e.ctrlKey && !e.altKey;

      if (bareKey) {
        if (e.key === "1") { setView("priorities"); return; }
        if (e.key === "2") { setView("intake"); return; }
        if (e.key === "3") { setView("today"); return; }
        if (e.key === "4") { setView("deadlines"); return; }
        if (e.key === "5") { setView("completed"); return; }
      }

      if (!selectedTask) return;

      if (bareKey && e.key === "Enter") {
        e.preventDefault();
        setEditingId(selectedTask.id);
        return;
      }
      if (bareKey && e.key === " ") {
        e.preventDefault();
        if (selectedTask.completed_at) {
          handleUncomplete(selectedTask.id);
        } else {
          handleComplete(selectedTask.id);
        }
        return;
      }
      if (bareKey && (e.key === "s" || e.key === "S")) {
        if (!selectedTask.completed_at) {
          e.preventDefault();
          triggerRowDatePicker(selectedTask.id, "schedule");
        }
        return;
      }
      if (bareKey && (e.key === "d" || e.key === "D")) {
        if (!selectedTask.completed_at) {
          e.preventDefault();
          triggerRowDatePicker(selectedTask.id, "deadline");
        }
        return;
      }
      if (bareKey && (e.key === "Delete" || e.key === "Backspace")) {
        e.preventDefault();
        handleDelete(selectedTask.id);
        return;
      }
      if (e.key === "ArrowDown" || e.key === "ArrowUp") {
        e.preventDefault();
        const idx = visibleTasks.findIndex((t) => t.id === selectedTask.id);
        if (idx < 0) return;
        const reorderMod =
          (e.metaKey || e.altKey) && (view === "intake" || view === "today");
        if (reorderMod) {
          const targetIdx = e.key === "ArrowDown" ? idx + 1 : idx - 1;
          if (targetIdx < 0 || targetIdx >= visibleTasks.length) return;
          let beforeId: string | null;
          let afterId: string | null;
          if (e.key === "ArrowDown") {
            beforeId = visibleTasks[targetIdx].id;
            afterId = visibleTasks[targetIdx + 1]?.id ?? null;
          } else {
            beforeId = visibleTasks[targetIdx - 1]?.id ?? null;
            afterId = visibleTasks[targetIdx].id;
          }
          handleReorderInList(selectedTask.id, beforeId, afterId);
        } else {
          const next = e.key === "ArrowDown" ? idx + 1 : idx - 1;
          if (next >= 0 && next < visibleTasks.length) {
            setSelectedId(visibleTasks[next].id);
          }
        }
        return;
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [
    view,
    selectedTask,
    visibleTasks,
    handleComplete,
    handleUncomplete,
    handleDelete,
    handleReorderInList,
    handleScheduleToday,
    triggerRowDatePicker,
    focusNewTask,
  ]);

  const counts = useMemo(
    () => ({
      priorities: priorities.length,
      intake: incomplete.length,
      today: incomplete.filter((t) => t.scheduled_date === today).length,
      deadlines: incomplete.filter((t) => t.deadline !== null).length,
      completed: completed.length,
    }),
    [incomplete, completed, priorities, today]
  );

  const currentWeekPriority = useMemo(() => {
    const monday = currentWorkWeekMonday();
    return priorities.find((p) => p.week_start === monday) ?? null;
  }, [priorities]);

  const editingTask = useMemo(() => {
    if (!editingId) return null;
    return (
      incomplete.find((t) => t.id === editingId) ??
      completed.find((t) => t.id === editingId) ??
      null
    );
  }, [editingId, incomplete, completed]);

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 4 } }));

  const onDragEnd = useCallback(
    (e: DragEndEvent) => {
      const { active, over } = e;
      if (!over) return;
      const movedId = String(active.id);

      if (over.id === TODAY_DROPPABLE_ID) {
        handleScheduleToday(movedId).catch(() => {});
        return;
      }

      // Reorder in the active list — only meaningful in Intake/Today.
      if (view !== "intake" && view !== "today") return;
      if (active.id === over.id) return;
      const oldIdx = visibleTasks.findIndex((t) => t.id === active.id);
      const newIdx = visibleTasks.findIndex((t) => t.id === over.id);
      if (oldIdx < 0 || newIdx < 0) return;
      const reordered = arrayMove(visibleTasks, oldIdx, newIdx);
      const pos = reordered.findIndex((t) => t.id === active.id);
      const beforeId = pos > 0 ? reordered[pos - 1].id : null;
      const afterId = pos < reordered.length - 1 ? reordered[pos + 1].id : null;
      handleReorderInList(movedId, beforeId, afterId).catch(() => {});
    },
    [view, visibleTasks, handleScheduleToday, handleReorderInList]
  );

  const isPriorities = view === "priorities";

  return (
    <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd}>
      <div className={`app${sidebarOpen ? "" : " app--sidebar-hidden"}`}>
        <Sidebar current={view} counts={counts} onChange={setView} />
        <main className="main">
          {!isPriorities && showBanner && (
            <PrioritiesBanner
              priority={currentWeekPriority}
              onOpenPriorities={() => setView("priorities")}
            />
          )}
          <header className="main-header">
            <h1>{headingFor(view)}</h1>
            <p className="subtitle">{subtitleFor(view)}</p>
          </header>
          {isPriorities ? (
            <Priorities
              priorities={priorities}
              showBanner={showBanner}
              onSave={handlePrioritySave}
              onToggleBanner={handleToggleBanner}
            />
          ) : (
            <>
              {(view === "intake" || view === "today") && (
                <NewTaskBar inputRef={newTaskInputRef} onCreate={handleCreate} view={view} />
              )}
              <TaskList
                view={view}
                tasks={visibleTasks}
                selectedId={selectedId}
                onSelect={setSelectedId}
                onComplete={handleComplete}
                onUncomplete={handleUncomplete}
                onDelete={handleDelete}
                onOpenPicker={handleOpenPicker}
                onEdit={setEditingId}
              />
            </>
          )}
        </main>
        {editingTask && (
          <TaskEditor
            task={editingTask}
            onClose={() => setEditingId(null)}
            onSave={async (patch) => {
              await handleUpdate(editingTask.id, patch);
              setEditingId(null);
            }}
            onDelete={async () => {
              setEditingId(null);
              await handleDelete(editingTask.id);
            }}
          />
        )}
        {picker && (
          <Calendar
            value={
              picker.kind === "schedule"
                ? incomplete.find((t) => t.id === picker.taskId)?.scheduled_date ?? null
                : incomplete.find((t) => t.id === picker.taskId)?.deadline ?? null
            }
            anchor={picker.anchor}
            onPick={handlePickDate}
            onClose={handleClosePicker}
          />
        )}
      </div>
    </DndContext>
  );
}

function headingFor(v: ViewName): string {
  switch (v) {
    case "priorities":
      return "Priorities";
    case "intake":
      return "Intake";
    case "today":
      return "Today";
    case "deadlines":
      return "Deadlines";
    case "completed":
      return "Completed";
  }
}

function subtitleFor(v: ViewName): string {
  switch (v) {
    case "priorities":
      return "Your weekly outcomes — written each Monday, revisited all week.";
    case "intake":
      return "Every incomplete task, in priority order.";
    case "today":
      return "Scheduled for today. Reorder here and it updates global priority.";
    case "deadlines":
      return "Tasks with a hard deadline, soonest first.";
    case "completed":
      return "Most recently finished first.";
  }
}
