import { useState, useEffect } from "react";

interface TrashedItem {
  type: "note" | "blog";
  slug: string;
  garden?: string;
  title: string;
  deletedAt: string;
}

export function TrashManager() {
  const [items, setItems] = useState<TrashedItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("");

  async function loadItems() {
    try {
      const res = await fetch("/api/admin/trash");
      const data = await res.json();
      setItems(data.items || []);
    } catch {
      setMessage("Failed to load trash");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadItems();
  }, []);

  async function handleRestore(item: TrashedItem) {
    try {
      const res = await fetch("/api/admin/trash", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "restore",
          type: item.type,
          slug: item.slug,
          garden: item.garden,
        }),
      });
      if (!res.ok) {
        const data = await res.json();
        setMessage(data.error || "Failed to restore");
        return;
      }
      setMessage(`Restored "${item.title}"`);
      loadItems();
    } catch {
      setMessage("Failed to restore");
    }
  }

  async function handleDeletePermanently(item: TrashedItem) {
    if (!confirm(`Permanently delete "${item.title}"? This cannot be undone.`)) return;
    try {
      const res = await fetch("/api/admin/trash", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "empty",
          type: item.type,
          slug: item.slug,
          garden: item.garden,
        }),
      });
      if (!res.ok) {
        const data = await res.json();
        setMessage(data.error || "Failed to delete");
        return;
      }
      setMessage(`Permanently deleted "${item.title}"`);
      loadItems();
    } catch {
      setMessage("Failed to delete");
    }
  }

  async function handleEmptyAll() {
    if (!confirm("Permanently delete all items in trash? This cannot be undone.")) return;
    try {
      const res = await fetch("/api/admin/trash", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "empty" }),
      });
      if (!res.ok) {
        const data = await res.json();
        setMessage(data.error || "Failed to empty trash");
        return;
      }
      setMessage("Trash emptied");
      setItems([]);
    } catch {
      setMessage("Failed to empty trash");
    }
  }

  if (loading) {
    return <p className="text-sm text-[var(--color-text-secondary)]">Loading...</p>;
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <p className="text-sm text-[var(--color-text-secondary)]">
          {items.length} {items.length === 1 ? "item" : "items"} in trash
        </p>
        {items.length > 0 && (
          <button
            onClick={handleEmptyAll}
            className="rounded-lg px-4 py-2 text-sm font-medium text-red-600
              border border-red-300 hover:bg-red-50 dark:hover:bg-red-950 transition-colors"
          >
            Empty Trash
          </button>
        )}
      </div>

      {message && (
        <p className="text-sm mb-4 text-[var(--color-text-secondary)]">{message}</p>
      )}

      {items.length === 0 ? (
        <p className="text-sm text-[var(--color-text-muted)]">Trash is empty.</p>
      ) : (
        <div className="space-y-2">
          {items.map((item) => (
            <div
              key={`${item.type}-${item.garden || ""}-${item.slug}`}
              className="flex items-center justify-between rounded-lg border border-[var(--color-border)]
                bg-[var(--color-surface)] px-4 py-3"
            >
              <div>
                <p className="text-sm font-medium text-[var(--color-text)]">{item.title}</p>
                <p className="text-xs text-[var(--color-text-muted)]">
                  {item.type === "note" ? `Note in ${item.garden}` : "Blog post"}
                  {" · Deleted "}
                  {new Date(item.deletedAt).toLocaleDateString()}
                </p>
              </div>
              <div className="flex gap-2">
                <button
                  onClick={() => handleRestore(item)}
                  className="rounded-lg px-3 py-1.5 text-xs font-medium
                    text-[var(--color-accent)] border border-[var(--color-accent)]
                    hover:bg-[var(--color-accent)] hover:text-white transition-colors"
                >
                  Restore
                </button>
                <button
                  onClick={() => handleDeletePermanently(item)}
                  className="rounded-lg px-3 py-1.5 text-xs font-medium text-red-600
                    border border-red-300 hover:bg-red-50 dark:hover:bg-red-950 transition-colors"
                >
                  Delete
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
