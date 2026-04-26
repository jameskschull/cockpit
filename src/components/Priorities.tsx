import { useEffect, useMemo, useRef, useState, type KeyboardEvent } from "react";
import type { Priority } from "../types";
import { classNames, currentWorkWeekMonday, weekRangeLabel } from "../util";

interface Props {
  priorities: Priority[];
  showBanner: boolean;
  onSave: (weekStart: string, text: string) => Promise<void>;
  onToggleBanner: (value: boolean) => Promise<void>;
}

export function Priorities({ priorities, showBanner, onSave, onToggleBanner }: Props) {
  const thisWeek = currentWorkWeekMonday();

  const byWeek = useMemo(() => {
    const m = new Map<string, Priority>();
    for (const p of priorities) m.set(p.week_start, p);
    return m;
  }, [priorities]);

  const past = useMemo(
    () => priorities.filter((p) => p.week_start < thisWeek),
    [priorities, thisWeek]
  );

  return (
    <div className="priorities">
      <PriorityCard
        weekStart={thisWeek}
        initialText={byWeek.get(thisWeek)?.text ?? ""}
        label="This week"
        highlight
        onSave={onSave}
      />
      {past.length > 0 && (
        <div className="priorities-past">
          <h2 className="priorities-section">Earlier weeks</h2>
          {past.map((p) => (
            <PriorityCard
              key={p.week_start}
              weekStart={p.week_start}
              initialText={p.text}
              collapsible
              defaultCollapsed
              onSave={onSave}
            />
          ))}
        </div>
      )}
      <footer className="priorities-settings">
        <label className="priorities-setting-row">
          <input
            type="checkbox"
            checked={showBanner}
            onChange={(e) => onToggleBanner(e.target.checked)}
          />
          <span>Show priorities banner on other views</span>
        </label>
      </footer>
    </div>
  );
}

interface CardProps {
  weekStart: string;
  initialText: string;
  label?: string;
  highlight?: boolean;
  collapsible?: boolean;
  defaultCollapsed?: boolean;
  onSave: (weekStart: string, text: string) => Promise<void>;
}

function PriorityCard({
  weekStart,
  initialText,
  label,
  highlight,
  collapsible,
  defaultCollapsed,
  onSave,
}: CardProps) {
  const [collapsed, setCollapsed] = useState(!!defaultCollapsed);
  const [savedAt, setSavedAt] = useState<number | null>(null);
  const [pending, setPending] = useState(false);
  const lastSavedRef = useRef(initialText);

  useEffect(() => {
    lastSavedRef.current = initialText;
  }, [initialText, weekStart]);

  const handleSave = async (html: string) => {
    if (html === lastSavedRef.current) return;
    setPending(true);
    try {
      await onSave(weekStart, html);
      lastSavedRef.current = html;
      setSavedAt(Date.now());
    } finally {
      setPending(false);
    }
  };

  const range = weekRangeLabel(weekStart);

  return (
    <section className={classNames("priority-card", highlight && "priority-card--highlight")}>
      <header
        className={classNames(
          "priority-card-header",
          collapsible && "priority-card-header--clickable"
        )}
        onClick={collapsible ? () => setCollapsed((c) => !c) : undefined}
      >
        <div className="priority-card-title">
          {label && <span className="priority-card-label">{label}</span>}
          <span className="priority-card-range">{range}</span>
        </div>
        <div className="priority-card-status">
          {pending ? (
            <span className="priority-card-saved">Saving…</span>
          ) : savedAt ? (
            <span className="priority-card-saved">Saved</span>
          ) : null}
          {collapsible && (
            <span className="priority-card-chevron">{collapsed ? "▸" : "▾"}</span>
          )}
        </div>
      </header>
      {!collapsed && (
        <RichTextEditor key={weekStart} initial={initialText} onSave={handleSave} />
      )}
    </section>
  );
}

const HAS_HTML_TAG = /<\w+/;

function plainTextToHtml(text: string): string {
  if (!text) return "";
  if (HAS_HTML_TAG.test(text)) return text;
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/\n/g, "<br>");
}

interface RichTextEditorProps {
  initial: string;
  onSave: (html: string) => Promise<void>;
}

function RichTextEditor({ initial, onSave }: RichTextEditorProps) {
  const ref = useRef<HTMLDivElement>(null);

  // Set the initial DOM only once per mount (the `key` on this component
  // forces remount when the week changes). React must not control innerHTML.
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.innerHTML = plainTextToHtml(initial);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const exec = (cmd: string) => {
    ref.current?.focus();
    document.execCommand(cmd);
  };

  const onBlur = async () => {
    const el = ref.current;
    if (!el) return;
    let html = el.innerHTML;
    // Browsers leave a stray <br> after deleting all content; treat as empty.
    if (html === "<br>" || html === "<div><br></div>") html = "";
    await onSave(html);
  };

  const onKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    const mod = e.metaKey || e.ctrlKey;
    if (!mod) return;
    if (!e.shiftKey && (e.key === "b" || e.key === "B")) {
      e.preventDefault();
      exec("bold");
    } else if (!e.shiftKey && (e.key === "u" || e.key === "U")) {
      e.preventDefault();
      exec("underline");
    } else if (e.shiftKey && (e.key === "s" || e.key === "S")) {
      e.preventDefault();
      exec("strikeThrough");
    }
  };

  return (
    <div className="priority-editor-wrap">
      <div
        className="priority-toolbar"
        onMouseDown={(e) => e.preventDefault()}
      >
        <button type="button" className="priority-toolbar-btn" onClick={() => exec("bold")} title="Bold (⌘B)">
          <b>B</b>
        </button>
        <button type="button" className="priority-toolbar-btn" onClick={() => exec("underline")} title="Underline (⌘U)">
          <u>U</u>
        </button>
        <button type="button" className="priority-toolbar-btn" onClick={() => exec("strikeThrough")} title="Strikethrough (⌘⇧S)">
          <s>S</s>
        </button>
      </div>
      <div
        ref={ref}
        className="priority-card-editor"
        contentEditable
        suppressContentEditableWarning
        onBlur={onBlur}
        onKeyDown={onKeyDown}
        data-placeholder="Top priorities for this week…"
      />
    </div>
  );
}
