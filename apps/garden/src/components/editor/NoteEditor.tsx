import { useState, useEffect } from "react";
import { TiptapEditor } from "./TiptapEditor";
import type { ResolvedUser } from "@mettadata/content-model";

const STAGES = ["seed", "sprout", "sapling", "evergreen"] as const;

interface GardenOption {
  name: string;
  display_name: string;
  icon: string;
}

interface TemplateOption {
  name: string;
  description?: string;
  source: string;
}

function getInitialGarden(gardens: GardenOption[]): string {
  if (typeof window === "undefined") return "private";
  const urlParams = new URLSearchParams(window.location.search);
  const fromUrl = urlParams.get("garden");
  if (fromUrl && gardens.some((g) => g.name === fromUrl)) return fromUrl;
  const fromStorage = localStorage.getItem("gardenScope");
  if (fromStorage && gardens.some((g) => g.name === fromStorage)) return fromStorage;
  return "private";
}

export function NoteEditor() {
  const [user, setUser] = useState<ResolvedUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [availableGardens, setAvailableGardens] = useState<GardenOption[]>([]);

  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [garden, setGarden] = useState<string>("private");
  const [tags, setTags] = useState("");
  const [stage, setStage] = useState<string>("seed");
  const [publish, setPublish] = useState(false);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

  // Folders
  const [folders, setFolders] = useState<Array<{ name: string; display_name: string; icon: string }>>([]);
  const [folder, setFolder] = useState<string>("");

  // Templates
  const [templates, setTemplates] = useState<TemplateOption[]>([]);
  const [selectedTemplate, setSelectedTemplate] = useState<string>("");
  const [editorKey, setEditorKey] = useState(0);
  const [templateProperties, setTemplateProperties] = useState<Record<string, any>>({});

  useEffect(() => {
    Promise.all([
      fetch("/api/me").then((r) => r.json()),
      fetch("/api/gardens").then((r) => r.json()),
    ])
      .then(([meData, gardensData]) => {
        setUser(meData.user || null);
        const gardenList = (gardensData.gardens || []).map((g: any) => ({
          name: g.name,
          display_name: g.display_name,
          icon: g.icon || "",
        }));
        setAvailableGardens(gardenList);
        setGarden(getInitialGarden(gardenList));
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  // Fetch templates and folders when garden changes
  useEffect(() => {
    if (!garden) return;
    Promise.all([
      fetch(`/api/templates?garden=${garden}`).then((r) => r.json()),
      fetch(`/api/folders?garden=${garden}`).then((r) => r.json()),
    ]).then(([tmplData, folderData]) => {
      setTemplates(tmplData.templates || []);
      setFolders(folderData.folders || []);
      setFolder("");
    }).catch(() => {
      setTemplates([]);
      setFolders([]);
    });
  }, [garden]);

  async function handleTemplateSelect(templateName: string) {
    setSelectedTemplate(templateName);
    if (!templateName || !garden) return;

    // Fetch processed template body and populate the editor
    try {
      const res = await fetch("/api/apply-template", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          garden,
          template: templateName,
          title: title || "",
          folder: folder || "",
        }),
      });
      if (res.ok) {
        const data = await res.json();
        if (data.body) {
          setContent(data.body);
          setEditorKey((k) => k + 1); // Force editor to remount with new content
        }
        // Apply template properties to form fields
        if (data.properties) {
          const p = data.properties;
          if (p.tags) setTags(Array.isArray(p.tags) ? p.tags.join(", ") : p.tags);
          if (p.stage) setStage(p.stage);
          if (p.publish !== undefined) setPublish(!!p.publish);
          // Any other properties are stored for inclusion in the save payload
          setTemplateProperties(p);
        }
      }
    } catch {}
  }

  if (loading) {
    return <div className="text-center py-12 text-[var(--color-text-muted)]">Loading...</div>;
  }

  if (!user) {
    return (
      <div className="text-center py-12">
        <p className="text-[var(--color-text-secondary)]">Sign in to create notes.</p>
      </div>
    );
  }

  async function handleSave() {
    if (!title.trim()) {
      setMessage({ type: "error", text: "Title is required" });
      return;
    }
    if (!garden) {
      setMessage({ type: "error", text: "Select a garden" });
      return;
    }

    setSaving(true);
    setMessage(null);

    try {
      const res = await fetch("/api/notes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: title.trim(),
          content,
          garden,
          tags: tags.split(",").map((t) => t.trim()).filter(Boolean),
          stage,
          publish,
          folder: folder || undefined,
          template: selectedTemplate || undefined,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        setMessage({ type: "error", text: data.error || "Failed to save" });
        return;
      }

      setMessage({ type: "success", text: `Note created: ${data.slug}` });

      if (data.path && publish && garden !== "private") {
        setTimeout(() => {
          window.location.href = data.path;
        }, 1500);
      }
    } catch (err) {
      setMessage({
        type: "error",
        text: err instanceof Error ? err.message : "Failed to save",
      });
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="max-w-4xl mx-auto">
      <h1 className="text-2xl font-bold mb-6">New Note</h1>

      <div className="space-y-4">
        <input
          type="text"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="Note title"
          className="w-full rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)]
            px-4 py-3 text-lg font-medium text-[var(--color-text)]
            placeholder:text-[var(--color-text-muted)]
            focus:border-[var(--color-accent)] focus:outline-none"
        />

        {/* Metadata row */}
        <div className="flex flex-wrap gap-4">
          <div>
            <label className="block text-xs font-medium text-[var(--color-text-secondary)] mb-1.5">Garden</label>
            <select
              value={garden}
              onChange={(e) => {
                setGarden(e.target.value);
                setSelectedTemplate("");
              }}
              className="rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)]
                px-3 py-1.5 text-sm text-[var(--color-text)] focus:border-[var(--color-accent)] focus:outline-none"
            >
              {availableGardens.map((g) => (
                <option key={g.name} value={g.name}>
                  {g.icon ? `${g.icon} ` : ""}{g.display_name}
                </option>
              ))}
            </select>
          </div>

          {folders.length > 0 && (
            <div>
              <label className="block text-xs font-medium text-[var(--color-text-secondary)] mb-1.5">Folder</label>
              <select
                value={folder}
                onChange={(e) => setFolder(e.target.value)}
                className="rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)]
                  px-3 py-1.5 text-sm text-[var(--color-text)] focus:border-[var(--color-accent)] focus:outline-none"
              >
                <option value="">(root)</option>
                {folders.map((f) => (
                  <option key={f.name} value={f.name}>
                    {f.icon ? `${f.icon} ` : ""}{f.display_name}
                  </option>
                ))}
              </select>
            </div>
          )}

          <div>
            <label className="block text-xs font-medium text-[var(--color-text-secondary)] mb-1.5">Stage</label>
            <select
              value={stage}
              onChange={(e) => setStage(e.target.value)}
              className="rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)]
                px-3 py-1.5 text-sm text-[var(--color-text)] focus:border-[var(--color-accent)] focus:outline-none"
            >
              {STAGES.map((s) => (
                <option key={s} value={s}>{s.charAt(0).toUpperCase() + s.slice(1)}</option>
              ))}
            </select>
          </div>

          {templates.length > 0 && (
            <div>
              <label className="block text-xs font-medium text-[var(--color-text-secondary)] mb-1.5">Template</label>
              <select
                value={selectedTemplate}
                onChange={(e) => handleTemplateSelect(e.target.value)}
                className="rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)]
                  px-3 py-1.5 text-sm text-[var(--color-text)] focus:border-[var(--color-accent)] focus:outline-none"
              >
                <option value="">None</option>
                {templates.map((t) => (
                  <option key={t.name} value={t.name}>
                    {t.name}{t.description ? ` — ${t.description}` : ""}
                  </option>
                ))}
              </select>
            </div>
          )}

          <div className="flex-1 min-w-[200px]">
            <label className="block text-xs font-medium text-[var(--color-text-secondary)] mb-1.5">Tags (comma-separated)</label>
            <input
              type="text"
              value={tags}
              onChange={(e) => setTags(e.target.value)}
              placeholder="philosophy, stoicism"
              className="w-full rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)]
                px-3 py-1.5 text-sm text-[var(--color-text)] placeholder:text-[var(--color-text-muted)]
                focus:border-[var(--color-accent)] focus:outline-none"
            />
          </div>

          <div className="flex items-end pb-0.5">
            <label className="flex items-center gap-2 text-sm cursor-pointer">
              <input type="checkbox" checked={publish} onChange={(e) => setPublish(e.target.checked)} className="rounded" />
              <span className="text-[var(--color-text-secondary)]">Publish</span>
            </label>
          </div>
        </div>

        {/* Editor */}
        <div className="border border-[var(--color-border)] rounded-lg overflow-hidden">
          <TiptapEditor key={editorKey} content={content} onChange={setContent} currentGarden={garden} />
        </div>

        {/* Actions */}
        <div className="flex items-center gap-3">
          <button
            onClick={handleSave}
            disabled={saving}
            className={`rounded-lg px-6 py-2.5 text-sm font-medium transition-colors ${
              saving
                ? "bg-gray-400 text-gray-200 cursor-wait"
                : "bg-[var(--color-accent)] text-white hover:bg-[var(--color-accent-hover)]"
            }`}
          >
            {saving ? "Saving..." : "Save Note"}
          </button>
          {message && (
            <span className={`text-sm ${message.type === "success" ? "text-green-500" : "text-red-500"}`}>
              {message.text}
            </span>
          )}
        </div>
      </div>
    </div>
  );
}
