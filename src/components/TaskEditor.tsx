import { useEffect, useState } from "react";
import type { Task, UpdateTaskInput } from "../types";
import { todayIso } from "../util";

interface Props {
  task: Task;
  onClose: () => void;
  onSave: (patch: UpdateTaskInput) => Promise<void>;
  onDelete: () => Promise<void>;
}

export function TaskEditor({ task, onClose, onSave, onDelete }: Props) {
  const [title, setTitle] = useState(task.title);
  const [notes, setNotes] = useState(task.notes ?? "");
  const [deadline, setDeadline] = useState(task.deadline ?? "");
  const [scheduled, setScheduled] = useState(task.scheduled_date ?? "");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        onClose();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const submit = async () => {
    if (!title.trim() || saving) return;
    setSaving(true);
    try {
      await onSave({
        title: title.trim(),
        notes: notes.trim() === "" ? null : notes,
        deadline: deadline || null,
        scheduled_date: scheduled || null,
      });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="editor-backdrop" onClick={onClose}>
      <div
        className="editor"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-label="Edit task"
      >
        <div className="editor-header">
          <h2>Edit task</h2>
          <button type="button" className="editor-close" onClick={onClose}>✕</button>
        </div>
        <form
          className="editor-body"
          onSubmit={(e) => {
            e.preventDefault();
            submit();
          }}
        >
          <label className="editor-field">
            <span>Title</span>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              autoFocus
              required
            />
          </label>
          <label className="editor-field">
            <span>Notes</span>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={4}
            />
          </label>
          <div className="editor-row">
            <label className="editor-field">
              <span>Deadline</span>
              <div className="editor-date-input">
                <input
                  type="date"
                  value={deadline}
                  onChange={(e) => setDeadline(e.target.value)}
                />
                {deadline && (
                  <button type="button" onClick={() => setDeadline("")} className="editor-clear">
                    Clear
                  </button>
                )}
              </div>
              <span className="editor-hint">The hard "must be done by" date.</span>
            </label>
            <label className="editor-field">
              <span>Scheduled</span>
              <div className="editor-date-input">
                <input
                  type="date"
                  value={scheduled}
                  onChange={(e) => setScheduled(e.target.value)}
                />
                <button
                  type="button"
                  onClick={() => setScheduled(todayIso())}
                  className="editor-clear"
                >
                  Today
                </button>
                {scheduled && (
                  <button type="button" onClick={() => setScheduled("")} className="editor-clear">
                    Clear
                  </button>
                )}
              </div>
              <span className="editor-hint">The day you intend to work on this.</span>
            </label>
          </div>
          <div className="editor-footer">
            <button
              type="button"
              className="editor-delete"
              onClick={() => {
                if (window.confirm(`Delete "${task.title}"? This cannot be undone.`)) {
                  onDelete();
                }
              }}
            >
              Delete
            </button>
            <div className="editor-footer-right">
              <button type="button" onClick={onClose} className="editor-cancel">
                Cancel
              </button>
              <button type="submit" disabled={!title.trim() || saving} className="editor-save">
                {saving ? "Saving…" : "Save"}
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}
