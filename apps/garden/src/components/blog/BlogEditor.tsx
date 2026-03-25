import { useState, useEffect } from "react";
import { TiptapEditor } from "../editor/TiptapEditor";
import type { ResolvedUser } from "@mettadata/content-model";

interface BlogEditorProps {
  /** If provided, we're editing an existing post */
  existingSlug?: string;
  existingContent?: string;
  existingFrontmatter?: Record<string, any>;
}

export function BlogEditor({
  existingSlug,
  existingContent,
  existingFrontmatter,
}: BlogEditorProps) {
  const [user, setUser] = useState<ResolvedUser | null>(null);
  const [loading, setLoading] = useState(true);

  const isEdit = !!existingSlug;

  const [title, setTitle] = useState(existingFrontmatter?.title || "");
  const [content, setContent] = useState(existingContent || "");
  const [date, setDate] = useState(
    existingFrontmatter?.date || new Date().toISOString().split("T")[0]
  );
  const [tags, setTags] = useState(
    Array.isArray(existingFrontmatter?.tags)
      ? existingFrontmatter.tags.join(", ")
      : ""
  );
  const [description, setDescription] = useState(
    existingFrontmatter?.description || ""
  );
  const [draft, setDraft] = useState(existingFrontmatter?.draft ?? true);
  const [coverImage, setCoverImage] = useState(
    existingFrontmatter?.coverImage || ""
  );
  const [gardenRefs, setGardenRefs] = useState(
    Array.isArray(existingFrontmatter?.gardenRefs)
      ? existingFrontmatter.gardenRefs.join(", ")
      : ""
  );

  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{
    type: "success" | "error";
    text: string;
  } | null>(null);
  const [showMeta, setShowMeta] = useState(true);

  useEffect(() => {
    fetch("/api/me")
      .then((r) => r.json())
      .then((data) => setUser(data.user || null))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="text-center py-12 text-[var(--color-text-muted)]">
        Loading...
      </div>
    );
  }

  if (!user) {
    return (
      <div className="text-center py-12">
        <p className="text-[var(--color-text-secondary)]">
          Sign in to manage blog posts.
        </p>
      </div>
    );
  }

  const canEdit =
    user.role === "admin" || user.role === "steward";

  if (!canEdit) {
    return (
      <div className="text-center py-12">
        <p className="text-[var(--color-text-secondary)]">
          You don't have permission to manage blog posts.
        </p>
      </div>
    );
  }

  async function handleSave(publishNow?: boolean) {
    if (!title.trim()) {
      setMessage({ type: "error", text: "Title is required" });
      return;
    }

    setSaving(true);
    setMessage(null);

    const isDraft = publishNow !== undefined ? !publishNow : draft;

    const payload = {
      title: title.trim(),
      content,
      description: description.trim() || undefined,
      tags: tags
        .split(",")
        .map((t) => t.trim())
        .filter(Boolean),
      date,
      draft: isDraft,
      gardenRefs: gardenRefs
        .split(",")
        .map((r) => r.trim())
        .filter(Boolean),
      coverImage: coverImage.trim() || undefined,
    };

    try {
      const url = isEdit ? `/api/blog/${existingSlug}` : "/api/blog";
      const method = isEdit ? "PUT" : "POST";

      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(
          isEdit
            ? { content: payload.content, frontmatter: { ...payload, content: undefined } }
            : payload
        ),
      });

      const data = await res.json();

      if (!res.ok) {
        setMessage({ type: "error", text: data.error || "Failed to save" });
        return;
      }

      setMessage({
        type: "success",
        text: isEdit ? "Post updated!" : `Post created: ${data.slug}`,
      });

      if (!isDraft) {
        const slug = isEdit ? existingSlug : data.slug;
        setTimeout(() => {
          window.location.href = `/blog/${slug}`;
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
      <h1 className="text-2xl font-bold mb-6">
        {isEdit ? "Edit Post" : "New Blog Post"}
      </h1>

      <div className="space-y-4">
        {/* Title */}
        <input
          type="text"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="Post title"
          className="w-full rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)]
            px-4 py-3 text-lg font-medium text-[var(--color-text)]
            placeholder:text-[var(--color-text-muted)]
            focus:border-[var(--color-accent)] focus:outline-none"
        />

        {/* Metadata toggle */}
        <button
          onClick={() => setShowMeta(!showMeta)}
          className="text-sm text-[var(--color-text-secondary)] hover:text-[var(--color-text)] transition-colors"
        >
          {showMeta ? "Hide" : "Show"} metadata
        </button>

        {/* Metadata panel */}
        {showMeta && (
          <div className="rounded-lg border border-[var(--color-border)] p-4 space-y-3 bg-[var(--color-surface)]">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-[var(--color-text-secondary)] mb-1.5">
                  Date
                </label>
                <input
                  type="date"
                  value={date}
                  onChange={(e) => setDate(e.target.value)}
                  className="w-full rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)]
                    px-3 py-1.5 text-sm text-[var(--color-text)] focus:border-[var(--color-accent)] focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-[var(--color-text-secondary)] mb-1.5">
                  Tags (comma-separated)
                </label>
                <input
                  type="text"
                  value={tags}
                  onChange={(e) => setTags(e.target.value)}
                  placeholder="meta, technology"
                  className="w-full rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)]
                    px-3 py-1.5 text-sm text-[var(--color-text)] placeholder:text-[var(--color-text-muted)]
                    focus:border-[var(--color-accent)] focus:outline-none"
                />
              </div>

              <div className="md:col-span-2">
                <label className="block text-xs font-medium text-[var(--color-text-secondary)] mb-1.5">
                  Description
                </label>
                <textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Brief excerpt or SEO description (auto-generated if empty)"
                  rows={2}
                  className="w-full rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)]
                    px-3 py-1.5 text-sm text-[var(--color-text)] placeholder:text-[var(--color-text-muted)]
                    focus:border-[var(--color-accent)] focus:outline-none resize-y"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-[var(--color-text-secondary)] mb-1.5">
                  Cover Image URL
                </label>
                <input
                  type="text"
                  value={coverImage}
                  onChange={(e) => setCoverImage(e.target.value)}
                  placeholder="/images/cover.jpg"
                  className="w-full rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)]
                    px-3 py-1.5 text-sm text-[var(--color-text)] placeholder:text-[var(--color-text-muted)]
                    focus:border-[var(--color-accent)] focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-[var(--color-text-secondary)] mb-1.5">
                  Garden References (comma-separated)
                </label>
                <input
                  type="text"
                  value={gardenRefs}
                  onChange={(e) => setGardenRefs(e.target.value)}
                  placeholder="spiritual/stoicism, spiritual/marcus-aurelius"
                  className="w-full rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)]
                    px-3 py-1.5 text-sm text-[var(--color-text)] placeholder:text-[var(--color-text-muted)]
                    focus:border-[var(--color-accent)] focus:outline-none"
                />
              </div>
            </div>

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
        )}

        {/* Editor */}
        <div className="border border-[var(--color-border)] rounded-lg overflow-hidden">
          <TiptapEditor content={content} onChange={setContent} />
        </div>

        {/* Actions */}
        <div className="flex items-center gap-3">
          <button
            onClick={() => handleSave()}
            disabled={saving}
            className={`rounded-lg px-6 py-2.5 text-sm font-medium transition-colors ${
              saving
                ? "bg-gray-400 text-gray-200 cursor-wait"
                : "bg-[var(--color-accent)] text-white hover:bg-[var(--color-accent-hover)]"
            }`}
          >
            {saving ? "Saving..." : draft ? "Save Draft" : "Save"}
          </button>
          {draft && (
            <button
              onClick={() => handleSave(true)}
              disabled={saving}
              className={`rounded-lg px-6 py-2.5 text-sm font-medium transition-colors border
                border-[var(--color-accent)] text-[var(--color-accent)]
                hover:bg-[var(--color-accent)] hover:text-white`}
            >
              Publish
            </button>
          )}
          {message && (
            <span
              className={`text-sm ${
                message.type === "success" ? "text-green-500" : "text-red-500"
              }`}
            >
              {message.text}
            </span>
          )}
        </div>
      </div>
    </div>
  );
}
