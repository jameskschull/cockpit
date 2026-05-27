import {
  forwardRef,
  useImperativeHandle,
  useRef,
  useState,
  type CSSProperties,
} from "react";
import type { FeedbackKind } from "../types";
import { Calendar } from "./Calendar";
import { classNames, formatDate, todayIso } from "../util";

interface Props {
  onSubmit: (kind: FeedbackKind, text: string, observationDate: string) => Promise<void>;
}

export interface FeedbackComposerHandle {
  focus: (kind: FeedbackKind) => void;
}

export const FeedbackComposer = forwardRef<FeedbackComposerHandle, Props>(
  function FeedbackComposer({ onSubmit }, ref) {
    const [text, setText] = useState("");
    const [kind, setKind] = useState<FeedbackKind>("strength");
    const [date, setDate] = useState<string>(todayIso());
    const [submitting, setSubmitting] = useState(false);
    const [pickerAnchor, setPickerAnchor] = useState<DOMRect | null>(null);
    const inputRef = useRef<HTMLInputElement | null>(null);

    useImperativeHandle(ref, () => ({
      focus: (primeKind: FeedbackKind) => {
        setKind(primeKind);
        inputRef.current?.focus();
      },
    }));

    const submit = async () => {
      const t = text.trim();
      if (!t || submitting) return;
      setSubmitting(true);
      try {
        await onSubmit(kind, t, date);
        setText("");
      } finally {
        setSubmitting(false);
      }
    };

    const openDatePicker = (e: React.MouseEvent<HTMLButtonElement>) => {
      setPickerAnchor(e.currentTarget.getBoundingClientRect());
    };

    const dateStyle: CSSProperties =
      date === todayIso() ? {} : { color: "var(--text)" };

    return (
      <div className="feedback-composer">
        <div className="feedback-composer-kinds" role="tablist" aria-label="Feedback kind">
          <button
            type="button"
            role="tab"
            aria-selected={kind === "strength"}
            className={classNames(
              "feedback-kind-btn",
              "feedback-kind-btn--strength",
              kind === "strength" && "feedback-kind-btn--active"
            )}
            onClick={() => {
              setKind("strength");
              inputRef.current?.focus();
            }}
          >
            + Strength
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={kind === "weakness"}
            className={classNames(
              "feedback-kind-btn",
              "feedback-kind-btn--weakness",
              kind === "weakness" && "feedback-kind-btn--active"
            )}
            onClick={() => {
              setKind("weakness");
              inputRef.current?.focus();
            }}
          >
            + Weakness
          </button>
        </div>
        <form
          className="feedback-composer-form"
          onSubmit={(e) => {
            e.preventDefault();
            submit();
          }}
        >
          <input
            ref={inputRef}
            className="feedback-composer-input"
            type="text"
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder={
              kind === "strength"
                ? "Add a strength observation…"
                : "Add a weakness observation…"
            }
            autoComplete="off"
            autoCorrect="off"
            spellCheck
          />
          <button
            type="button"
            className="feedback-date-pill"
            onClick={openDatePicker}
            style={dateStyle}
            title="Observation date"
          >
            {date === todayIso() ? "Today" : formatDate(date)}
          </button>
          <button
            type="submit"
            className="new-task-button"
            disabled={!text.trim() || submitting}
          >
            Save
          </button>
        </form>
        {pickerAnchor && (
          <Calendar
            value={date}
            anchor={pickerAnchor}
            onPick={(iso) => {
              setDate(iso);
              setPickerAnchor(null);
              inputRef.current?.focus();
            }}
            onClose={() => setPickerAnchor(null)}
          />
        )}
      </div>
    );
  }
);
