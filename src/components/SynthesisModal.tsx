import { useEffect, useState } from "react";
import type { Feedback, UpsertFeedbackInput } from "../types";
import { todayIso } from "../util";

interface Props {
  teammateId: string;
  feedback: Feedback | null; // null = create
  onClose: () => void;
  onSave: (input: UpsertFeedbackInput) => Promise<void>;
  onDelete?: () => Promise<void>;
}

export function SynthesisModal({
  teammateId,
  feedback,
  onClose,
  onSave,
  onDelete,
}: Props) {
  const [date, setDate] = useState<string>(
    feedback?.observation_date ?? todayIso()
  );
  const [strengths, setStrengths] = useState<string[]>(() =>
    feedback ? feedback.strengths.map((s) => s.text) : [""]
  );
  const [weaknesses, setWeaknesses] = useState<string[]>(() =>
    feedback ? feedback.weaknesses.map((w) => w.text) : [""]
  );
  const [synthesis, setSynthesis] = useState<string>(feedback?.synthesis ?? "");
  const [coaching, setCoaching] = useState<string>(
    feedback?.specific_coaching ?? ""
  );
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

  const trimmedStrengths = strengths.map((s) => s.trim()).filter(Boolean);
  const trimmedWeaknesses = weaknesses.map((w) => w.trim()).filter(Boolean);
  const canSave =
    !saving && (trimmedStrengths.length > 0 || trimmedWeaknesses.length > 0);

  const submit = async () => {
    if (!canSave) return;
    setSaving(true);
    try {
      const input: UpsertFeedbackInput = {
        id: feedback?.id ?? null,
        teammate_id: teammateId,
        observation_date: date,
        synthesis: synthesis.trim() === "" ? null : synthesis.trim(),
        specific_coaching: coaching.trim() === "" ? null : coaching.trim(),
        strengths: trimmedStrengths,
        weaknesses: trimmedWeaknesses,
      };
      await onSave(input);
    } finally {
      setSaving(false);
    }
  };

  const editing = !!feedback;

  return (
    <div className="editor-backdrop" onClick={onClose}>
      <div
        className="editor"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-label={editing ? "Edit feedback" : "New synthesis"}
      >
        <div className="editor-header">
          <h2>{editing ? "Edit feedback" : "New synthesis"}</h2>
          <button type="button" className="editor-close" onClick={onClose}>
            ✕
          </button>
        </div>
        <form
          className="editor-body"
          onSubmit={(e) => {
            e.preventDefault();
            submit();
          }}
        >
          <label className="editor-field">
            <span>Observation date</span>
            <div className="editor-date-input">
              <input
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                required
              />
              <button
                type="button"
                onClick={() => setDate(todayIso())}
                className="editor-clear"
              >
                Today
              </button>
            </div>
          </label>

          <StringList
            label="Strengths"
            kind="strength"
            values={strengths}
            onChange={setStrengths}
          />

          <StringList
            label="Weaknesses"
            kind="weakness"
            values={weaknesses}
            onChange={setWeaknesses}
          />

          <label className="editor-field">
            <span>Synthesis</span>
            <textarea
              value={synthesis}
              onChange={(e) => setSynthesis(e.target.value)}
              rows={3}
              placeholder="Where this teammate stands right now."
            />
          </label>

          <label className="editor-field">
            <span>Specific coaching</span>
            <textarea
              value={coaching}
              onChange={(e) => setCoaching(e.target.value)}
              rows={3}
              placeholder="What you'll focus on next."
            />
          </label>

          {!canSave && !saving && (
            <div className="feedback-modal-hint">
              Add at least one strength or weakness to save.
            </div>
          )}

          <div className="editor-footer">
            {editing && onDelete ? (
              <button
                type="button"
                className="editor-delete"
                onClick={() => {
                  if (
                    window.confirm(
                      "Delete this feedback entry? This cannot be undone."
                    )
                  ) {
                    onDelete();
                  }
                }}
              >
                Delete
              </button>
            ) : (
              <span />
            )}
            <div className="editor-footer-right">
              <button type="button" onClick={onClose} className="editor-cancel">
                Cancel
              </button>
              <button
                type="submit"
                disabled={!canSave}
                className="editor-save"
              >
                {saving ? "Saving…" : "Save"}
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}

interface StringListProps {
  label: string;
  kind: "strength" | "weakness";
  values: string[];
  onChange: (next: string[]) => void;
}

function StringList({ label, kind, values, onChange }: StringListProps) {
  const update = (i: number, text: string) => {
    const next = values.slice();
    next[i] = text;
    onChange(next);
  };

  const add = () => {
    onChange([...values, ""]);
  };

  const remove = (i: number) => {
    const next = values.filter((_, idx) => idx !== i);
    onChange(next.length > 0 ? next : [""]);
  };

  return (
    <div className={`feedback-list feedback-list--${kind}`}>
      <div className="feedback-list-label">{label}</div>
      {values.map((value, i) => (
        <div className="feedback-list-row" key={i}>
          <input
            type="text"
            value={value}
            onChange={(e) => update(i, e.target.value)}
            placeholder={
              kind === "strength"
                ? "A strength observation…"
                : "A weakness observation…"
            }
          />
          <button
            type="button"
            className="feedback-list-remove"
            onClick={() => remove(i)}
            title="Remove row"
            aria-label="Remove row"
          >
            ✕
          </button>
        </div>
      ))}
      <button type="button" className="feedback-list-add" onClick={add}>
        + Add {kind}
      </button>
    </div>
  );
}
