import { useState, useEffect, useCallback } from "react";

interface Template {
  name: string;
  description: string;
  filename: string;
  body: string;
  source: "global" | "garden";
  garden?: string;
}

export function TemplateManager() {
  const [templates, setTemplates] = useState<Template[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<Template | null>(null);
  const [creating, setCreating] = useState(false);
  const [gardens, setGardens] = useState<Array<{ name: string; display_name: string }>>([]);
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

  const fetchData = useCallback(async () => {
    try {
      const [tmplRes, gardensRes] = await Promise.all([
        fetch("/api/admin/templates"),
        fetch("/api/admin/gardens"),
      ]);
      const tmplData = await tmplRes.json();
      const gardensData = await gardensRes.json();
      setTemplates(tmplData.templates || []);
      setGardens((gardensData.gardens || []).map((g: any) => ({ name: g.name, display_name: g.display_name })));
    } catch {
      flash("error", "Failed to load");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  function flash(type: "success" | "error", text: string) {
    setMessage({ type, text });
    setTimeout(() => setMessage(null), 3000);
  }

  async function handleCreate(data: { name: string; description: string; content: string; garden?: string }) {
    const res = await fetch("/api/admin/templates", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });
    const result = await res.json();
    if (!res.ok) { flash("error", result.error); return; }
    flash("success", "Template created");
    setCreating(false);
    fetchData();
  }

  async function handleSave(tmpl: Template, updates: { name: string; description: string; content: string; garden?: string }) {
    const res = await fetch("/api/admin/templates", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ filename: tmpl.filename, oldGarden: tmpl.garden, ...updates }),
    });
    const result = await res.json();
    if (!res.ok) { flash("error", result.error); return; }
    flash("success", "Template saved");
    setEditing(null);
    fetchData();
  }

  async function handleDelete(tmpl: Template) {
    if (!confirm(`Delete template "${tmpl.name}"?`)) return;
    const res = await fetch("/api/admin/templates", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ filename: tmpl.filename, garden: tmpl.garden }),
    });
    if (!res.ok) { flash("error", "Failed to delete"); return; }
    flash("success", "Template deleted");
    fetchData();
  }

  if (loading) return <div className="text-center py-12 text-[var(--color-text-muted)]">Loading...</div>;

  const globalTemplates = templates.filter((t) => t.source === "global");
  const gardenTemplates = templates.filter((t) => t.source === "garden");

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold">Templates</h1>
        <button
          onClick={() => setCreating(true)}
          className="rounded-lg bg-[var(--color-accent)] px-4 py-2 text-sm font-medium text-white hover:bg-[var(--color-accent-hover)]"
        >
          + New Template
        </button>
      </div>

      {message && (
        <div className={`mb-4 rounded-lg px-4 py-2 text-sm ${
          message.type === "success" ? "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200" : "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200"
        }`}>{message.text}</div>
      )}

      {creating && (
        <TemplateForm
          gardens={gardens}
          onSave={handleCreate}
          onCancel={() => setCreating(false)}
        />
      )}

      {editing && (
        <div className="mb-6">
          <TemplateForm
            gardens={gardens}
            initial={editing}
            onSave={(updates) => handleSave(editing, updates)}
            onCancel={() => setEditing(null)}
          />
        </div>
      )}

      {/* Global templates */}
      <section className="mb-6">
        <h2 className="text-sm font-semibold text-[var(--color-text-muted)] uppercase tracking-wider mb-2">
          Global Templates
        </h2>
        {globalTemplates.length === 0 ? (
          <p className="text-sm text-[var(--color-text-muted)] py-2">No global templates yet.</p>
        ) : (
          <div className="space-y-2">
            {globalTemplates.map((tmpl) => (
              <TemplateRow key={tmpl.filename} tmpl={tmpl} onEdit={setEditing} onDelete={handleDelete} />
            ))}
          </div>
        )}
      </section>

      {/* Garden templates */}
      {gardens.map((g) => {
        const gTemplates = gardenTemplates.filter((t) => t.garden === g.name);
        if (gTemplates.length === 0) return null;
        return (
          <section key={g.name} className="mb-6">
            <h2 className="text-sm font-semibold text-[var(--color-text-muted)] uppercase tracking-wider mb-2">
              {g.display_name} Templates
            </h2>
            <div className="space-y-2">
              {gTemplates.map((tmpl) => (
                <TemplateRow key={`${g.name}/${tmpl.filename}`} tmpl={tmpl} onEdit={setEditing} onDelete={handleDelete} />
              ))}
            </div>
          </section>
        );
      })}
    </div>
  );
}

function TemplateRow({ tmpl, onEdit, onDelete }: { tmpl: Template; onEdit: (t: Template) => void; onDelete: (t: Template) => void }) {
  return (
    <div className="flex items-center justify-between rounded-lg border border-[var(--color-border)] px-4 py-3">
      <div>
        <span className="font-medium text-sm">{tmpl.name}</span>
        {tmpl.description && (
          <span className="text-sm text-[var(--color-text-muted)] ml-2">— {tmpl.description}</span>
        )}
        {tmpl.garden && (
          <span className="text-xs text-[var(--color-text-muted)] ml-2">({tmpl.garden})</span>
        )}
      </div>
      <div className="flex gap-2">
        <button onClick={() => onEdit(tmpl)} className="text-xs text-[var(--color-accent)] hover:underline">Edit</button>
        <button onClick={() => onDelete(tmpl)} className="text-xs text-red-500 hover:underline">Delete</button>
      </div>
    </div>
  );
}

function TemplateForm({
  gardens,
  initial,
  onSave,
  onCancel,
}: {
  gardens: Array<{ name: string; display_name: string }>;
  initial?: Template;
  onSave: (data: { name: string; description: string; content: string; garden?: string }) => void;
  onCancel: () => void;
}) {
  const [name, setName] = useState(initial?.name || "");
  const [description, setDescription] = useState(initial?.description || "");
  const [content, setContent] = useState(initial?.body || "");
  const [garden, setGarden] = useState(initial?.garden || "");

  return (
    <div className="mb-6 rounded-lg border border-[var(--color-accent)] p-4 space-y-3">
      <h3 className="font-medium">{initial ? "Edit Template" : "New Template"}</h3>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block text-xs font-medium text-[var(--color-text-secondary)] mb-1">Name</label>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Book Review"
            className="w-full rounded border border-[var(--color-border)] bg-[var(--color-surface)] px-3 py-1.5 text-sm"
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-[var(--color-text-secondary)] mb-1">Scope</label>
          <select
            value={garden}
            onChange={(e) => setGarden(e.target.value)}
            className="w-full appearance-auto rounded border border-[var(--color-border)] bg-white dark:bg-[#1e1e1e] px-3 py-1.5 text-sm text-[var(--color-text)] cursor-pointer"
          >
            <option value="">Global (all gardens)</option>
            {gardens.map((g) => (
              <option key={g.name} value={g.name}>{g.display_name}</option>
            ))}
          </select>
          {gardens.length === 0 && (
            <p className="text-xs text-[var(--color-text-muted)] mt-1">No gardens found — create one in Admin &gt; Gardens first.</p>
          )}
        </div>
      </div>

      <div>
        <label className="block text-xs font-medium text-[var(--color-text-secondary)] mb-1">Description</label>
        <input
          type="text"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="What is this template for?"
          className="w-full rounded border border-[var(--color-border)] bg-[var(--color-surface)] px-3 py-1.5 text-sm"
        />
      </div>

      <div>
        <label className="block text-xs font-medium text-[var(--color-text-secondary)] mb-1">Body (Markdown)</label>
        <textarea
          value={content}
          onChange={(e) => setContent(e.target.value)}
          rows={8}
          className="w-full rounded border border-[var(--color-border)] bg-[var(--color-surface)] px-3 py-2 text-sm font-mono"
          placeholder="## Overview&#10;&#10;## Key Points&#10;&#10;- &#10;"
        />
      </div>

      <div className="flex gap-2">
        <button
          onClick={() => onSave({ name, description, content, garden: garden || undefined })}
          disabled={!name.trim()}
          className="rounded bg-[var(--color-accent)] px-4 py-1.5 text-sm text-white hover:bg-[var(--color-accent-hover)] disabled:opacity-50"
        >
          {initial ? "Save" : "Create"}
        </button>
        <button onClick={onCancel} className="rounded border border-[var(--color-border)] px-4 py-1.5 text-sm hover:bg-[var(--color-surface-hover)]">
          Cancel
        </button>
      </div>
    </div>
  );
}
