import { useState, useEffect, useRef, useCallback } from "react";
import { createPortal } from "react-dom";

interface Command {
  id: string;
  label: string;
  icon: string;
  action: () => void | Promise<void>;
  category?: string;
}

interface CommandPaletteProps {
  commands: Command[];
}

export function CommandPalette({ commands }: CommandPaletteProps) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [selectedIndex, setSelectedIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  const filtered = query.trim()
    ? commands.filter(
        (c) =>
          c.label.toLowerCase().includes(query.toLowerCase()) ||
          c.category?.toLowerCase().includes(query.toLowerCase())
      )
    : commands;

  // Keyboard shortcut: Cmd+P / Ctrl+P
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key === "p") {
        e.preventDefault();
        setOpen((prev) => !prev);
        setQuery("");
        setSelectedIndex(0);
      }
    }
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, []);

  // Focus input when opened
  useEffect(() => {
    if (open) {
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [open]);

  // Reset selection when query changes
  useEffect(() => {
    setSelectedIndex(0);
  }, [query]);

  const handleSelect = useCallback(
    (cmd: Command) => {
      setOpen(false);
      setQuery("");
      cmd.action();
    },
    []
  );

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setSelectedIndex((i) => (i + 1) % Math.max(filtered.length, 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setSelectedIndex((i) => (i - 1 + filtered.length) % Math.max(filtered.length, 1));
    } else if (e.key === "Enter") {
      e.preventDefault();
      if (filtered[selectedIndex]) handleSelect(filtered[selectedIndex]);
    } else if (e.key === "Escape") {
      setOpen(false);
    }
  }

  if (!open) return null;

  return createPortal(
    <div
      className="fixed inset-0 z-50 flex items-start justify-center pt-[20vh]"
      onClick={() => setOpen(false)}
    >
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/40" />

      {/* Palette */}
      <div
        className="relative w-full max-w-lg rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] shadow-2xl overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center gap-2 border-b border-[var(--color-border)] px-4 py-3">
          <span className="text-[var(--color-text-muted)]">
            <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
          </span>
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Type a command..."
            className="flex-1 bg-transparent text-sm text-[var(--color-text)] placeholder:text-[var(--color-text-muted)] outline-none"
          />
          <kbd className="text-[10px] text-[var(--color-text-muted)] bg-[var(--color-bg-secondary)] px-1.5 py-0.5 rounded">
            esc
          </kbd>
        </div>

        <div className="max-h-72 overflow-y-auto py-1">
          {filtered.length === 0 && (
            <div className="px-4 py-6 text-center text-sm text-[var(--color-text-muted)]">
              No commands found
            </div>
          )}
          {filtered.map((cmd, i) => (
            <button
              key={cmd.id}
              onClick={() => handleSelect(cmd)}
              className={`w-full flex items-center gap-3 px-4 py-2.5 text-sm text-left transition-colors ${
                i === selectedIndex
                  ? "bg-[var(--color-accent)] text-white"
                  : "text-[var(--color-text)] hover:bg-[var(--color-surface-hover)]"
              }`}
            >
              <span className="w-5 text-center">{cmd.icon}</span>
              <span className="flex-1">{cmd.label}</span>
              {cmd.category && (
                <span className={`text-xs ${i === selectedIndex ? "text-white/70" : "text-[var(--color-text-muted)]"}`}>
                  {cmd.category}
                </span>
              )}
            </button>
          ))}
        </div>
      </div>
    </div>,
    document.body
  );
}
