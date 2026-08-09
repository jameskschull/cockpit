import { useEffect, useRef, useState } from "react";

interface Props {
  /** Current saved value; null when nothing has been recorded yet. */
  about: string | null;
  onSave: (about: string) => Promise<void>;
}

/**
 * Free-text personal details for a teammate — partner's name, where they live,
 * kids, interests. Read far more often than written, so it renders as plain
 * text and only becomes an editor on click.
 */
export function PersonalDetails({ about, onSave }: Props) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(about ?? "");
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);

  useEffect(() => {
    setDraft(about ?? "");
  }, [about]);

  useEffect(() => {
    if (!editing) return;
    const el = textareaRef.current;
    if (!el) return;
    el.focus();
    // Caret to the end rather than selecting all: edits here are usually
    // appending a new fact, not replacing everything.
    el.setSelectionRange(el.value.length, el.value.length);
    autoSize(el);
  }, [editing]);

  const commit = async () => {
    setEditing(false);
    if (draft.trim() === (about ?? "").trim()) return;
    await onSave(draft);
  };

  const cancel = () => {
    setDraft(about ?? "");
    setEditing(false);
  };

  if (editing) {
    return (
      <section className="personal-details personal-details--editing">
        <div className="personal-details-label">Personal details</div>
        <textarea
          ref={textareaRef}
          className="personal-details-input"
          value={draft}
          onChange={(e) => {
            setDraft(e.target.value);
            autoSize(e.currentTarget);
          }}
          onBlur={() => void commit()}
          onKeyDown={(e) => {
            if (e.key === "Escape") {
              e.preventDefault();
              // TeammatePage's window-level Esc handler runs before its
              // is-the-user-typing check, so it would navigate back to the
              // teammate list on top of cancelling this edit.
              e.stopPropagation();
              cancel();
            } else if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
              e.preventDefault();
              void commit();
            }
          }}
          placeholder="Partner, kids, where they live, what they're into…"
          spellCheck
        />
      </section>
    );
  }

  return (
    <section className="personal-details">
      <div className="personal-details-label">Personal details</div>
      <button
        type="button"
        className="personal-details-body"
        onClick={() => setEditing(true)}
        title="Edit personal details"
      >
        {about ? (
          about
        ) : (
          <span className="personal-details-empty">
            Add personal details — partner, kids, where they live…
          </span>
        )}
      </button>
    </section>
  );
}

function autoSize(el: HTMLTextAreaElement) {
  el.style.height = "auto";
  el.style.height = `${el.scrollHeight}px`;
}
