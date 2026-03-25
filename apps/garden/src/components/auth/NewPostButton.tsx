import { useState, useEffect } from "react";
import type { ResolvedUser } from "@mettadata/content-model";

export function NewPostButton() {
  const [user, setUser] = useState<ResolvedUser | null>(null);

  useEffect(() => {
    fetch("/api/me")
      .then((r) => r.json())
      .then((data) => setUser(data.user))
      .catch(() => {});
  }, []);

  if (!user || (user.role !== "admin" && user.role !== "steward")) return null;

  return (
    <a
      href="/blog/new"
      className="inline-flex items-center gap-1 rounded-md border border-[var(--color-border)]
        bg-[var(--color-surface)] px-2.5 py-1 text-sm font-medium
        text-[var(--color-text-secondary)] hover:bg-[var(--color-surface-hover)] transition-colors"
    >
      <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
      </svg>
      Post
    </a>
  );
}
