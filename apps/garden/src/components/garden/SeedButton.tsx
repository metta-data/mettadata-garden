import { useState, useEffect } from "react";
import type { ResolvedUser, GardenScope } from "@mettadata/content-model";

interface Props {
  noteSlug: string;
  noteTitle: string;
  isSeeded: boolean;
  garden: string;
}

export function SeedButton({ noteSlug, noteTitle, isSeeded, garden }: Props) {
  const [user, setUser] = useState<ResolvedUser | null>(null);
  const [status, setStatus] = useState<"idle" | "loading" | "success" | "error">("idle");
  const [errorMsg, setErrorMsg] = useState("");

  useEffect(() => {
    fetch("/api/me")
      .then((r) => r.json())
      .then((data) => setUser(data.user))
      .catch(() => {});
  }, []);

  // Check if user can seed this note
  const canSeed =
    user?.role === "admin" ||
    (user?.role === "steward" &&
      user.gardens.includes(garden as GardenScope));

  if (!canSeed) return null;
  if (isSeeded && user?.role !== "admin") return null;

  async function handleSeed() {
    setStatus("loading");
    setErrorMsg("");

    try {
      const response = await fetch("/api/seed", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          slug: noteSlug,
          force: isSeeded,
        }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || `Failed (${response.status})`);
      }

      setStatus("success");
      setTimeout(() => window.location.reload(), 1500);
    } catch (err) {
      setStatus("error");
      setErrorMsg(err instanceof Error ? err.message : "Unknown error");
    }
  }

  return (
    <div className="mt-6 flex items-center gap-3">
      <button
        onClick={handleSeed}
        disabled={status === "loading"}
        className={`inline-flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium transition-colors
          ${status === "loading"
            ? "bg-gray-300 text-gray-500 dark:bg-gray-700 dark:text-gray-400 cursor-wait"
            : status === "success"
              ? "bg-green-600 text-white"
              : "bg-[var(--color-accent)] text-white hover:bg-[var(--color-accent-hover)]"
          }`}
      >
        {status === "loading" ? (
          <>
            <span className="animate-spin">&#9696;</span>
            Seeding...
          </>
        ) : status === "success" ? (
          <>&#10003; Seeded!</>
        ) : isSeeded ? (
          <>&#8635; Re-seed with AI</>
        ) : (
          <>&#127793; Seed with AI</>
        )}
      </button>

      {status === "error" && (
        <span className="text-sm text-red-500">{errorMsg}</span>
      )}

      {!isSeeded && status === "idle" && (
        <span className="text-xs text-[var(--color-text-muted)]">
          Generate a Wikipedia-style lead section for "{noteTitle}"
        </span>
      )}
    </div>
  );
}
