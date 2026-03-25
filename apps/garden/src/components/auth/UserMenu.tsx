import { useState, useEffect } from "react";
import type { ResolvedUser } from "@mettadata/content-model";

export function UserMenu() {
  const [user, setUser] = useState<ResolvedUser | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/me")
      .then((r) => r.json())
      .then((data) => setUser(data.user))
      .catch(() => setUser(null))
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <span className="inline-block h-8 w-16 animate-pulse rounded-md bg-[var(--color-bg-secondary)]" />
    );
  }

  if (!user) {
    return (
      <button
        onClick={async () => {
          try {
            const res = await fetch("/api/auth/sign-in/social", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                provider: "google",
                callbackURL: window.location.pathname,
              }),
            });
            const text = await res.text();
            if (!text) return;
            const data = JSON.parse(text);
            if (data.url) {
              window.location.href = data.url;
            }
          } catch (err) {
            console.error("Sign-in failed:", err);
          }
        }}
        className="inline-flex items-center gap-1.5 rounded-md border border-[var(--color-border)]
          px-3 py-1.5 text-sm text-[var(--color-text-secondary)]
          hover:bg-[var(--color-surface-hover)] transition-colors"
      >
        <svg className="h-4 w-4" viewBox="0 0 24 24" fill="currentColor">
          <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 3c1.66 0 3 1.34 3 3s-1.34 3-3 3-3-1.34-3-3 1.34-3 3-3zm0 14.2c-2.5 0-4.71-1.28-6-3.22.03-1.99 4-3.08 6-3.08 1.99 0 5.97 1.09 6 3.08-1.29 1.94-3.5 3.22-6 3.22z" />
        </svg>
        Sign in
      </button>
    );
  }

  return (
    <div className="flex items-center gap-2">
      <span
        className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${
          user.role === "admin"
            ? "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300"
            : "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300"
        }`}
      >
        {user.role}
      </span>
      {user.image ? (
        <img
          src={user.image}
          alt={user.name}
          className="h-7 w-7 rounded-full"
          referrerPolicy="no-referrer"
        />
      ) : (
        <span className="flex h-7 w-7 items-center justify-center rounded-full bg-[var(--color-accent)] text-xs text-white font-medium">
          {user.name.charAt(0).toUpperCase()}
        </span>
      )}
      <button
        onClick={async () => {
          try {
            await fetch("/api/auth/sign-out", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: "{}",
              redirect: "manual",
            });
          } catch {
            // Server may have restarted — session is already gone
          }
          window.location.href = "/";
        }}
        className="text-xs text-[var(--color-text-muted)] hover:text-[var(--color-text-secondary)] transition-colors"
        title="Sign out"
      >
        Sign out
      </button>
    </div>
  );
}
