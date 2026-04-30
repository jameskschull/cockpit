import { useState, type RefObject } from "react";

interface Props {
  inputRef: RefObject<HTMLInputElement>;
  onCreate: (title: string) => Promise<void>;
}

export function NewTaskBar({ inputRef, onCreate }: Props) {
  const [title, setTitle] = useState("");
  const placeholder = "Add a task…";

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
