import { useEffect, useMemo, useRef, useState, type CSSProperties } from "react";
import { classNames } from "../util";

interface Props {
  value: string | null;
  anchor: DOMRect;
  onPick: (iso: string) => void;
  onClose: () => void;
}

const WEEKDAYS = ["Mo", "Tu", "We", "Th", "Fr", "Sa", "Su"];

function isoForDate(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(
    d.getDate()
  ).padStart(2, "0")}`;
}

function dateFromIso(iso: string) {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(y, m - 1, d);
}

export function Calendar({ value, anchor, onPick, onClose }: Props) {
  const valueDate = useMemo(() => (value ? dateFromIso(value) : null), [value]);
  const [{ year, month }, setMonth] = useState(() => {
    if (value) {
      const d = dateFromIso(value);
      return { year: d.getFullYear(), month: d.getMonth() };
    }
    const t = new Date();
    return { year: t.getFullYear(), month: t.getMonth() };
  });

  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const onDown = (e: MouseEvent) => {
      if (!ref.current) return;
      if (!ref.current.contains(e.target as Node)) onClose();
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        onClose();
      }
    };
    document.addEventListener("mousedown", onDown, true);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown, true);
      document.removeEventListener("keydown", onKey);
    };
  }, [onClose]);

  const firstDow = new Date(year, month, 1).getDay(); // 0=Sun..6=Sat
  const startOffset = firstDow === 0 ? 6 : firstDow - 1;
  const daysInMonth = new Date(year, month + 1, 0).getDate();

  const cells: (Date | null)[] = [];
  for (let i = 0; i < startOffset; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(new Date(year, month, d));
  while (cells.length % 7 !== 0) cells.push(null);

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const monthLabel = new Date(year, month, 1).toLocaleDateString(undefined, {
    month: "long",
    year: "numeric",
  });

  const goPrev = () =>
    setMonth(({ year, month }) =>
      month === 0 ? { year: year - 1, month: 11 } : { year, month: month - 1 }
    );
  const goNext = () =>
    setMonth(({ year, month }) =>
      month === 11 ? { year: year + 1, month: 0 } : { year, month: month + 1 }
    );
  const goToday = () => {
    const t = new Date();
    setMonth({ year: t.getFullYear(), month: t.getMonth() });
    onPick(isoForDate(t));
  };

  const POPOVER_W = 252;
  const POPOVER_H = 300;
  const top =
    anchor.bottom + 4 + POPOVER_H > window.innerHeight
      ? anchor.top - POPOVER_H - 4
      : anchor.bottom + 4;
  const left = Math.min(anchor.left, window.innerWidth - POPOVER_W - 8);
  const style: CSSProperties = {
    position: "fixed",
    top: Math.max(top, 8),
    left: Math.max(left, 8),
    width: POPOVER_W,
  };

  return (
    <div ref={ref} className="datepicker" style={style} role="dialog" aria-label="Pick a date">
      <div className="datepicker-header">
        <button type="button" className="datepicker-nav" onClick={goPrev} aria-label="Previous month">
          ‹
        </button>
        <span className="datepicker-month">{monthLabel}</span>
        <button type="button" className="datepicker-nav" onClick={goNext} aria-label="Next month">
          ›
        </button>
      </div>
      <div className="datepicker-weekdays">
        {WEEKDAYS.map((d, i) => (
          <span key={d} className={classNames(i >= 5 && "datepicker-weekday--weekend")}>
            {d}
          </span>
        ))}
      </div>
      <div className="datepicker-grid">
        {cells.map((d, i) => {
          if (!d) return <span key={`b${i}`} className="datepicker-day datepicker-day--blank" />;
          const isToday = d.getTime() === today.getTime();
          const isSelected = valueDate ? d.getTime() === valueDate.getTime() : false;
          const isWeekend = d.getDay() === 0 || d.getDay() === 6;
          return (
            <button
              key={isoForDate(d)}
              type="button"
              className={classNames(
                "datepicker-day",
                isWeekend && "datepicker-day--weekend",
                isToday && "datepicker-day--today",
                isSelected && "datepicker-day--selected"
              )}
              onClick={() => onPick(isoForDate(d))}
            >
              {d.getDate()}
            </button>
          );
        })}
      </div>
      <div className="datepicker-footer">
        <button type="button" className="datepicker-today-btn" onClick={goToday}>
          Today
        </button>
        <button type="button" className="datepicker-cancel-btn" onClick={onClose}>
          Cancel
        </button>
      </div>
    </div>
  );
}
