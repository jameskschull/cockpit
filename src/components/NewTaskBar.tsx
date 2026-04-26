import { useState, type RefObject } from "react";
import type { ViewName } from "../types";

interface Props {
  view: ViewName;
  inputRef: RefObject<HTMLInputElement>;
  onCreate: (title: string) => Promise<void>;
}

export function NewTaskBar({ view, inputRef, onCreate }: Props) {
  const [title, setTitle] = useState("");
  const placeholder =
    view === "today"
      ? "Add a task (won't auto-schedule for today — use T)…"
      : "Add a task…";

  const submit = async () => {
    const t = title.trim();
    if (!t) return;
    setTitle("");
    await onCreate(t);
  };

  return (
    <form
      className="new-task-bar"
      onSubmit={(e) => {
        e.preventDefault();
        submit();
      }}
    >
      <input
        ref={inputRef}
        className="new-task-input"
        type="text"
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        placeholder={placeholder}
        autoComplete="off"
        autoCorrect="off"
        spellCheck
      />
      <button type="submit" className="new-task-button" disabled={!title.trim()}>
        Add
      </button>
    </form>
  );
}
