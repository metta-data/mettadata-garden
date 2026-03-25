import { useState } from "react";

interface TodayButtonProps {
  garden: string;
}

export function TodayButton({ garden }: TodayButtonProps) {
  const [loading, setLoading] = useState(false);

  async function handleClick() {
    setLoading(true);
    try {
      const res = await fetch("/api/daily-note", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ garden }),
      });
      if (res.ok) {
        const data = await res.json();
        if (data.path) window.location.href = data.path;
      }
    } catch {}
    setLoading(false);
  }

  return (
    <button
      onClick={handleClick}
      disabled={loading}
      className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-medium transition-colors
        ${loading
          ? "bg-gray-300 text-gray-500 cursor-wait"
          : "bg-[var(--color-accent)] text-white hover:bg-[var(--color-accent-hover)]"
        }`}
    >
      {loading ? "Creating..." : "📝 Today's Note"}
    </button>
  );
}
