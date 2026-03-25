const FRONTMATTER_REGEX = /^---\n([\s\S]*?)\n---/;

export function extractFrontmatter(fileContent: string): {
  raw: string;
  body: string;
} | null {
  const match = fileContent.match(FRONTMATTER_REGEX);
  if (!match) return null;
  return {
    raw: match[1],
    body: fileContent.replace(FRONTMATTER_REGEX, "").trim(),
  };
}

export function parseFrontmatter(raw: string): Record<string, any> {
  const result: Record<string, any> = {};
  const lines = raw.split("\n");

  for (const line of lines) {
    const match = line.match(/^(\w[\w-]*):\s*(.*)/);
    if (!match) continue;

    const [, key, rawValue] = match;
    const value = rawValue.trim();

    // Parse arrays: [item1, item2]
    if (value.startsWith("[") && value.endsWith("]")) {
      const inner = value.slice(1, -1);
      if (inner.trim() === "") {
        result[key] = [];
      } else {
        result[key] = inner
          .split(",")
          .map((v) => v.trim().replace(/^["']|["']$/g, ""))
          .filter(Boolean);
      }
    }
    // Parse booleans
    else if (value === "true") {
      result[key] = true;
    } else if (value === "false") {
      result[key] = false;
    }
    // Parse quoted strings
    else if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      result[key] = value.slice(1, -1);
    }
    // Everything else as string
    else {
      result[key] = value;
    }
  }

  return result;
}

export function serializeFrontmatter(
  fm: Record<string, any>,
  keyOrder?: string[]
): string {
  const order = keyOrder || Object.keys(fm);
  const lines: string[] = [];
  const seen = new Set<string>();

  // Output keys in preferred order first
  for (const key of order) {
    if (key in fm) {
      lines.push(serializeValue(key, fm[key]));
      seen.add(key);
    }
  }

  // Output remaining keys
  for (const key of Object.keys(fm)) {
    if (!seen.has(key)) {
      lines.push(serializeValue(key, fm[key]));
    }
  }

  return lines.join("\n");
}

export function serializeValue(key: string, value: any): string {
  if (Array.isArray(value)) {
    if (value.length === 0) return `${key}: []`;
    const items = value.map((v) => {
      if (typeof v === "string" && (v.includes(",") || v.includes(" "))) {
        return `"${v}"`;
      }
      return String(v);
    });
    return `${key}: [${items.join(", ")}]`;
  }
  if (typeof value === "boolean") {
    return `${key}: ${value}`;
  }
  if (typeof value === "string") {
    if (value.includes(":") || value.includes("#") || value.includes('"')) {
      return `${key}: "${value.replace(/"/g, '\\"')}"`;
    }
    if (key === "title" || key === "description") {
      return `${key}: "${value.replace(/"/g, '\\"')}"`;
    }
    return `${key}: ${value}`;
  }
  return `${key}: ${String(value)}`;
}

export function autoDescription(markdown: string): string {
  const plain = markdown
    .replace(/^#{1,6}\s+/gm, "")
    .replace(/\*\*|__/g, "")
    .replace(/\*|_/g, "")
    .replace(/\[([^\]]+)\]\([^)]+\)/g, "$1")
    .replace(/\[\[(?:\w+\/)?([^\]|]+)(?:\|([^\]]+))?\]\]/g, (_, t, d) => d || t)
    .replace(/!\[.*?\]\(.*?\)/g, "")
    .replace(/`{1,3}[^`]*`{1,3}/g, "")
    .replace(/\n+/g, " ")
    .trim();
  return plain.slice(0, 160);
}

export function slugify(title: string): string {
  return title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

export function json(data: any, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}
