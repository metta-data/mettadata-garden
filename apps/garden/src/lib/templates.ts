import fs from "node:fs";
import path from "node:path";
import { CONTENT_DIR } from "./paths";

const FRONTMATTER_REGEX = /^---\n([\s\S]*?)\n---/;

// Template metadata keys — everything else is a note property
const TEMPLATE_META_KEYS = new Set(["name", "description"]);

export interface TemplateInfo {
  name: string;
  description?: string;
  filename: string;
  body: string;
  source: "global" | "garden";
  /** Note properties to apply (tags, stage, publish, aliases, custom, etc.) */
  properties: Record<string, any>;
}

function parseFrontmatterValue(value: string): any {
  value = value.trim();
  // Arrays: [item1, item2]
  if (value.startsWith("[") && value.endsWith("]")) {
    const inner = value.slice(1, -1).trim();
    if (inner === "") return [];
    return inner.split(",").map((v) => v.trim().replace(/^["']|["']$/g, "")).filter(Boolean);
  }
  // Booleans
  if (value === "true") return true;
  if (value === "false") return false;
  // Quoted strings
  if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
    return value.slice(1, -1);
  }
  return value;
}

function parseTemplateFile(filePath: string, source: "global" | "garden"): TemplateInfo | null {
  const content = fs.readFileSync(filePath, "utf-8");
  const fmMatch = content.match(FRONTMATTER_REGEX);

  const filename = path.basename(filePath, ".md");
  const body = fmMatch ? content.slice(fmMatch[0].length).trim() : content.trim();

  let name = filename;
  let description: string | undefined;
  const properties: Record<string, any> = {};

  if (fmMatch) {
    const fm = fmMatch[1];
    for (const line of fm.split("\n")) {
      const match = line.match(/^(\w[\w-]*):\s*(.*)/);
      if (!match) continue;
      const [, key, rawValue] = match;

      if (key === "name") {
        name = rawValue.trim().replace(/^["']|["']$/g, "");
      } else if (key === "description") {
        description = rawValue.trim().replace(/^["']|["']$/g, "");
      } else {
        // Everything else is a note property
        properties[key] = parseFrontmatterValue(rawValue);
      }
    }
  }

  return { name, description, filename, body, source, properties };
}

/**
 * Get templates for a garden, merging global templates with garden-local overrides.
 * Garden-local templates override global ones by filename match.
 */
export function getTemplatesForGarden(garden: string): TemplateInfo[] {
  const globalDir = path.join(CONTENT_DIR, "templates");
  const gardenDir = path.join(CONTENT_DIR, "gardens", garden, "templates");

  const globalTemplates = new Map<string, TemplateInfo>();

  // Load global templates
  if (fs.existsSync(globalDir)) {
    for (const entry of fs.readdirSync(globalDir)) {
      if (!entry.endsWith(".md")) continue;
      const tmpl = parseTemplateFile(path.join(globalDir, entry), "global");
      if (tmpl) globalTemplates.set(tmpl.filename, tmpl);
    }
  }

  // Load garden-local templates (override global by filename)
  if (fs.existsSync(gardenDir)) {
    for (const entry of fs.readdirSync(gardenDir)) {
      if (!entry.endsWith(".md")) continue;
      const tmpl = parseTemplateFile(path.join(gardenDir, entry), "garden");
      if (tmpl) {
        globalTemplates.set(tmpl.filename, tmpl); // override
      }
    }
  }

  return [...globalTemplates.values()];
}
