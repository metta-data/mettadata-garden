import { useState, useEffect, useRef } from "react";
import type { ResolvedUser } from "@mettadata/content-model";

export function NewNoteButton() {
  const [user, setUser] = useState<ResolvedUser | null>(null);
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    fetch("/api/me")
      .then((r) => r.json())
      .then((data) => setUser(data.user))
      .catch(() => {});
  }, []);

  // Close on click outside
  useEffect(() => {
    if (!open) return;
    function handle(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handle);
    return () => document.removeEventListener("mousedown", handle);
  }, [open]);

  if (!user) return null;

  const isAdmin = user.role === "admin" || user.role === "steward";

  function getNewNoteHref() {
    const scope =
      typeof window !== "undefined"
        ? localStorage.getItem("gardenScope")
        : null;
    return scope ? `/new?garden=${scope}` : "/new";
  }

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen(!open)}
        className="inline-flex items-center gap-1 rounded-md bg-[var(--color-accent)] px-2.5 py-1
          text-sm font-medium text-white hover:bg-[var(--color-accent-hover)] transition-colors"
      >
        <svg
          className="h-3.5 w-3.5"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M12 4v16m8-8H4"
          />
        </svg>
        New
        <svg
          className={`h-3 w-3 ml-0.5 transition-transform ${open ? "rotate-180" : ""}`}
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M19 9l-7 7-7-7"
          />
        </svg>
      </button>

      {open && (
        <div
          className="absolute right-0 mt-1 w-40 rounded-lg border border-[var(--color-border)]
            bg-[var(--color-surface)] shadow-lg py-1 z-50"
        >
          <a
            href={getNewNoteHref()}
            onClick={() => setOpen(false)}
            className="flex items-center gap-2 px-3 py-2 text-sm text-[var(--color-text)]
              hover:bg-[var(--color-surface-hover)] transition-colors"
          >
            <span className="text-base leading-none">&#x1f4dd;</span>
            Note
          </a>
          {isAdmin && (
            <a
              href="/blog/new"
              onClick={() => setOpen(false)}
              className="flex items-center gap-2 px-3 py-2 text-sm text-[var(--color-text)]
                hover:bg-[var(--color-surface-hover)] transition-colors"
            >
              <span className="text-base leading-none">&#x270d;&#xfe0f;</span>
              Blog Post
            </a>
          )}
        </div>
      )}
    </div>
  );
}
