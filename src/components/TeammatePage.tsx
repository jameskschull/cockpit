import { useCallback, useEffect, useRef, useState } from "react";
import type { Feedback, FeedbackKind, Teammate, UpsertFeedbackInput } from "../types";
import { api } from "../api";
import { FeedbackBand } from "./FeedbackBand";
import { FeedbackComposer, type FeedbackComposerHandle } from "./FeedbackComposer";
import { SynthesisModal } from "./SynthesisModal";

interface Props {
  teammate: Teammate;
  onBack: () => void;
  onTeammateChanged: () => Promise<void>;
  onTeammateDeleted: () => void;
}

type ModalState =
  | { kind: "closed" }
  | { kind: "new" }
  | { kind: "edit"; feedback: Feedback };

export function TeammatePage({
  teammate,
  onBack,
  onTeammateChanged,
  onTeammateDeleted,
}: Props) {
  const [feedback, setFeedback] = useState<Feedback[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [modal, setModal] = useState<ModalState>({ kind: "closed" });
  const [menuOpen, setMenuOpen] = useState(false);
  const [editingName, setEditingName] = useState(false);
  const [nameDraft, setNameDraft] = useState(teammate.name);
  const composerRef = useRef<FeedbackComposerHandle | null>(null);
  const menuRef = useRef<HTMLDivElement | null>(null);
  const menuBtnRef = useRef<HTMLButtonElement | null>(null);
  const nameInputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    setNameDraft(teammate.name);
  }, [teammate.name]);

  useEffect(() => {
    if (editingName) {
      requestAnimationFrame(() => {
        const el = nameInputRef.current;
        if (!el) return;
        el.focus();
        el.select();
      });
    }
  }, [editingName]);

  const commitName = useCallback(async () => {
    const next = nameDraft.trim();
    if (!next || next === teammate.name) {
      setNameDraft(teammate.name);
      setEditingName(false);
      return;
    }
    setEditingName(false);
    await api.renameTeammate(teammate.id, next);
    await onTeammateChanged();
  }, [nameDraft, teammate.id, teammate.name, onTeammateChanged]);

  const cancelName = useCallback(() => {
    setNameDraft(teammate.name);
    setEditingName(false);
  }, [teammate.name]);

  const refresh = useCallback(async () => {
    const list = await api.listFeedback(teammate.id);
    setFeedback(list);
  }, [teammate.id]);

  useEffect(() => {
    (async () => {
      setLoaded(false);
      await refresh();
      setLoaded(true);
    })();
  }, [refresh]);

  const handleQuickAdd = useCallback(
    async (kind: FeedbackKind, text: string, observationDate: string) => {
      await api.addQuickFeedback(teammate.id, kind, text, observationDate);
      await refresh();
    },
    [teammate.id, refresh]
  );

  const handleArchiveToggle = async () => {
    setMenuOpen(false);
    if (teammate.archived_at) {
      await api.unarchiveTeammate(teammate.id);
    } else {
      await api.archiveTeammate(teammate.id);
    }
    await onTeammateChanged();
  };

  const handleDeleteTeammate = async () => {
    setMenuOpen(false);
    const ok = window.confirm(
      `Delete ${teammate.name} and all their feedback? This cannot be undone.`
    );
    if (!ok) return;
    await api.deleteTeammate(teammate.id);
    onTeammateDeleted();
  };

  const handleSaveFeedback = useCallback(
    async (input: UpsertFeedbackInput) => {
      await api.upsertFeedback(input);
      setModal({ kind: "closed" });
      await refresh();
    },
    [refresh]
  );

  const handleDeleteFeedback = useCallback(
    async (id: string) => {
      await api.deleteFeedback(id);
      setModal({ kind: "closed" });
      await refresh();
    },
    [refresh]
  );

  // Keyboard shortcuts scoped to the teammate page.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      const typing =
        !!target &&
        (target.tagName === "INPUT" ||
          target.tagName === "TEXTAREA" ||
          target.isContentEditable);
      if (e.metaKey || e.ctrlKey || e.altKey) return;

      if (e.key === "Escape") {
        if (menuOpen) {
          e.preventDefault();
          setMenuOpen(false);
          return;
        }
        if (modal.kind === "closed") {
          e.preventDefault();
          onBack();
        }
        return;
      }

      if (typing) return;
      if (modal.kind !== "closed") return;

      if (e.key === "s" || e.key === "S") {
        e.preventDefault();
        composerRef.current?.focus("strength");
      } else if (e.key === "w" || e.key === "W") {
        e.preventDefault();
        composerRef.current?.focus("weakness");
      } else if (e.key === "n" || e.key === "N") {
        e.preventDefault();
        setModal({ kind: "new" });
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [modal.kind, onBack, menuOpen]);

  // Click-outside dismissal for the kebab menu.
  useEffect(() => {
    if (!menuOpen) return;
    const onDown = (e: MouseEvent) => {
      const target = e.target as Node;
      if (menuRef.current?.contains(target)) return;
      if (menuBtnRef.current?.contains(target)) return;
      setMenuOpen(false);
    };
    document.addEventListener("mousedown", onDown, true);
    return () => document.removeEventListener("mousedown", onDown, true);
  }, [menuOpen]);

  const archived = teammate.archived_at !== null;

  // Year of an observation_date string ("YYYY-MM-DD").
  const yearOf = (iso: string) => iso.slice(0, 4);

  return (
    <div className="teammate-page">
      <header className="teammate-page-header">
        <button
          type="button"
          className="teammate-back"
          onClick={onBack}
          title="Back to teammates (Esc)"
        >
          ← Teammates
        </button>
        <h2 className="teammate-page-name">
          {editingName ? (
            <input
              ref={nameInputRef}
              type="text"
              className="teammate-page-name-input"
              value={nameDraft}
              onChange={(e) => setNameDraft(e.target.value)}
              onBlur={() => void commitName()}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  void commitName();
                } else if (e.key === "Escape") {
                  e.preventDefault();
                  cancelName();
                }
              }}
              autoComplete="off"
              spellCheck
            />
          ) : (
            <button
              type="button"
              className="teammate-page-name-btn"
              onClick={() => setEditingName(true)}
              title="Rename"
            >
              {teammate.name}
            </button>
          )}
          {archived && <span className="teammate-row-badge">Archived</span>}
        </h2>
        <div className="teammate-page-actions">
          <button
            type="button"
            className="feedback-synthesis-btn"
            onClick={() => setModal({ kind: "new" })}
            title="New synthesis (N)"
          >
            ✎ Synthesis
          </button>
          <div className="teammate-menu-wrap">
            <button
              ref={menuBtnRef}
              type="button"
              className="teammate-menu-btn"
              onClick={() => setMenuOpen((v) => !v)}
              aria-haspopup="menu"
              aria-expanded={menuOpen}
              aria-label="More actions"
              title="More actions"
            >
              ⋯
            </button>
            {menuOpen && (
              <div
                ref={menuRef}
                className="teammate-menu"
                role="menu"
              >
                <button
                  type="button"
                  className="teammate-menu-item"
                  role="menuitem"
                  onClick={handleArchiveToggle}
                >
                  {archived ? "Unarchive" : "Archive"}
                </button>
                <button
                  type="button"
                  className="teammate-menu-item teammate-menu-item--danger"
                  role="menuitem"
                  onClick={handleDeleteTeammate}
                >
                  Delete
                </button>
              </div>
            )}
          </div>
        </div>
      </header>

      <FeedbackComposer ref={composerRef} onSubmit={handleQuickAdd} />

      {feedback.length > 0 && (
        <div className="feedback-grid-header">
          <div className="feedback-grid-header-cell feedback-grid-header-cell--strength">
            Strengths
          </div>
          <div className="feedback-grid-header-cell feedback-grid-header-cell--weakness">
            Weaknesses
          </div>
          <div className="feedback-grid-header-cell feedback-grid-header-cell--coaching">
            Coaching
          </div>
        </div>
      )}

      <div className="feedback-grid">
        {loaded && feedback.length === 0 && (
          <div className="empty">
            No feedback yet. Capture an observation above, or hit ✎ Synthesis for a full entry.
          </div>
        )}
        {feedback.map((f, i) => {
          const currentYear = yearOf(f.observation_date);
          const prevYear = i === 0 ? null : yearOf(feedback[i - 1].observation_date);
          const showDivider = currentYear !== prevYear;
          return (
            <div key={f.id} className="feedback-band-wrap">
              {showDivider && (
                <div className="feedback-year-divider" aria-hidden="true">
                  <span>{currentYear}</span>
                </div>
              )}
              <FeedbackBand
                feedback={f}
                onOpen={() => setModal({ kind: "edit", feedback: f })}
              />
            </div>
          );
        })}
      </div>

      {modal.kind !== "closed" && (
        <SynthesisModal
          teammateId={teammate.id}
          feedback={modal.kind === "edit" ? modal.feedback : null}
          onClose={() => setModal({ kind: "closed" })}
          onSave={handleSaveFeedback}
          onDelete={
            modal.kind === "edit"
              ? () => handleDeleteFeedback(modal.feedback.id)
              : undefined
          }
        />
      )}
    </div>
  );
}
