import { useState, useEffect, useRef } from "react";
import { createPortal } from "react-dom";

interface Template {
  name: string;
  description?: string;
  source: string;
}

interface TemplatePickerProps {
  garden: string;
  onSelect: (templateName: string, processedBody: string) => void;
  onClose: () => void;
  noteTitle?: string;
  noteFolder?: string;
}

export function TemplatePicker({ garden, onSelect, onClose, noteTitle, noteFolder }: TemplatePickerProps) {
  const [templates, setTemplates] = useState<Template[]>([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState("");
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [applying, setApplying] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    fetch(`/api/templates?garden=${garden}`)
      .then((r) => r.json())
      .then((data) => setTemplates(data.templates || []))
      .catch(() => {})
      .finally(() => setLoading(false));
    setTimeout(() => inputRef.current?.focus(), 50);
  }, [garden]);

  const filtered = query.trim()
    ? templates.filter((t) => t.name.toLowerCase().includes(query.toLowerCase()))
    : templates;

  useEffect(() => { setSelectedIndex(0); }, [query]);

  async function applyTemplate(tmpl: Template) {
    setApplying(true);
    try {
      const res = await fetch("/api/apply-template", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          garden,
          template: tmpl.name,
          title: noteTitle || "",
          folder: noteFolder || "",
        }),
      });
      if (res.ok) {
        const data = await res.json();
        onSelect(tmpl.name, data.body);
      }
    } catch {}
    setApplying(false);
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setSelectedIndex((i) => (i + 1) % Math.max(filtered.length, 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setSelectedIndex((i) => (i - 1 + filtered.length) % Math.max(filtered.length, 1));
    } else if (e.key === "Enter") {
      e.preventDefault();
      if (filtered[selectedIndex]) applyTemplate(filtered[selectedIndex]);
    } else if (e.key === "Escape") {
      onClose();
    }
  }

  return createPortal(
    <div className="fixed inset-0 z-50 flex items-start justify-center pt-[20vh]" onClick={onClose}>
      <div className="absolute inset-0 bg-black/40" />
      <div
        className="relative w-full max-w-md rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] shadow-2xl overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center gap-2 border-b border-[var(--color-border)] px-4 py-3">
          <span className="text-sm text-[var(--color-text-muted)]">Apply template:</span>
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Search templates..."
            className="flex-1 bg-transparent text-sm text-[var(--color-text)] placeholder:text-[var(--color-text-muted)] outline-none"
          />
        </div>

        <div className="max-h-64 overflow-y-auto py-1">
          {loading && (
            <div className="px-4 py-4 text-center text-sm text-[var(--color-text-muted)]">Loading...</div>
          )}
          {!loading && filtered.length === 0 && (
            <div className="px-4 py-4 text-center text-sm text-[var(--color-text-muted)]">
              No templates found
            </div>
          )}
          {filtered.map((tmpl, i) => (
            <button
              key={tmpl.name}
              onClick={() => applyTemplate(tmpl)}
              disabled={applying}
              className={`w-full flex items-center gap-3 px-4 py-2.5 text-sm text-left transition-colors ${
                i === selectedIndex
                  ? "bg-[var(--color-accent)] text-white"
                  : "text-[var(--color-text)] hover:bg-[var(--color-surface-hover)]"
              }`}
            >
              <span className="w-5 text-center">📄</span>
              <div className="flex-1 min-w-0">
                <span>{tmpl.name}</span>
                {tmpl.description && (
                  <span className={`ml-2 text-xs ${i === selectedIndex ? "text-white/70" : "text-[var(--color-text-muted)]"}`}>
                    {tmpl.description}
                  </span>
                )}
              </div>
              <span className={`text-xs ${i === selectedIndex ? "text-white/60" : "text-[var(--color-text-muted)]"}`}>
                {tmpl.source}
              </span>
            </button>
          ))}
        </div>
      </div>
    </div>,
    document.body
  );
}
