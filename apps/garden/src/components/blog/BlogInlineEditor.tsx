import { useState, useEffect, useRef, useCallback } from "react";
import { TiptapEditor } from "../editor/TiptapEditor";
import type { ResolvedUser } from "@mettadata/content-model";

interface Props {
  postSlug: string;
  postContent: string;
  postFrontmatter: Record<string, any>;
}

export function BlogInlineEditor({
  postSlug,
  postContent,
  postFrontmatter,
}: Props) {
  const [user, setUser] = useState<ResolvedUser | null>(null);
  const [editing, setEditing] = useState(false);
  const [content, setContent] = useState(postContent);
  const [frontmatter, setFrontmatter] = useState<Record<string, any>>(postFrontmatter);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [message, setMessage] = useState("");
  const contentRef = useRef(postContent);
  contentRef.current = content;
  const frontmatterRef = useRef(postFrontmatter);
  frontmatterRef.current = frontmatter;

  // Local form state for metadata
  const [tags, setTags] = useState(
    Array.isArray(postFrontmatter.tags) ? postFrontmatter.tags.join(", ") : ""
  );
  const [description, setDescription] = useState(postFrontmatter.description || "");
  const [draft, setDraft] = useState(postFrontmatter.draft ?? false);
  const [gardenRefs, setGardenRefs] = useState(
    Array.isArray(postFrontmatter.gardenRefs) ? postFrontmatter.gardenRefs.join(", ") : ""
  );
  const [coverImage, setCoverImage] = useState(postFrontmatter.coverImage || "");

  useEffect(() => {
    fetch("/api/me")
      .then((r) => r.json())
      .then((data) => setUser(data.user))
      .catch(() => {});
  }, []);

  const canEdit =
    user?.role === "admin" || user?.role === "steward";

  if (!canEdit) return null;

  if (!editing) {
    return (
      <div className="fixed bottom-6 right-6 z-30 flex gap-2">
        <button
          onClick={() => setEditing(true)}
          className="inline-flex items-center gap-2 rounded-full
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
        <a
          href={`/blog/edit/${postSlug}`}
          className="inline-flex items-center gap-2 rounded-full
            border border-[var(--color-border)] bg-[var(--color-surface)] px-4 py-2.5 text-sm font-medium
            text-[var(--color-text-secondary)] shadow-lg hover:bg-[var(--color-surface-hover)] transition-colors"
        >
          Full Editor
        </a>
      </div>
    );
  }

  async function handleSave() {
    setSaving(true);
    setMessage("");

    const updatedFm = {
      ...frontmatter,
      tags: tags.split(",").map((t) => t.trim()).filter(Boolean),
      description: description.trim(),
      draft,
      gardenRefs: gardenRefs.split(",").map((r) => r.trim()).filter(Boolean),
      coverImage: coverImage.trim() || undefined,
    };

    try {
      const res = await fetch(`/api/blog/${postSlug}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content, frontmatter: updatedFm }),
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
    if (!confirm("Move this post to trash?")) return;
    setDeleting(true);
    setMessage("");
    try {
      const res = await fetch(`/api/blog/${postSlug}`, {
        method: "DELETE",
      });
      const data = await res.json();
      if (!res.ok) {
        setMessage(data.error || "Failed to delete");
        return;
      }
      window.location.href = "/blog";
    } catch (err) {
      setMessage(err instanceof Error ? err.message : "Failed to delete");
    } finally {
      setDeleting(false);
    }
  }

  return (
    <div className="mt-6">
      {/* Metadata panel */}
      <details className="mb-3 rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)]">
        <summary className="cursor-pointer px-4 py-2 text-sm font-medium text-[var(--color-text-secondary)]">
          Post Metadata
        </summary>
        <div className="px-4 pb-4 pt-2 space-y-3">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-[var(--color-text-secondary)] mb-1">Tags</label>
              <input
                type="text"
                value={tags}
                onChange={(e) => setTags(e.target.value)}
                className="w-full rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)]
                  px-3 py-1.5 text-sm text-[var(--color-text)] focus:border-[var(--color-accent)] focus:outline-none"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-[var(--color-text-secondary)] mb-1">Garden Refs</label>
              <input
                type="text"
                value={gardenRefs}
                onChange={(e) => setGardenRefs(e.target.value)}
                className="w-full rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)]
                  px-3 py-1.5 text-sm text-[var(--color-text)] focus:border-[var(--color-accent)] focus:outline-none"
              />
            </div>
            <div className="md:col-span-2">
              <label className="block text-xs font-medium text-[var(--color-text-secondary)] mb-1">Description</label>
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={2}
                className="w-full rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)]
                  px-3 py-1.5 text-sm text-[var(--color-text)] focus:border-[var(--color-accent)] focus:outline-none resize-y"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-[var(--color-text-secondary)] mb-1">Cover Image</label>
              <input
                type="text"
                value={coverImage}
                onChange={(e) => setCoverImage(e.target.value)}
                className="w-full rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)]
                  px-3 py-1.5 text-sm text-[var(--color-text)] focus:border-[var(--color-accent)] focus:outline-none"
              />
            </div>
            <div className="flex items-end pb-0.5">
              <label className="flex items-center gap-2 text-sm cursor-pointer">
                <input
                  type="checkbox"
                  checked={draft}
                  onChange={(e) => setDraft(e.target.checked)}
                  className="rounded"
                />
                <span className="text-[var(--color-text-secondary)]">Draft</span>
              </label>
            </div>
          </div>
        </div>
      </details>

      <div className="border border-[var(--color-accent)] rounded-lg overflow-hidden">
        <TiptapEditor content={content} onChange={setContent} />
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
            setContent(postContent);
            setFrontmatter(postFrontmatter);
            setTags(Array.isArray(postFrontmatter.tags) ? postFrontmatter.tags.join(", ") : "");
            setDescription(postFrontmatter.description || "");
            setDraft(postFrontmatter.draft ?? false);
            setGardenRefs(Array.isArray(postFrontmatter.gardenRefs) ? postFrontmatter.gardenRefs.join(", ") : "");
            setCoverImage(postFrontmatter.coverImage || "");
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
