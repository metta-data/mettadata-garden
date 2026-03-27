import { useState, useEffect, useRef, useCallback } from "react";
import { TiptapEditor } from "../editor/TiptapEditor";
import { PropertiesPanel } from "./PropertiesPanel";
import type { ResolvedUser, GardenScope } from "@mettadata/content-model";

interface Props {
  noteSlug: string;
  noteContent: string;
  garden: string;
  noteFrontmatter: Record<string, any>;
}

export function InlineEditor({
  noteSlug,
  noteContent,
  garden,
  noteFrontmatter,
}: Props) {
  const [user, setUser] = useState<ResolvedUser | null>(null);
  const [editing, setEditing] = useState(false);
  const [content, setContent] = useState(noteContent);
  const [frontmatter, setFrontmatter] = useState<Record<string, any>>(noteFrontmatter);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [message, setMessage] = useState("");
  const contentRef = useRef(noteContent);
  contentRef.current = content;
  const frontmatterRef = useRef(noteFrontmatter);
  frontmatterRef.current = frontmatter;

  useEffect(() => {
    fetch("/api/me")
      .then((r) => r.json())
      .then((data) => setUser(data.user))
      .catch(() => {});
  }, []);

  const saveContent = useCallback(async () => {
    await fetch(`/api/notes/${noteSlug}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        content: contentRef.current,
        frontmatter: frontmatterRef.current,
      }),
    });
  }, [noteSlug]);

  const canEdit =
    user?.role === "admin" ||
    (user?.role === "steward" &&
      user.gardens.includes(garden as GardenScope));

  if (!canEdit) return null;

  if (!editing) {
    return (
      <button
        onClick={() => setEditing(true)}
        className="fixed bottom-6 right-6 z-30 inline-flex items-center gap-2 rounded-full
          bg-[var(--color-accent)] px-4 py-2.5 text-sm font-medium text-white
          shadow-lg hover:bg-[var(--color-accent-hover)] transition-colors"
      >
        <svg
          className="h-4 w-4"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"
          />
        </svg>
        Edit
      </button>
    );
  }

  async function handleSave() {
    setSaving(true);
    setMessage("");

    try {
      const res = await fetch(`/api/notes/${noteSlug}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content, frontmatter }),
      });

      const data = await res.json();

      if (!res.ok) {
        setMessage(data.error || "Failed to save");
        return;
      }

      setMessage("Saved!");
      setTimeout(() => window.location.reload(), 1000);
    } catch (err) {
      setMessage(err instanceof Error ? err.message : "Failed to save");
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete() {
    if (!confirm("Move this note to trash?")) return;
    setDeleting(true);
    setMessage("");
    try {
      const res = await fetch(`/api/notes/${garden}/${noteSlug}`, {
        method: "DELETE",
      });
      const data = await res.json();
      if (!res.ok) {
        setMessage(data.error || "Failed to delete");
        return;
      }
      window.location.href = "/garden";
    } catch (err) {
      setMessage(err instanceof Error ? err.message : "Failed to delete");
    } finally {
      setDeleting(false);
    }
  }

  return (
    <div className="mt-6">
      <PropertiesPanel frontmatter={frontmatter} onChange={setFrontmatter} garden={garden} />

      <div className="border border-[var(--color-accent)] rounded-lg overflow-hidden mt-3">
        <TiptapEditor
          content={content}
          onChange={setContent}
          onSaveBeforeNavigate={saveContent}
          currentGarden={garden}
        />
      </div>

      <div className="flex items-center gap-3 mt-3">
        <button
          onClick={handleSave}
          disabled={saving}
          className={`rounded-lg px-5 py-2 text-sm font-medium transition-colors ${
            saving
              ? "bg-gray-400 text-gray-200 cursor-wait"
              : "bg-[var(--color-accent)] text-white hover:bg-[var(--color-accent-hover)]"
          }`}
        >
          {saving ? "Saving..." : "Save"}
        </button>
        <button
          onClick={() => {
            setContent(noteContent);
            setFrontmatter(noteFrontmatter);
            setEditing(false);
          }}
          className="rounded-lg px-5 py-2 text-sm font-medium text-[var(--color-text-secondary)]
            border border-[var(--color-border)] hover:bg-[var(--color-surface-hover)] transition-colors"
        >
          Cancel
        </button>
        <div className="flex-1" />
        <button
          onClick={handleDelete}
          disabled={deleting}
          className="rounded-lg px-5 py-2 text-sm font-medium text-red-600
            border border-red-300 hover:bg-red-50 dark:hover:bg-red-950 transition-colors"
        >
          {deleting ? "Deleting..." : "Delete"}
        </button>
        {message && (
          <span
            className={`text-sm ${message === "Saved!" ? "text-green-500" : "text-red-500"}`}
          >
            {message}
          </span>
        )}
      </div>
    </div>
  );
}
