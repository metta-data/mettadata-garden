import { useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import type { NoteMatch } from "./useNoteList";

const GARDEN_BADGE_COLORS: Record<string, string> = {
  professional: "#2563eb",
  spiritual: "#9333ea",
  academic: "#d97706",
  private: "#6b7280",
};

interface WikilinkAutocompleteProps {
  items: NoteMatch[];
  selectedIndex: number;
  coords: { top: number; left: number };
  onSelect: (item: NoteMatch) => void;
}

export function WikilinkAutocomplete({
  items,
  selectedIndex,
  coords,
  onSelect,
}: WikilinkAutocompleteProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const selectedRef = useRef<HTMLButtonElement>(null);

  // Scroll selected item into view
  useEffect(() => {
    selectedRef.current?.scrollIntoView({ block: "nearest" });
  }, [selectedIndex]);

  if (items.length === 0) return null;

  // Clamp position to viewport
  const top = Math.min(coords.top + 4, window.innerHeight - 250);
  const left = Math.min(coords.left, window.innerWidth - 280);

  return createPortal(
    <div
      ref={containerRef}
      className="wikilink-autocomplete"
      style={{
        position: "fixed",
        top: `${top}px`,
        left: `${left}px`,
        zIndex: 50,
      }}
    >
      {items.map((item, i) => (
        <button
          key={`${item.garden}/${item.slug}`}
          ref={i === selectedIndex ? selectedRef : undefined}
          className={`wikilink-autocomplete-item ${
            i === selectedIndex ? "active" : ""
          }`}
          onMouseDown={(e) => {
            e.preventDefault(); // Don't steal focus from editor
            onSelect(item);
          }}
          onMouseEnter={() => {
            // Visual hover handled by CSS, no state change needed
          }}
        >
          <span className="wikilink-autocomplete-title">{item.title}</span>
          {item.matchedAlias && (
            <span className="wikilink-autocomplete-alias">
              ({item.matchedAlias})
            </span>
          )}
          {item.garden && (
            <span
              className="wikilink-autocomplete-garden"
              style={{
                marginLeft: "auto",
                fontSize: "0.65rem",
                padding: "1px 5px",
                borderRadius: "3px",
                backgroundColor: GARDEN_BADGE_COLORS[item.garden] || "#6b7280",
                color: "white",
                fontWeight: 500,
              }}
            >
              {item.garden}
            </span>
          )}
        </button>
      ))}
    </div>,
    document.body
  );
}
