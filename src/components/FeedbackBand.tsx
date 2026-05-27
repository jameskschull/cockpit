import type { Feedback } from "../types";
import { formatDate } from "../util";

interface Props {
  feedback: Feedback;
  onOpen: () => void;
}

const KIND_LABEL: Record<"strength" | "weakness" | "coaching", string> = {
  strength: "Strengths",
  weakness: "Weaknesses",
  coaching: "Coaching",
};

export function FeedbackBand({ feedback, onOpen }: Props) {
  const isSynthesis =
    !!feedback.synthesis ||
    !!feedback.specific_coaching ||
    feedback.strengths.length + feedback.weaknesses.length > 1;
  const kindLabel = isSynthesis ? "Synthesis" : "Spot feedback";
  const kindModifier = isSynthesis ? "synthesis" : "spot";

  return (
    <div className="feedback-band">
      <div className="feedback-band-header">
        <span className="feedback-band-date">{formatDate(feedback.observation_date)}</span>
        <span className={`feedback-band-kind feedback-band-kind--${kindModifier}`}>
          {kindLabel}
        </span>
        <button
          type="button"
          className="feedback-band-edit-btn"
          onClick={onOpen}
          title="Edit feedback"
          aria-label="Edit feedback"
        >
          ✎
        </button>
      </div>
      {feedback.synthesis && (
        <p className="feedback-band-synthesis">{feedback.synthesis}</p>
      )}
      <div className="feedback-band-columns">
        <ColumnList kind="strength" items={feedback.strengths.map((s) => s.text)} />
        <ColumnList kind="weakness" items={feedback.weaknesses.map((w) => w.text)} />
        <CoachingColumn text={feedback.specific_coaching} />
      </div>
    </div>
  );
}

function ColumnList({
  kind,
  items,
}: {
  kind: "strength" | "weakness";
  items: string[];
}) {
  if (items.length === 0) {
    return <div className={`feedback-column feedback-column--${kind} feedback-column--empty`} />;
  }
  return (
    <div className={`feedback-column feedback-column--${kind}`}>
      <div className="feedback-column-inline-label" aria-hidden="true">
        {KIND_LABEL[kind]}
      </div>
      <ul className="feedback-column-list">
        {items.map((text, i) => (
          <li key={i}>{text}</li>
        ))}
      </ul>
    </div>
  );
}

function CoachingColumn({ text }: { text: string | null }) {
  if (!text) {
    return (
      <div className="feedback-column feedback-column--coaching feedback-column--empty" />
    );
  }
  return (
    <div className="feedback-column feedback-column--coaching">
      <div className="feedback-column-inline-label" aria-hidden="true">
        {KIND_LABEL.coaching}
      </div>
      <p>{text}</p>
    </div>
  );
}
