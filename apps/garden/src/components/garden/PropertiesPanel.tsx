import { useState, useCallback } from "react";
import type { GardenScope, GrowthStage } from "@mettadata/content-model";
import "../editor/editor-styles.css";

const GROWTH_STAGES: GrowthStage[] = ["seed", "sprout", "sapling", "evergreen"];

const STAGE_ICONS: Record<string, string> = {
  seed: "🌰",
  sprout: "🌱",
  sapling: "🌿",
  evergreen: "🌲",
};

const GARDEN_COLORS: Record<string, string> = {
  professional: "garden-professional",
  spiritual: "garden-spiritual",
  academic: "garden-academic",
  private: "garden-private",
};

interface PropertiesPanelProps {
  frontmatter: Record<string, any>;
  onChange: (updated: Record<string, any>) => void;
  garden?: string;
}

export function PropertiesPanel({
  frontmatter,
  onChange,
  garden,
}: PropertiesPanelProps) {
  const [collapsed, setCollapsed] = useState(false);
  const [newPropertyKey, setNewPropertyKey] = useState("");
  const [addingProperty, setAddingProperty] = useState(false);

  const update = useCallback(
    (key: string, value: any) => {
      onChange({ ...frontmatter, [key]: value });
    },
    [frontmatter, onChange]
  );

  const removeProperty = useCallback(
    (key: string) => {
      const next = { ...frontmatter };
      delete next[key];
      onChange(next);
    },
    [frontmatter, onChange]
  );

  const addProperty = useCallback(() => {
    const key = newPropertyKey.trim().toLowerCase().replace(/\s+/g, "-");
    if (!key || key in frontmatter) {
      setAddingProperty(false);
      setNewPropertyKey("");
      return;
    }
    onChange({ ...frontmatter, [key]: "" });
    setNewPropertyKey("");
    setAddingProperty(false);
  }, [newPropertyKey, frontmatter, onChange]);

  // Known fields that get special editors (no "gardens" — folder determines it)
  const knownKeys = new Set([
    "title",
    "aliases",
    "stage",
    "tags",
    "created",
    "updated",
    "publish",
    "description",
    "seeded",
    "seedSource",
  ]);

  // Custom properties
  const customKeys = Object.keys(frontmatter).filter(
    (k) => !knownKeys.has(k) && k !== "gardens"
  );

  return (
    <div className="properties-panel">
      <button
        onClick={() => setCollapsed(!collapsed)}
        className="properties-panel-toggle"
      >
        <svg
          className={`properties-chevron ${collapsed ? "" : "properties-chevron-open"}`}
          width="12"
          height="12"
          viewBox="0 0 12 12"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
        >
          <path d="M4 2l4 4-4 4" />
        </svg>
        <span className="properties-panel-title">Properties</span>
        <span className="properties-count">
          {Object.keys(frontmatter).length}
        </span>
      </button>

      {!collapsed && (
        <div className="properties-grid">
          {/* Garden (read-only) */}
          {garden && (
            <PropertyRow label="Garden">
              <span className={`property-garden-tag ${GARDEN_COLORS[garden] || ""}`}>
                {garden}
              </span>
            </PropertyRow>
          )}

          {/* Title */}
          <PropertyRow label="Title">
            <input
              type="text"
              value={frontmatter.title || ""}
              onChange={(e) => update("title", e.target.value)}
              className="property-input"
            />
          </PropertyRow>

          {/* Aliases */}
          <PropertyRow label="Aliases">
            <TagListEditor
              values={frontmatter.aliases || []}
              onChange={(v) => update("aliases", v)}
              placeholder="Add alias..."
            />
          </PropertyRow>

          {/* Stage */}
          <PropertyRow label="Stage">
            <div className="property-stage-select">
              {GROWTH_STAGES.map((s) => (
                <button
                  key={s}
                  onClick={() => update("stage", s)}
                  className={`property-stage-btn ${frontmatter.stage === s ? "property-stage-active" : ""}`}
                  title={s}
                >
                  {STAGE_ICONS[s]} {s}
                </button>
              ))}
            </div>
          </PropertyRow>

          {/* Tags */}
          <PropertyRow label="Tags">
            <TagListEditor
              values={frontmatter.tags || []}
              onChange={(v) => update("tags", v)}
              placeholder="Add tag..."
            />
          </PropertyRow>

          {/* Publish */}
          <PropertyRow label="Publish">
            <label className="property-toggle-label">
              <input
                type="checkbox"
                checked={frontmatter.publish || false}
                onChange={(e) => update("publish", e.target.checked)}
                className="property-checkbox"
              />
              <span className="text-xs text-[var(--color-text-muted)]">
                {frontmatter.publish ? "Public" : "Draft"}
              </span>
            </label>
          </PropertyRow>

          {/* Description */}
          <PropertyRow label="Description">
            <textarea
              value={frontmatter.description || ""}
              onChange={(e) => update("description", e.target.value)}
              className="property-textarea"
              rows={2}
              placeholder="Brief description..."
            />
          </PropertyRow>

          {/* Dates (read-only display) */}
          <PropertyRow label="Created">
            <span className="property-date">{frontmatter.created || "—"}</span>
          </PropertyRow>

          <PropertyRow label="Updated">
            <span className="property-date">{frontmatter.updated || "—"}</span>
          </PropertyRow>

          {/* Seeded */}
          <PropertyRow label="Seeded">
            <label className="property-toggle-label">
              <input
                type="checkbox"
                checked={frontmatter.seeded || false}
                onChange={(e) => update("seeded", e.target.checked)}
                className="property-checkbox"
              />
              <span className="text-xs text-[var(--color-text-muted)]">
                {frontmatter.seeded ? "Yes" : "No"}
              </span>
            </label>
          </PropertyRow>

          {frontmatter.seedSource && (
            <PropertyRow label="Seed Source">
              <input
                type="text"
                value={frontmatter.seedSource || ""}
                onChange={(e) => update("seedSource", e.target.value)}
                className="property-input"
              />
            </PropertyRow>
          )}

          {/* Custom properties */}
          {customKeys.map((key) => (
            <PropertyRow
              key={key}
              label={key}
              removable
              onRemove={() => removeProperty(key)}
            >
              {Array.isArray(frontmatter[key]) ? (
                <TagListEditor
                  values={frontmatter[key]}
                  onChange={(v) => update(key, v)}
                  placeholder={`Add ${key}...`}
                />
              ) : typeof frontmatter[key] === "boolean" ? (
                <label className="property-toggle-label">
                  <input
                    type="checkbox"
                    checked={frontmatter[key]}
                    onChange={(e) => update(key, e.target.checked)}
                    className="property-checkbox"
                  />
                  <span className="text-xs text-[var(--color-text-muted)]">
                    {frontmatter[key] ? "true" : "false"}
                  </span>
                </label>
              ) : (
                <input
                  type="text"
                  value={String(frontmatter[key] ?? "")}
                  onChange={(e) => update(key, e.target.value)}
                  className="property-input"
                />
              )}
            </PropertyRow>
          ))}

          {/* Add property */}
          {addingProperty ? (
            <div className="property-row">
              <input
                type="text"
                value={newPropertyKey}
                onChange={(e) => setNewPropertyKey(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") addProperty();
                  if (e.key === "Escape") {
                    setAddingProperty(false);
                    setNewPropertyKey("");
                  }
                }}
                placeholder="Property name..."
                className="property-input"
                autoFocus
              />
              <button onClick={addProperty} className="property-add-confirm">
                Add
              </button>
            </div>
          ) : (
            <button
              onClick={() => setAddingProperty(true)}
              className="property-add-btn"
            >
              + Add property
            </button>
          )}
        </div>
      )}
    </div>
  );
}

/* ── Sub-components ──────────────────────────────────── */

function PropertyRow({
  label,
  children,
  removable,
  onRemove,
}: {
  label: string;
  children: React.ReactNode;
  removable?: boolean;
  onRemove?: () => void;
}) {
  return (
    <div className="property-row">
      <div className="property-label">
        <span>{label}</span>
        {removable && (
          <button
            onClick={onRemove}
            className="property-remove-btn"
            title={`Remove ${label}`}
          >
            ×
          </button>
        )}
      </div>
      <div className="property-value">{children}</div>
    </div>
  );
}

function TagListEditor({
  values,
  onChange,
  placeholder,
}: {
  values: string[];
  onChange: (values: string[]) => void;
  placeholder: string;
}) {
  const [inputValue, setInputValue] = useState("");

  const addValue = () => {
    const val = inputValue.trim();
    if (val && !values.includes(val)) {
      onChange([...values, val]);
    }
    setInputValue("");
  };

  return (
    <div className="tag-list-editor">
      {values.map((v, i) => (
        <span key={i} className="tag-list-tag">
          {v}
          <button
            onClick={() => onChange(values.filter((_, j) => j !== i))}
            className="tag-list-remove"
          >
            ×
          </button>
        </span>
      ))}
      <input
        type="text"
        value={inputValue}
        onChange={(e) => setInputValue(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            e.preventDefault();
            addValue();
          }
          if (e.key === "Backspace" && inputValue === "" && values.length > 0) {
            onChange(values.slice(0, -1));
          }
        }}
        onBlur={addValue}
        placeholder={values.length === 0 ? placeholder : ""}
        className="tag-list-input"
      />
    </div>
  );
}
