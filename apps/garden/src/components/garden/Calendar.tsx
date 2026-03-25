import { useState, useEffect, useCallback } from "react";

interface JournalEntry {
  date: string;
  slug: string;
  wordCount: number;
}

interface CalendarProps {
  garden: string;
  dailyNotesEnabled: boolean;
  dailyNotesFolder: string;
}

const DAY_NAMES = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const MONTH_NAMES = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

export function Calendar({ garden, dailyNotesEnabled, dailyNotesFolder }: CalendarProps) {
  const today = new Date();
  const [year, setYear] = useState(today.getFullYear());
  const [month, setMonth] = useState(today.getMonth() + 1);
  const [entries, setEntries] = useState<Map<string, JournalEntry>>(new Map());
  const [loading, setLoading] = useState(false);
  const [creating, setCreating] = useState<string | null>(null);

  const fetchEntries = useCallback(async () => {
    setLoading(true);
    try {
      const monthStr = `${year}-${String(month).padStart(2, "0")}`;
      const res = await fetch(`/api/daily-note?garden=${garden}&month=${monthStr}`);
      if (res.ok) {
        const data = await res.json();
        const map = new Map<string, JournalEntry>();
        for (const e of data.entries || []) {
          map.set(e.date, e);
        }
        setEntries(map);
      }
    } catch {}
    setLoading(false);
  }, [garden, year, month]);

  useEffect(() => { fetchEntries(); }, [fetchEntries]);

  function prevMonth() {
    if (month === 1) { setMonth(12); setYear(year - 1); }
    else setMonth(month - 1);
  }

  function nextMonth() {
    if (month === 12) { setMonth(1); setYear(year + 1); }
    else setMonth(month + 1);
  }

  async function handleDayClick(dateStr: string) {
    const entry = entries.get(dateStr);
    if (entry) {
      window.location.href = `/garden/${garden}/${entry.slug}`;
      return;
    }

    if (!dailyNotesEnabled) return;

    setCreating(dateStr);
    try {
      const res = await fetch("/api/daily-note", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ garden, date: dateStr }),
      });
      if (res.ok) {
        const data = await res.json();
        if (data.path) window.location.href = data.path;
      }
    } catch {}
    setCreating(null);
  }

  // Build calendar grid
  const firstDay = new Date(year, month - 1, 1).getDay();
  const daysInMonth = new Date(year, month, 0).getDate();
  const todayStr = today.toISOString().split("T")[0];

  const cells: Array<{ day: number; dateStr: string } | null> = [];
  for (let i = 0; i < firstDay; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) {
    const dateStr = `${year}-${String(month).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
    cells.push({ day: d, dateStr });
  }

  return (
    <div className="rounded-lg border border-[var(--color-border)] p-4">
      {/* Header */}
      <div className="flex items-center justify-between mb-3">
        <button
          onClick={prevMonth}
          className="text-[var(--color-text-muted)] hover:text-[var(--color-text)] px-2 py-1 text-sm"
        >
          ‹
        </button>
        <span className="text-sm font-semibold">
          {MONTH_NAMES[month - 1]} {year}
        </span>
        <button
          onClick={nextMonth}
          className="text-[var(--color-text-muted)] hover:text-[var(--color-text)] px-2 py-1 text-sm"
        >
          ›
        </button>
      </div>

      {/* Day names */}
      <div className="grid grid-cols-7 mb-1">
        {DAY_NAMES.map((d) => (
          <div key={d} className="text-center text-[10px] text-[var(--color-text-muted)] font-medium py-1">
            {d}
          </div>
        ))}
      </div>

      {/* Days */}
      <div className="grid grid-cols-7 gap-px">
        {cells.map((cell, i) => {
          if (!cell) {
            return <div key={`empty-${i}`} className="h-10" />;
          }

          const entry = entries.get(cell.dateStr);
          const isToday = cell.dateStr === todayStr;
          const hasEntry = !!entry;
          const isCreating = creating === cell.dateStr;

          return (
            <button
              key={cell.dateStr}
              onClick={() => handleDayClick(cell.dateStr)}
              disabled={isCreating}
              className={`h-10 flex flex-col items-center justify-center rounded text-xs transition-colors relative
                ${isToday ? "ring-1 ring-[var(--color-accent)]" : ""}
                ${hasEntry ? "hover:bg-[var(--color-accent)]/10" : dailyNotesEnabled ? "hover:bg-[var(--color-surface-hover)]" : ""}
                ${isCreating ? "opacity-50" : ""}
              `}
              title={
                hasEntry
                  ? `${entry.wordCount} words`
                  : dailyNotesEnabled
                    ? "Create daily note"
                    : ""
              }
            >
              <span className={`${hasEntry ? "font-medium text-[var(--color-text)]" : "text-[var(--color-text-muted)]"}`}>
                {cell.day}
              </span>
              {hasEntry && (
                <div className="flex gap-0.5 mt-0.5">
                  <WordDots wordCount={entry.wordCount} />
                </div>
              )}
            </button>
          );
        })}
      </div>

      {loading && (
        <div className="text-center text-xs text-[var(--color-text-muted)] mt-2">Loading...</div>
      )}
    </div>
  );
}

function WordDots({ wordCount }: { wordCount: number }) {
  if (wordCount === 0) return null;

  const filledDots = Math.min(Math.floor(wordCount / 250), 4);
  const hasLight = wordCount > 0 && filledDots === 0;

  const dots: React.ReactNode[] = [];

  if (hasLight) {
    dots.push(
      <span
        key="light"
        className="inline-block w-1.5 h-1.5 rounded-full border border-[var(--color-accent)]"
      />
    );
  } else {
    for (let i = 0; i < filledDots; i++) {
      dots.push(
        <span
          key={i}
          className="inline-block w-1.5 h-1.5 rounded-full bg-[var(--color-accent)]"
        />
      );
    }
  }

  return <>{dots}</>;
}
