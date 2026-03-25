import { useState, useEffect } from "react";

interface GardenOption {
  name: string;
  display_name: string;
  icon?: string;
}

interface GardenSelectorProps {
  current?: string;
  gardens: GardenOption[];
}

export function GardenSelector({ current, gardens }: GardenSelectorProps) {
  const [selected, setSelected] = useState<string | undefined>(current);

  // Sync to localStorage whenever selection changes
  useEffect(() => {
    if (selected) {
      localStorage.setItem("gardenScope", selected);
    } else {
      localStorage.removeItem("gardenScope");
    }
  }, [selected]);

  function handleSelect(garden: string | undefined) {
    setSelected(garden);
    const url = new URL(window.location.href);
    if (garden) {
      url.searchParams.set("scope", garden);
    } else {
      url.searchParams.delete("scope");
    }
    window.location.href = url.toString();
  }

  return (
    <div className="flex items-center gap-1.5 flex-wrap">
      <button
        onClick={() => handleSelect(undefined)}
        className={`rounded-full px-3 py-1 text-sm font-medium transition-colors ${
          !selected
            ? "bg-[var(--color-text)] text-[var(--color-bg)]"
            : "text-[var(--color-text-secondary)] hover:bg-[var(--color-surface-hover)]"
        }`}
      >
        All
      </button>
      {gardens.map((g) => {
        const isActive = selected === g.name;
        return (
          <button
            key={g.name}
            onClick={() => handleSelect(g.name)}
            className={`rounded-full px-3 py-1 text-sm font-medium transition-colors ${
              isActive
                ? "bg-[var(--color-accent)] text-white"
                : "text-[var(--color-text-secondary)] hover:bg-[var(--color-surface-hover)]"
            }`}
          >
            {g.icon && <span className="mr-1">{g.icon}</span>}
            {g.display_name}
          </button>
        );
      })}
    </div>
  );
}
