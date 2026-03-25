import { useState, useEffect, useCallback } from "react";

interface Page {
  slug: string;
  meta: {
    title: string;
    description?: string;
    nav_order?: number;
    nav_label?: string;
    draft?: boolean;
  };
  html: string;
}

export function PageManager() {
  const [pages, setPages] = useState<Page[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

  const fetchPages = useCallback(async () => {
    try {
      const res = await fetch("/api/admin/pages");
      const data = await res.json();
      setPages(data.pages || []);
    } catch {
      setMessage({ type: "error", text: "Failed to load pages" });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchPages();
  }, [fetchPages]);

  function flash(type: "success" | "error", text: string) {
    setMessage({ type, text });
    setTimeout(() => setMessage(null), 3000);
  }

  async function handleCreate(form: CreateForm) {
    const res = await fetch("/api/admin/pages", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(form),
    });
    const data = await res.json();
    if (!res.ok) {
      flash("error", data.error || "Failed to create page");
      return;
    }
    flash("success", `Page "${form.slug}" created`);
    setCreating(false);
    fetchPages();
  }

  async function handleUpdate(slug: string, updates: any) {
    const res = await fetch("/api/admin/pages", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ slug, ...updates }),
    });
    const data = await res.json();
    if (!res.ok) {
      flash("error", data.error || "Failed to update page");
      return;
    }
    flash("success", "Page updated");
    setEditing(null);
    fetchPages();
  }

  async function handleDelete(slug: string) {
    if (!confirm(`Delete page "${slug}"? This cannot be undone.`)) return;
    const res = await fetch("/api/admin/pages", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ slug }),
    });
    const data = await res.json();
    if (!res.ok) {
      flash("error", data.error || "Failed to delete page");
      return;
    }
    flash("success", `Page "${slug}" deleted`);
    fetchPages();
  }

  if (loading) {
    return <div className="text-center py-12 text-[var(--color-text-muted)]">Loading...</div>;
  }

  return (
    <div className="max-w-4xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold">Manage Pages</h1>
        <button
          onClick={() => setCreating(true)}
          className="rounded-lg bg-[var(--color-accent)] px-4 py-2 text-sm font-medium text-white
            hover:bg-[var(--color-accent-hover)] transition-colors"
        >
          + New Page
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
        <PageForm
          mode="create"
          onSave={handleCreate}
          onCancel={() => setCreating(false)}
        />
      )}

      {pages.length === 0 && !creating && (
        <div className="text-center py-12 text-[var(--color-text-muted)]">
          <p>No pages yet. Create one to get started.</p>
        </div>
      )}

      <div className="space-y-2">
        {pages.map((page) => (
          <div
            key={page.slug}
            className="rounded-lg border border-[var(--color-border)] p-4"
          >
            {editing === page.slug ? (
              <PageForm
                mode="edit"
                page={page}
                onSave={(updates) => handleUpdate(page.slug, updates)}
                onCancel={() => setEditing(null)}
              />
            ) : (
              <div className="flex items-center gap-4">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="font-medium">{page.meta.title}</span>
                    <span className="text-xs text-[var(--color-text-muted)]">/{page.slug}</span>
                    {page.meta.draft && (
                      <span className="text-xs bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200 px-1.5 py-0.5 rounded">
                        Draft
                      </span>
                    )}
                    {page.meta.nav_order !== undefined && (
                      <span className="text-xs bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200 px-1.5 py-0.5 rounded">
                        Nav #{page.meta.nav_order}
                      </span>
                    )}
                  </div>
                  {page.meta.description && (
                    <p className="text-sm text-[var(--color-text-secondary)] truncate">{page.meta.description}</p>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  <a
                    href={`/${page.slug}`}
                    target="_blank"
                    rel="noopener"
                    className="text-xs text-[var(--color-text-secondary)] hover:text-[var(--color-text)] px-2 py-1 rounded border border-[var(--color-border)]"
                  >
                    View
                  </a>
                  <button
                    onClick={() => setEditing(page.slug)}
                    className="text-xs text-[var(--color-accent)] hover:underline px-2 py-1"
                  >
                    Edit
                  </button>
                  <button
                    onClick={() => handleDelete(page.slug)}
                    className="text-xs text-red-500 hover:underline px-2 py-1"
                  >
                    Delete
                  </button>
                </div>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

/* ── Form ──────────────────────────────────── */

interface CreateForm {
  slug: string;
  title: string;
  description: string;
  nav_order: string;
  nav_label: string;
  draft: boolean;
  html: string;
}

function PageForm({
  mode,
  page,
  onSave,
  onCancel,
}: {
  mode: "create" | "edit";
  page?: Page;
  onSave: (form: any) => void;
  onCancel: () => void;
}) {
  const [slug, setSlug] = useState(page?.slug || "");
  const [title, setTitle] = useState(page?.meta.title || "");
  const [description, setDescription] = useState(page?.meta.description || "");
  const [navOrder, setNavOrder] = useState(page?.meta.nav_order?.toString() || "");
  const [navLabel, setNavLabel] = useState(page?.meta.nav_label || "");
  const [draft, setDraft] = useState(page?.meta.draft || false);
  const [html, setHtml] = useState(page?.html || "");
  const [uploadName, setUploadName] = useState("");

  function handleFileUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadName(file.name);
    const reader = new FileReader();
    reader.onload = () => {
      const content = reader.result as string;
      setHtml(content);
      // Auto-fill slug from filename if empty
      if (!slug) {
        setSlug(file.name.replace(/\.html?$/, "").toLowerCase().replace(/[^a-z0-9/-]+/g, "-"));
      }
      // Auto-fill title from filename if empty
      if (!title) {
        const name = file.name.replace(/\.html?$/, "");
        setTitle(name.charAt(0).toUpperCase() + name.slice(1).replace(/-/g, " "));
      }
    };
    reader.readAsText(file);
  }

  return (
    <div className={mode === "create" ? "mb-6 rounded-lg border border-[var(--color-accent)] p-4 space-y-3" : "space-y-3"}>
      <h3 className="font-medium">{mode === "create" ? "Create New Page" : "Edit Page"}</h3>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block text-xs font-medium text-[var(--color-text-secondary)] mb-1">Title</label>
          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="About"
            className="w-full rounded border border-[var(--color-border)] bg-[var(--color-surface)] px-3 py-1.5 text-sm"
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-[var(--color-text-secondary)] mb-1">
            Slug {mode === "edit" && <span className="text-[var(--color-text-muted)]">(read-only)</span>}
          </label>
          <input
            type="text"
            value={slug}
            onChange={(e) => setSlug(e.target.value)}
            readOnly={mode === "edit"}
            placeholder="about"
            className={`w-full rounded border border-[var(--color-border)] px-3 py-1.5 text-sm ${
              mode === "edit" ? "bg-[var(--color-bg-secondary)] text-[var(--color-text-muted)]" : "bg-[var(--color-surface)]"
            }`}
          />
        </div>
      </div>

      <div>
        <label className="block text-xs font-medium text-[var(--color-text-secondary)] mb-1">Description</label>
        <input
          type="text"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="Page description for SEO"
          className="w-full rounded border border-[var(--color-border)] bg-[var(--color-surface)] px-3 py-1.5 text-sm"
        />
      </div>

      <div className="grid grid-cols-3 gap-3">
        <div>
          <label className="block text-xs font-medium text-[var(--color-text-secondary)] mb-1">Nav Order</label>
          <input
            type="text"
            value={navOrder}
            onChange={(e) => setNavOrder(e.target.value)}
            placeholder="Empty = hidden"
            className="w-full rounded border border-[var(--color-border)] bg-[var(--color-surface)] px-3 py-1.5 text-sm"
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-[var(--color-text-secondary)] mb-1">Nav Label</label>
          <input
            type="text"
            value={navLabel}
            onChange={(e) => setNavLabel(e.target.value)}
            placeholder="Defaults to title"
            className="w-full rounded border border-[var(--color-border)] bg-[var(--color-surface)] px-3 py-1.5 text-sm"
          />
        </div>
        <div className="flex items-end pb-0.5">
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={draft} onChange={(e) => setDraft(e.target.checked)} />
            <span>Draft</span>
          </label>
        </div>
      </div>

      <div>
        <label className="block text-xs font-medium text-[var(--color-text-secondary)] mb-1">
          HTML Content
        </label>
        <div className="flex items-center gap-3 mb-2">
          <label className="cursor-pointer rounded border border-[var(--color-border)] px-3 py-1.5 text-sm hover:bg-[var(--color-surface-hover)] transition-colors">
            Upload HTML file
            <input
              type="file"
              accept=".html,.htm"
              onChange={handleFileUpload}
              className="hidden"
            />
          </label>
          {uploadName && (
            <span className="text-xs text-[var(--color-text-muted)]">{uploadName}</span>
          )}
        </div>
        <textarea
          value={html}
          onChange={(e) => setHtml(e.target.value)}
          rows={12}
          placeholder="<h1>Page Title</h1>\n<p>Your HTML content here...</p>"
          className="w-full rounded border border-[var(--color-border)] bg-[var(--color-surface)] px-3 py-2 text-sm font-mono"
        />
      </div>

      <div className="flex gap-2">
        <button
          onClick={() => onSave({
            slug,
            title,
            description,
            nav_order: navOrder,
            nav_label: navLabel,
            draft,
            html,
          })}
          disabled={!title.trim() || (mode === "create" && !slug.trim())}
          className="rounded bg-[var(--color-accent)] px-4 py-1.5 text-sm text-white hover:bg-[var(--color-accent-hover)] disabled:opacity-50"
        >
          {mode === "create" ? "Create" : "Save"}
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
