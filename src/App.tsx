import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { Task, ViewName } from "./types";
import { api } from "./api";
import { todayIso } from "./util";
import { Sidebar } from "./components/Sidebar";
import { TaskList } from "./components/TaskList";
import { TaskEditor } from "./components/TaskEditor";
import { NewTaskBar } from "./components/NewTaskBar";

export default function App() {
  const [view, setView] = useState<ViewName>("intake");
  const [incomplete, setIncomplete] = useState<Task[]>([]);
  const [completed, setCompleted] = useState<Task[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [loaded, setLoaded] = useState(false);
  const newTaskInputRef = useRef<HTMLInputElement | null>(null);

  const refreshIncomplete = useCallback(async () => {
    const tasks = await api.listIncomplete();
    setIncomplete(tasks);
  }, []);

  const refreshCompleted = useCallback(async () => {
    const tasks = await api.listCompleted();
    setCompleted(tasks);
  }, []);

  useEffect(() => {
    (async () => {
      try {
        const settings = await api.getSettings();
        const v = settings.last_view as ViewName;
        if (v === "intake" || v === "today" || v === "deadlines" || v === "completed") {
          setView(v);
        }
      } catch {
        // ignore
      }
      await refreshIncomplete();
      await refreshCompleted();
      setLoaded(true);
    })();
  }, [refreshIncomplete, refreshCompleted]);

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
        .sort((a, b) => (a.deadline! < b.deadline! ? -1 : a.deadline! > b.deadline! ? 1 : a.priority_rank - b.priority_rank));
    return completed;
  }, [view, incomplete, completed, today]);

  // Ensure selection stays valid when the visible list changes.
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

  const handleReorder = useCallback(
    async (
      movedId: string,
      beforeId: string | null,
      afterId: string | null
    ) => {
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

  const focusNewTask = useCallback(() => {
    newTaskInputRef.current?.focus();
  }, []);

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

      if (typing) return;

      if (e.key === "1") {
        setView("intake");
        return;
      }
      if (e.key === "2") {
        setView("today");
        return;
      }
      if (e.key === "3") {
        setView("deadlines");
        return;
      }
      if (e.key === "4") {
        setView("completed");
        return;
      }

      if (!selectedTask) return;

      if (e.key === "Enter") {
        e.preventDefault();
        setEditingId(selectedTask.id);
        return;
      }
      if (e.key === " ") {
        e.preventDefault();
        if (selectedTask.completed_at) {
          handleUncomplete(selectedTask.id);
        } else {
          handleComplete(selectedTask.id);
        }
        return;
      }
      if (e.key === "t" || e.key === "T") {
        if (view !== "completed" && view !== "deadlines") {
          e.preventDefault();
          handleScheduleToday(selectedTask.id);
        }
        return;
      }
      if (e.key === "Delete" || e.key === "Backspace") {
        e.preventDefault();
        handleDelete(selectedTask.id);
        return;
      }
      if (e.key === "ArrowDown" || e.key === "ArrowUp") {
        e.preventDefault();
        const idx = visibleTasks.findIndex((t) => t.id === selectedTask.id);
        if (idx < 0) return;
        const reorderMod = (e.metaKey || e.altKey) && view !== "deadlines" && view !== "completed";
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
          handleReorder(selectedTask.id, beforeId, afterId);
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
    handleReorder,
    handleScheduleToday,
    focusNewTask,
  ]);

  const counts = useMemo(
    () => ({
      intake: incomplete.length,
      today: incomplete.filter((t) => t.scheduled_date === today).length,
      deadlines: incomplete.filter((t) => t.deadline !== null).length,
      completed: completed.length,
    }),
    [incomplete, completed, today]
  );

  const editingTask = useMemo(() => {
    if (!editingId) return null;
    return (
      incomplete.find((t) => t.id === editingId) ??
      completed.find((t) => t.id === editingId) ??
      null
    );
  }, [editingId, incomplete, completed]);

  return (
    <div className="app">
      <Sidebar current={view} counts={counts} onChange={setView} />
      <main className="main">
        <header className="main-header">
          <h1>{headingFor(view)}</h1>
          <p className="subtitle">{subtitleFor(view)}</p>
        </header>
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
          onScheduleToday={handleScheduleToday}
          onReorder={handleReorder}
          onEdit={setEditingId}
        />
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
    </div>
  );
}

function headingFor(v: ViewName): string {
  switch (v) {
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
