import { useMemo, useState } from "react";
import type { Priority } from "../types";
import { classNames, weekRangeLabel } from "../util";

interface Props {
  priority: Priority | null;
  onOpenPriorities: () => void;
}

function stripHtml(html: string): string {
  return html
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/p>/gi, "\n")
    .replace(/<\/div>/gi, "\n")
    .replace(/<[^>]+>/g, "")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&nbsp;/g, " ");
}

export function PrioritiesBanner({ priority, onOpenPriorities }: Props) {
  const [expanded, setExpanded] = useState(false);

  const preview = useMemo(() => {
    if (!priority) return "";
    const plain = stripHtml(priority.text);
    const firstLine = plain.split("\n").find((l) => l.trim().length > 0) ?? "";
    return firstLine.length > 80 ? firstLine.slice(0, 80) + "…" : firstLine;
  }, [priority]);

  if (!priority || !stripHtml(priority.text).trim()) return null;

  return (
    <div
      className={classNames(
        "priorities-banner",
        expanded && "priorities-banner--expanded"
      )}
    >
      <button
        type="button"
        className="priorities-banner-toggle"
        onClick={() => setExpanded((e) => !e)}
        aria-expanded={expanded}
      >
        <span className="priorities-banner-label">
          Week of {weekRangeLabel(priority.week_start)}
        </span>
        {!expanded && <span className="priorities-banner-preview">{preview}</span>}
        <span className="priorities-banner-chevron">{expanded ? "▾" : "▸"}</span>
      </button>
      {expanded && (
        <div className="priorities-banner-body">
          <div
            className="priorities-banner-text"
            dangerouslySetInnerHTML={{ __html: priority.text }}
          />
          <button
            type="button"
            className="priorities-banner-edit"
            onClick={onOpenPriorities}
          >
            Edit in Priorities
          </button>
        </div>
      )}
    </div>
  );
}
