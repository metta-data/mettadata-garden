import { useState, useEffect, useCallback } from "react";

interface Garden {
  id: string;
  name: string;
  display_name: string;
  description: string;
  icon: string;
  icon_type: string;
  published: number;
  sort_order: number;
  noteCount: number;
  daily_notes_enabled: number;
  daily_notes_template: string;
  daily_notes_folder: string;
  calendar_enabled: number;
  custom_domain: string;
}

export function GardenManager() {
  const [gardens, setGardens] = useState<Garden[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

  const fetchGardens = useCallback(async () => {
    try {
      const res = await fetch("/api/admin/gardens");
      const data = await res.json();
      setGardens(data.gardens || []);
    } catch {
      setMessage({ type: "error", text: "Failed to load gardens" });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchGardens();
  }, [fetchGardens]);

  function flash(type: "success" | "error", text: string) {
    setMessage({ type, text });
    setTimeout(() => setMessage(null), 3000);
  }

  async function handleCreate(form: CreateForm) {
    const res = await fetch("/api/admin/gardens", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(form),
    });
    const data = await res.json();
    if (!res.ok) {
      flash("error", data.error || "Failed to create garden");
      return;
    }
    flash("success", `Garden "${form.display_name}" created`);
    setCreating(false);
    fetchGardens();
  }

  async function handleUpdate(id: string, updates: Partial<Garden>) {
    const res = await fetch("/api/admin/gardens", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, ...updates }),
    });
    const data = await res.json();
    if (!res.ok) {
      flash("error", data.error || "Failed to update garden");
      return;
    }
    flash("success", "Garden updated");
    setEditing(null);
    fetchGardens();
  }

  async function handleDelete(id: string, name: string) {
    if (!confirm(`Delete garden "${name}"? This cannot be undone.`)) return;
    const res = await fetch("/api/admin/gardens", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id }),
    });
    const data = await res.json();
    if (!res.ok) {
      flash("error", data.error || "Failed to delete");
      return;
    }
    flash("success", `Garden "${name}" deleted`);
    fetchGardens();
  }

  async function handleTogglePublished(garden: Garden) {
    await handleUpdate(garden.id, { published: garden.published ? 0 : 1 } as any);
  }

  async function handleMoveUp(idx: number) {
    if (idx <= 0) return;
    const reordered = [...gardens];
    [reordered[idx - 1], reordered[idx]] = [reordered[idx], reordered[idx - 1]];
    const order = reordered.map((g, i) => ({ id: g.id, sort_order: i }));
    // Optimistic update
    setGardens(reordered.map((g, i) => ({ ...g, sort_order: i })));
    for (const item of order) {
      await fetch("/api/admin/gardens", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: item.id, sort_order: item.sort_order }),
      });
    }
  }

  async function handleMoveDown(idx: number) {
    if (idx >= gardens.length - 1) return;
    await handleMoveUp(idx + 1);
  }

  if (loading) {
    return <div className="text-center py-12 text-[var(--color-text-muted)]">Loading...</div>;
  }

  return (
    <div className="max-w-4xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold">Manage Gardens</h1>
        <button
          onClick={() => setCreating(true)}
          className="rounded-lg bg-[var(--color-accent)] px-4 py-2 text-sm font-medium text-white
            hover:bg-[var(--color-accent-hover)] transition-colors"
        >
          + New Garden
        </button>
      </div>

      {message && (
        <div className={`mb-4 rounded-lg px-4 py-2 text-sm ${
          message.type === "success" ? "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200" : "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200"
        }`}>
          {message.text}
        </div>
      )}

      {creating && (
        <CreateGardenForm
          onSave={handleCreate}
          onCancel={() => setCreating(false)}
        />
      )}

      <div className="space-y-2">
        {gardens.map((garden, idx) => (
          <div
            key={garden.id}
            className="rounded-lg border border-[var(--color-border)] p-4"
          >
            {editing === garden.id ? (
              <EditGardenForm
                garden={garden}
                onSave={(updates) => handleUpdate(garden.id, updates)}
                onCancel={() => setEditing(null)}
              />
            ) : (
              <div className="flex items-center gap-4">
                <div className="flex flex-col gap-0.5">
                  <button
                    onClick={() => handleMoveUp(idx)}
                    disabled={idx === 0}
                    className="text-xs text-[var(--color-text-muted)] hover:text-[var(--color-text)] disabled:opacity-30"
                  >
                    ▲
                  </button>
                  <button
                    onClick={() => handleMoveDown(idx)}
                    disabled={idx === gardens.length - 1}
                    className="text-xs text-[var(--color-text-muted)] hover:text-[var(--color-text)] disabled:opacity-30"
                  >
                    ▼
                  </button>
                </div>

                <span className="text-2xl w-8 text-center">{garden.icon || "📁"}</span>

                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="font-medium">{garden.display_name}</span>
                    <span className="text-xs text-[var(--color-text-muted)]">({garden.name})</span>
                    {garden.published ? (
                      <span className="text-xs bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200 px-1.5 py-0.5 rounded">
                        Published
                      </span>
                    ) : (
                      <span className="text-xs bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400 px-1.5 py-0.5 rounded">
                        Hidden
                      </span>
                    )}
                  </div>
                  {garden.description && (
                    <p className="text-sm text-[var(--color-text-secondary)] truncate">{garden.description}</p>
                  )}
                  <span className="text-xs text-[var(--color-text-muted)]">{garden.noteCount} notes</span>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    onClick={() => handleTogglePublished(garden)}
                    className="text-xs text-[var(--color-text-secondary)] hover:text-[var(--color-text)] px-2 py-1 rounded border border-[var(--color-border)]"
                  >
                    {garden.published ? "Hide" : "Publish"}
                  </button>
                  <button
                    onClick={() => setEditing(garden.id)}
                    className="text-xs text-[var(--color-accent)] hover:underline px-2 py-1"
                  >
                    Edit
                  </button>
                  {garden.name !== "private" && garden.noteCount === 0 && (
                    <button
                      onClick={() => handleDelete(garden.id, garden.display_name)}
                      className="text-xs text-red-500 hover:underline px-2 py-1"
                    >
                      Delete
                    </button>
                  )}
                </div>
              </div>
            )}
          </div>
        ))}
      </div>

      <div className="mt-6">
        <a href="/admin/users" className="text-sm text-[var(--color-accent)] hover:underline">
          ← Back to User Management
        </a>
      </div>
    </div>
  );
}

/* ── Create Form ──────────────────────────────────── */

interface CreateForm {
  name: string;
  display_name: string;
  description: string;
  icon: string;
  icon_type: string;
  published: boolean;
}

function CreateGardenForm({
  onSave,
  onCancel,
}: {
  onSave: (form: CreateForm) => void;
  onCancel: () => void;
}) {
  const [name, setName] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [description, setDescription] = useState("");
  const [icon, setIcon] = useState("");
  const [published, setPublished] = useState(true);

  const slug = name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");

  return (
    <div className="mb-6 rounded-lg border border-[var(--color-accent)] p-4 space-y-3">
      <h3 className="font-medium">Create New Garden</h3>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block text-xs font-medium text-[var(--color-text-secondary)] mb-1">Display Name</label>
          <input
            type="text"
            value={displayName}
            onChange={(e) => {
              setDisplayName(e.target.value);
              if (!name) setName(e.target.value);
            }}
            placeholder="My Garden"
            className="w-full rounded border border-[var(--color-border)] bg-[var(--color-surface)] px-3 py-1.5 text-sm"
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-[var(--color-text-secondary)] mb-1">
            Slug {slug && <span className="text-[var(--color-text-muted)]">→ {slug}</span>}
          </label>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="my-garden"
            className="w-full rounded border border-[var(--color-border)] bg-[var(--color-surface)] px-3 py-1.5 text-sm"
          />
        </div>
      </div>

      <div>
        <label className="block text-xs font-medium text-[var(--color-text-secondary)] mb-1">Description</label>
        <input
          type="text"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="What is this garden about?"
          className="w-full rounded border border-[var(--color-border)] bg-[var(--color-surface)] px-3 py-1.5 text-sm"
        />
      </div>

      <div className="flex items-center gap-4">
        <div>
          <label className="block text-xs font-medium text-[var(--color-text-secondary)] mb-1">Icon (emoji)</label>
          <input
            type="text"
            value={icon}
            onChange={(e) => setIcon(e.target.value)}
            placeholder="🌿"
            className="w-20 rounded border border-[var(--color-border)] bg-[var(--color-surface)] px-3 py-1.5 text-sm text-center"
            maxLength={4}
          />
        </div>
        <label className="flex items-center gap-2 text-sm mt-4">
          <input type="checkbox" checked={published} onChange={(e) => setPublished(e.target.checked)} />
          <span>Published</span>
        </label>
      </div>

      <div className="flex gap-2">
        <button
          onClick={() => onSave({ name: slug || name, display_name: displayName, description, icon, icon_type: "emoji", published })}
          disabled={!displayName.trim()}
          className="rounded bg-[var(--color-accent)] px-4 py-1.5 text-sm text-white hover:bg-[var(--color-accent-hover)] disabled:opacity-50"
        >
          Create
        </button>
        <button
          onClick={onCancel}
          className="rounded border border-[var(--color-border)] px-4 py-1.5 text-sm hover:bg-[var(--color-surface-hover)]"
        >
          Cancel
        </button>
      </div>
    </div>
  );
}

/* ── Edit Form ──────────────────────────────────── */

function EditGardenForm({
  garden,
  onSave,
  onCancel,
}: {
  garden: Garden;
  onSave: (updates: Partial<Garden>) => void;
  onCancel: () => void;
}) {
  const [displayName, setDisplayName] = useState(garden.display_name);
  const [description, setDescription] = useState(garden.description);
  const [icon, setIcon] = useState(garden.icon);
  const [published, setPublished] = useState(!!garden.published);
  const [dailyEnabled, setDailyEnabled] = useState(!!garden.daily_notes_enabled);
  const [dailyTemplate, setDailyTemplate] = useState(garden.daily_notes_template || "");
  const [dailyFolder, setDailyFolder] = useState(garden.daily_notes_folder || "journal");
  const [calendarEnabled, setCalendarEnabled] = useState(!!garden.calendar_enabled);
  const [customDomain, setCustomDomain] = useState(garden.custom_domain || "");

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block text-xs font-medium text-[var(--color-text-secondary)] mb-1">Display Name</label>
          <input
            type="text"
            value={displayName}
            onChange={(e) => setDisplayName(e.target.value)}
            className="w-full rounded border border-[var(--color-border)] bg-[var(--color-surface)] px-3 py-1.5 text-sm"
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-[var(--color-text-secondary)] mb-1">Slug (read-only)</label>
          <input
            type="text"
            value={garden.name}
            readOnly
            className="w-full rounded border border-[var(--color-border)] bg-[var(--color-bg-secondary)] px-3 py-1.5 text-sm text-[var(--color-text-muted)]"
          />
        </div>
      </div>

      <div>
        <label className="block text-xs font-medium text-[var(--color-text-secondary)] mb-1">Description</label>
        <input
          type="text"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          className="w-full rounded border border-[var(--color-border)] bg-[var(--color-surface)] px-3 py-1.5 text-sm"
        />
      </div>

      <div className="flex items-center gap-4">
        <div>
          <label className="block text-xs font-medium text-[var(--color-text-secondary)] mb-1">Icon</label>
          <input
            type="text"
            value={icon}
            onChange={(e) => setIcon(e.target.value)}
            className="w-20 rounded border border-[var(--color-border)] bg-[var(--color-surface)] px-3 py-1.5 text-sm text-center"
            maxLength={4}
          />
        </div>
        <label className="flex items-center gap-2 text-sm mt-4">
          <input type="checkbox" checked={published} onChange={(e) => setPublished(e.target.checked)} />
          <span>Published</span>
        </label>
      </div>

      {/* Custom Domain */}
      <div>
        <label className="block text-xs font-medium text-[var(--color-text-secondary)] mb-1">Custom Domain</label>
        <input
          type="text"
          value={customDomain}
          onChange={(e) => setCustomDomain(e.target.value)}
          placeholder="kb.example.com"
          className="w-full rounded border border-[var(--color-border)] bg-[var(--color-surface)] px-3 py-1.5 text-sm"
        />
        <p className="text-xs text-[var(--color-text-muted)] mt-1">Point a CNAME to your server. Leave empty for none.</p>
      </div>

      {/* Daily Notes & Calendar */}
      <div className="border-t border-[var(--color-border)] pt-3 mt-3">
        <h4 className="text-xs font-semibold text-[var(--color-text-muted)] uppercase tracking-wider mb-2">Daily Notes & Calendar</h4>
        <div className="space-y-2">
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={dailyEnabled} onChange={(e) => setDailyEnabled(e.target.checked)} />
            <span>Enable daily notes</span>
          </label>
          {dailyEnabled && (
            <div className="grid grid-cols-2 gap-3 ml-6">
              <div>
                <label className="block text-xs text-[var(--color-text-muted)] mb-1">Folder</label>
                <input type="text" value={dailyFolder} onChange={(e) => setDailyFolder(e.target.value)}
                  placeholder="journal" className="w-full rounded border border-[var(--color-border)] bg-[var(--color-surface)] px-3 py-1 text-sm" />
              </div>
              <div>
                <label className="block text-xs text-[var(--color-text-muted)] mb-1">Template (optional)</label>
                <input type="text" value={dailyTemplate} onChange={(e) => setDailyTemplate(e.target.value)}
                  placeholder="Template name" className="w-full rounded border border-[var(--color-border)] bg-[var(--color-surface)] px-3 py-1 text-sm" />
              </div>
            </div>
          )}
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={calendarEnabled} onChange={(e) => setCalendarEnabled(e.target.checked)} />
            <span>Show calendar widget</span>
          </label>
        </div>
      </div>

      <div className="flex gap-2">
        <button
          onClick={() => onSave({
            display_name: displayName, description, icon,
            published: published ? 1 : 0,
            daily_notes_enabled: dailyEnabled ? 1 : 0,
            daily_notes_template: dailyTemplate,
            daily_notes_folder: dailyFolder,
            calendar_enabled: calendarEnabled ? 1 : 0,
            custom_domain: customDomain.trim(),
          } as any)}
          className="rounded bg-[var(--color-accent)] px-4 py-1.5 text-sm text-white hover:bg-[var(--color-accent-hover)]"
        >
          Save
        </button>
        <button
          onClick={onCancel}
          className="rounded border border-[var(--color-border)] px-4 py-1.5 text-sm hover:bg-[var(--color-surface-hover)]"
        >
          Cancel
        </button>
      </div>
    </div>
  );
}
