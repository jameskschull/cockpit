import { useCallback, useEffect, useState } from "react";
import type { Teammate } from "../types";
import { api } from "../api";
import { TeammateList } from "./TeammateList";
import { TeammatePage } from "./TeammatePage";

export function FeedbackView() {
  const [teammates, setTeammates] = useState<Teammate[]>([]);
  const [includeArchived, setIncludeArchived] = useState(false);
  const [selectedTeammateId, setSelectedTeammateId] = useState<string | null>(null);
  const [loaded, setLoaded] = useState(false);

  const refresh = useCallback(async () => {
    const list = await api.listTeammates(true);
    setTeammates(list);
  }, []);

  useEffect(() => {
    (async () => {
      await refresh();
      setLoaded(true);
    })();
  }, [refresh]);

  const selectedTeammate = selectedTeammateId
    ? teammates.find((t) => t.id === selectedTeammateId) ?? null
    : null;

  // If the selected teammate disappears (e.g. deleted), clear selection.
  useEffect(() => {
    if (selectedTeammateId && !selectedTeammate) {
      setSelectedTeammateId(null);
    }
  }, [selectedTeammateId, selectedTeammate]);

  if (!loaded) return null;

  if (selectedTeammate) {
    return (
      <TeammatePage
        teammate={selectedTeammate}
        onBack={() => setSelectedTeammateId(null)}
        onTeammateChanged={refresh}
        onTeammateDeleted={() => {
          setSelectedTeammateId(null);
          refresh();
        }}
      />
    );
  }

  return (
    <>
      <header className="main-header">
        <div className="main-header-row">
          <h1>Feedback</h1>
        </div>
        <p className="subtitle">Track developmental feedback for your teammates.</p>
      </header>
      <TeammateList
        teammates={teammates}
        includeArchived={includeArchived}
        onToggleArchived={setIncludeArchived}
        onSelect={setSelectedTeammateId}
        onChanged={refresh}
      />
    </>
  );
}
