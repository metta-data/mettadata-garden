import { useState, useEffect, useCallback } from "react";

interface Folder {
  id: string;
  name: string;
  display_name: string;
  icon: string;
  is_global: number;
  garden_id: string | null;
  gardenName: string | null;
  default_template: string;
}

interface GardenOption {
  id: string;
  name: string;
  display_name: string;
}

export function FolderManager() {
  const [folders, setFolders] = useState<Folder[]>([]);
  const [gardens, setGardens] = useState<GardenOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [createForGarden, setCreateForGarden] = useState<string | null>(null);
  const [editing, setEditing] = useState<string | null>(null);
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

  const fetchData = useCallback(async () => {
    try {
      const [fRes, gRes] = await Promise.all([
        fetch("/api/admin/folders"),
        fetch("/api/admin/gardens"),
      ]);
      const fData = await fRes.json();
      const gData = await gRes.json();
      setFolders(fData.folders || []);
      setGardens((gData.gardens || []).map((g: any) => ({ id: g.id, name: g.name, display_name: g.display_name })));
    } catch {} finally { setLoading(false); }
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  function flash(type: "success" | "error", text: string) {
    setMessage({ type, text });
    setTimeout(() => setMessage(null), 3000);
  }

  async function handleCreate(data: { name: string; display_name: string; icon: string; is_global: boolean; garden_id?: string }) {
    const res = await fetch("/api/admin/folders", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });
    const result = await res.json();
    if (!res.ok) { flash("error", result.error); return; }
    flash("success", "Folder created");
    setCreating(false);
    fetchData();
  }

  async function handleUpdate(id: string, data: { display_name: string; icon: string; default_template?: string }) {
    const res = await fetch("/api/admin/folders", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, ...data }),
    });
    if (!res.ok) { flash("error", "Failed to update"); return; }
    flash("success", "Folder updated");
    setEditing(null);
    fetchData();
  }

  async function handleDelete(id: string, name: string) {
    if (!confirm(`Delete folder "${name}"?`)) return;
    const res = await fetch("/api/admin/folders", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id }),
    });
    const result = await res.json();
    if (!res.ok) { flash("error", result.error); return; }
    flash("success", "Folder deleted");
    fetchData();
  }

  if (loading) return <div className="text-center py-12 text-[var(--color-text-muted)]">Loading...</div>;

  const globalFolders = folders.filter((f) => f.is_global);
  const gardenFolders = folders.filter((f) => !f.is_global);

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold">Folders</h1>
        <button
          onClick={() => setCreating(true)}
          className="rounded-lg bg-[var(--color-accent)] px-4 py-2 text-sm font-medium text-white hover:bg-[var(--color-accent-hover)]"
        >
          + New Folder
        </button>
      </div>

      {message && (
        <div className={`mb-4 rounded-lg px-4 py-2 text-sm ${
          message.type === "success" ? "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200" : "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200"
        }`}>{message.text}</div>
      )}

      {creating && (
        <div className="mb-6 rounded-lg border border-[var(--color-accent)] p-4 space-y-3">
          <h3 className="font-medium">New Folder</h3>
          <CreateFolderForm
            gardens={gardens}
            preselectedGardenId={createForGarden}
            onSave={(data) => { handleCreate(data); setCreateForGarden(null); }}
            onCancel={() => { setCreating(false); setCreateForGarden(null); }}
          />
        </div>
      )}

      <section className="mb-6">
        <h2 className="text-sm font-semibold text-[var(--color-text-muted)] uppercase tracking-wider mb-2">
          Global Folders <span className="font-normal">(appear in every garden)</span>
        </h2>
        {globalFolders.length === 0 ? (
          <p className="text-sm text-[var(--color-text-muted)] py-2">No global folders yet.</p>
        ) : (
          <div className="space-y-2">
            {globalFolders.map((f) => (
              <FolderRow key={f.id} folder={f} editing={editing === f.id}
                onEdit={() => setEditing(f.id)} onCancelEdit={() => setEditing(null)}
                onSave={(data) => handleUpdate(f.id, data)} onDelete={() => handleDelete(f.id, f.display_name)} />
            ))}
          </div>
        )}
      </section>

      {gardens.map((g) => {
        const gFolders = gardenFolders.filter((f) => f.garden_id === g.id);
        return (
          <section key={g.id} className="mb-6">
            <div className="flex items-center justify-between mb-2">
              <h2 className="text-sm font-semibold text-[var(--color-text-muted)] uppercase tracking-wider">
                {g.display_name}
              </h2>
              <button
                onClick={() => {
                  setCreating(true);
                  setCreateForGarden(g.id);
                }}
                className="text-xs text-[var(--color-accent)] hover:underline"
              >
                + Add folder
              </button>
            </div>
            {gFolders.length === 0 ? (
              <p className="text-sm text-[var(--color-text-muted)] py-2">No folders in this garden yet.</p>
            ) : (
              <div className="space-y-2">
                {gFolders.map((f) => (
                  <FolderRow key={f.id} folder={f} editing={editing === f.id}
                    onEdit={() => setEditing(f.id)} onCancelEdit={() => setEditing(null)}
                    onSave={(data) => handleUpdate(f.id, data)} onDelete={() => handleDelete(f.id, f.display_name)} />
                ))}
              </div>
            )}
          </section>
        );
      })}
    </div>
  );
}

function FolderRow({ folder, editing, onEdit, onCancelEdit, onSave, onDelete }: {
  folder: Folder; editing: boolean;
  onEdit: () => void; onCancelEdit: () => void;
  onSave: (data: { display_name: string; icon: string; default_template?: string }) => void;
  onDelete: () => void;
}) {
  const [displayName, setDisplayName] = useState(folder.display_name);
  const [icon, setIcon] = useState(folder.icon);
  const [defaultTemplate, setDefaultTemplate] = useState(folder.default_template || "");

  if (editing) {
    return (
      <div className="rounded-lg border border-[var(--color-accent)] p-3 space-y-2">
        <div className="flex items-center gap-3">
          <input type="text" value={icon} onChange={(e) => setIcon(e.target.value)} className="w-12 rounded border border-[var(--color-border)] bg-[var(--color-surface)] px-2 py-1 text-sm text-center" maxLength={4} placeholder="📁" />
          <input type="text" value={displayName} onChange={(e) => setDisplayName(e.target.value)} className="flex-1 rounded border border-[var(--color-border)] bg-[var(--color-surface)] px-3 py-1 text-sm" placeholder="Display name" />
        </div>
        <div className="flex items-center gap-3">
          <label className="text-xs text-[var(--color-text-muted)] whitespace-nowrap">Default template:</label>
          <input type="text" value={defaultTemplate} onChange={(e) => setDefaultTemplate(e.target.value)}
            className="flex-1 rounded border border-[var(--color-border)] bg-[var(--color-surface)] px-3 py-1 text-sm"
            placeholder="Template name (auto-applied to new notes)" />
        </div>
        <div className="flex gap-2">
          <button onClick={() => onSave({ display_name: displayName, icon, default_template: defaultTemplate })} className="text-xs text-[var(--color-accent)]">Save</button>
          <button onClick={onCancelEdit} className="text-xs text-[var(--color-text-muted)]">Cancel</button>
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-lg border border-[var(--color-border)] px-4 py-3 flex items-center gap-3">
      <span className="text-lg">{folder.icon || "📁"}</span>
      <div className="flex-1">
        <div>
          <span className="font-medium text-sm">{folder.display_name}</span>
          <span className="text-xs text-[var(--color-text-muted)] ml-2">({folder.name})</span>
          {folder.gardenName && (
            <span className="text-xs text-[var(--color-text-muted)] ml-2">— {folder.gardenName}</span>
          )}
          {folder.is_global ? (
            <span className="text-[10px] bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200 px-1.5 py-0.5 rounded ml-2">Global</span>
          ) : null}
        </div>
        {folder.default_template && (
          <div className="text-xs text-[var(--color-text-muted)]">
            Template: <span className="text-[var(--color-text-secondary)]">{folder.default_template}</span>
          </div>
        )}
      </div>
      <button onClick={onEdit} className="text-xs text-[var(--color-accent)] hover:underline">Edit</button>
      <button onClick={onDelete} className="text-xs text-red-500 hover:underline">Delete</button>
    </div>
  );
}

function CreateFolderForm({ gardens, preselectedGardenId, onSave, onCancel }: {
  gardens: GardenOption[];
  preselectedGardenId?: string | null;
  onSave: (data: { name: string; display_name: string; icon: string; is_global: boolean; garden_id?: string }) => void;
  onCancel: () => void;
}) {
  const [name, setName] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [icon, setIcon] = useState("");
  const [isGlobal, setIsGlobal] = useState(!preselectedGardenId);
  const [gardenId, setGardenId] = useState(preselectedGardenId || "");

  const slug = name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block text-xs font-medium text-[var(--color-text-secondary)] mb-1">Display Name</label>
          <input type="text" value={displayName} onChange={(e) => { setDisplayName(e.target.value); if (!name) setName(e.target.value); }}
            placeholder="Journal" className="w-full rounded border border-[var(--color-border)] bg-[var(--color-surface)] px-3 py-1.5 text-sm" />
        </div>
        <div>
          <label className="block text-xs font-medium text-[var(--color-text-secondary)] mb-1">
            Slug {slug && <span className="text-[var(--color-text-muted)]">→ {slug}</span>}
          </label>
          <input type="text" value={name} onChange={(e) => setName(e.target.value)}
            placeholder="journal" className="w-full rounded border border-[var(--color-border)] bg-[var(--color-surface)] px-3 py-1.5 text-sm" />
        </div>
      </div>

      <div className="flex items-center gap-4">
        <div>
          <label className="block text-xs font-medium text-[var(--color-text-secondary)] mb-1">Icon</label>
          <input type="text" value={icon} onChange={(e) => setIcon(e.target.value)} placeholder="📁" maxLength={4}
            className="w-16 rounded border border-[var(--color-border)] bg-[var(--color-surface)] px-2 py-1.5 text-sm text-center" />
        </div>
        <label className="flex items-center gap-2 text-sm mt-4">
          <input type="checkbox" checked={isGlobal} onChange={(e) => setIsGlobal(e.target.checked)} />
          <span>Global (all gardens)</span>
        </label>
        {!isGlobal && (
          <div className="mt-4">
            <select value={gardenId} onChange={(e) => setGardenId(e.target.value)}
              className="rounded border border-[var(--color-border)] bg-[var(--color-surface)] px-3 py-1.5 text-sm">
              <option value="">Select garden...</option>
              {gardens.map((g) => <option key={g.id} value={g.id}>{g.display_name}</option>)}
            </select>
          </div>
        )}
      </div>

      <div className="flex gap-2">
        <button onClick={() => onSave({ name: slug || name, display_name: displayName, icon, is_global: isGlobal, garden_id: isGlobal ? undefined : gardenId })}
          disabled={!displayName.trim() || (!isGlobal && !gardenId)}
          className="rounded bg-[var(--color-accent)] px-4 py-1.5 text-sm text-white hover:bg-[var(--color-accent-hover)] disabled:opacity-50">
          Create
        </button>
        <button onClick={onCancel} className="rounded border border-[var(--color-border)] px-4 py-1.5 text-sm hover:bg-[var(--color-surface-hover)]">Cancel</button>
      </div>
    </div>
  );
}
