import { useRef, useState, type CSSProperties } from "react";
import { Calendar } from "./Calendar";
import { formatDate } from "../util";

interface Props {
  onSubmit: (fromName: string, what: string, expectedDate: string | null) => Promise<void>;
}

export function WaitingComposer({ onSubmit }: Props) {
  const [fromName, setFromName] = useState("");
  const [what, setWhat] = useState("");
  const [date, setDate] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [pickerAnchor, setPickerAnchor] = useState<DOMRect | null>(null);
  const fromRef = useRef<HTMLInputElement | null>(null);

  const submit = async () => {
    const f = fromName.trim();
    const w = what.trim();
    if (!f || !w || submitting) return;
    setSubmitting(true);
    try {
      await onSubmit(f, w, date);
      setFromName("");
      setWhat("");
      setDate(null);
      fromRef.current?.focus();
    } finally {
      setSubmitting(false);
    }
  };

  const dateStyle: CSSProperties = date ? { color: "var(--text)" } : {};

  return (
    <div className="waiting-composer">
      <form
        className="waiting-composer-form"
        onSubmit={(e) => {
          e.preventDefault();
          submit();
        }}
      >
        <input
          ref={fromRef}
          className="waiting-composer-from"
          type="text"
          value={fromName}
          onChange={(e) => setFromName(e.target.value)}
          placeholder="Person"
          autoComplete="off"
          autoCorrect="off"
        />
        <input
          className="waiting-composer-what"
          type="text"
          value={what}
          onChange={(e) => setWhat(e.target.value)}
          placeholder="What did they commit to you?"
          autoComplete="off"
          autoCorrect="off"
          spellCheck
        />
        <button
          type="button"
          className="waiting-date-pill"
          onClick={(e) => setPickerAnchor(e.currentTarget.getBoundingClientRect())}
          style={dateStyle}
          title="Expected by"
        >
          {date ? formatDate(date) : "No date"}
        </button>
        <button
          type="submit"
          className="new-task-button"
          disabled={!fromName.trim() || !what.trim() || submitting}
        >
          Add
        </button>
      </form>
      {pickerAnchor && (
        <Calendar
          value={date}
          anchor={pickerAnchor}
          onPick={(iso) => {
            setDate(iso);
            setPickerAnchor(null);
          }}
          onClose={() => setPickerAnchor(null)}
        />
      )}
    </div>
  );
}
