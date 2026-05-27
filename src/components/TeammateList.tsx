import { useMemo, useState } from "react";
import type { Teammate } from "../types";
import { api } from "../api";
import { classNames } from "../util";

interface Props {
  teammates: Teammate[];
  includeArchived: boolean;
  onToggleArchived: (value: boolean) => void;
  onSelect: (id: string) => void;
  onChanged: () => Promise<void>;
}

export function TeammateList({
  teammates,
  includeArchived,
  onToggleArchived,
  onSelect,
  onChanged,
}: Props) {
  const [name, setName] = useState("");
  const [creating, setCreating] = useState(false);

  const hasArchived = useMemo(
    () => teammates.some((t) => t.archived_at !== null),
    [teammates]
  );

  const visible = useMemo(() => {
    const filtered = includeArchived
      ? teammates
      : teammates.filter((t) => t.archived_at === null);
    // Sorted alphabetically by name (matches `api.listTeammates` ordering).
    return filtered;
  }, [teammates, includeArchived]);

  const submit = async () => {
    const t = name.trim();
    if (!t || creating) return;
    setCreating(true);
    try {
      const created = await api.createTeammate(t);
      setName("");
      await onChanged();
      onSelect(created.id);
    } finally {
      setCreating(false);
    }
  };

  const handleArchive = async (teammate: Teammate) => {
    if (teammate.archived_at) {
      await api.unarchiveTeammate(teammate.id);
    } else {
      await api.archiveTeammate(teammate.id);
    }
    await onChanged();
  };

  const handleDelete = async (teammate: Teammate) => {
    const ok = window.confirm(
      `Delete ${teammate.name} and all their feedback? This cannot be undone.`
    );
    if (!ok) return;
    await api.deleteTeammate(teammate.id);
    await onChanged();
  };

  return (
    <div className="teammate-list">
      <form
        className="new-task-bar"
        onSubmit={(e) => {
          e.preventDefault();
          submit();
        }}
      >
        <input
          className="new-task-input"
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Add a teammate…"
          autoComplete="off"
          autoCorrect="off"
          spellCheck={false}
        />
        <button type="submit" className="new-task-button" disabled={!name.trim() || creating}>
          Add
        </button>
      </form>

      {hasArchived && (
        <label className="teammate-archived-toggle">
          <input
            type="checkbox"
            checked={includeArchived}
            onChange={(e) => onToggleArchived(e.target.checked)}
          />
          <span>Show archived</span>
        </label>
      )}

      <div className="teammate-rows">
        {visible.map((teammate) => (
          <TeammateRow
            key={teammate.id}
            teammate={teammate}
            onSelect={() => onSelect(teammate.id)}
            onArchive={() => handleArchive(teammate)}
            onDelete={() => handleDelete(teammate)}
          />
        ))}
        {visible.length === 0 && (
          <div className="empty">
            {teammates.length === 0
              ? "No teammates yet. Add one above."
              : "No active teammates."}
          </div>
        )}
      </div>
    </div>
  );
}

interface RowProps {
  teammate: Teammate;
  onSelect: () => void;
  onArchive: () => void;
  onDelete: () => void;
}

function TeammateRow({ teammate, onSelect, onArchive, onDelete }: RowProps) {
  const archived = teammate.archived_at !== null;
  return (
    <div
      className={classNames(
        "teammate-row",
        archived && "teammate-row--archived"
      )}
      onClick={onSelect}
    >
      <div className="teammate-row-main">
        <div className="teammate-row-name">{teammate.name}</div>
        {archived && <span className="teammate-row-badge">Archived</span>}
      </div>
      <div className="teammate-row-actions" onClick={(e) => e.stopPropagation()}>
        <button
          type="button"
          className="task-action"
          onClick={onArchive}
          title={archived ? "Unarchive" : "Archive"}
        >
          {archived ? "Unarchive" : "Archive"}
        </button>
        <button
          type="button"
          className="task-action task-action--danger"
          onClick={onDelete}
          title="Delete teammate"
        >
          ✕
        </button>
      </div>
    </div>
  );
}
