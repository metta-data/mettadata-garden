import { useState, useEffect } from "react";
import type { ResolvedUser } from "@mettadata/content-model";

export function AdminLink() {
  const [user, setUser] = useState<ResolvedUser | null>(null);

  useEffect(() => {
    fetch("/api/me")
      .then((r) => r.json())
      .then((data) => setUser(data.user))
      .catch(() => {});
  }, []);

  if (!user || user.role !== "admin") return null;

  return (
    <a
      href="/admin"
      className="text-sm text-[var(--color-text-secondary)] hover:text-[var(--color-text)] transition-colors"
    >
      Admin
    </a>
  );
}
