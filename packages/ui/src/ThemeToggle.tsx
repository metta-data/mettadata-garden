import { useState, useEffect } from "react";

type Theme = "light" | "dark" | "system";

export function ThemeToggle() {
  const [theme, setTheme] = useState<Theme>("system");

  useEffect(() => {
    const stored = localStorage.getItem("theme") as Theme | null;
    if (stored) {
      setTheme(stored);
      applyTheme(stored);
    } else {
      applyTheme("system");
    }
  }, []);

  function applyTheme(t: Theme) {
    const root = document.documentElement;
    if (t === "dark") {
      root.classList.add("dark");
    } else if (t === "light") {
      root.classList.remove("dark");
    } else {
      // System preference
      if (window.matchMedia("(prefers-color-scheme: dark)").matches) {
        root.classList.add("dark");
      } else {
        root.classList.remove("dark");
      }
    }
  }

  function cycle() {
    const next: Theme =
      theme === "light" ? "dark" : theme === "dark" ? "system" : "light";
    setTheme(next);
    localStorage.setItem("theme", next);
    applyTheme(next);
  }

  const icon = theme === "light" ? "\u2600" : theme === "dark" ? "\u263E" : "\u25D1";
  const label =
    theme === "light" ? "Light" : theme === "dark" ? "Dark" : "System";

  return (
    <button
      onClick={cycle}
      className="inline-flex items-center gap-1.5 rounded-md px-2 py-1 text-sm
        text-gray-600 hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-gray-800
        transition-colors"
      aria-label={`Theme: ${label}. Click to change.`}
      title={`Theme: ${label}`}
    >
      <span className="text-base">{icon}</span>
      <span className="hidden sm:inline">{label}</span>
    </button>
  );
}
