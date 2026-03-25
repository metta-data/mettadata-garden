import type { APIRoute } from "astro";
import { auth } from "../../../lib/auth";
import { resolveUser } from "../../../lib/roles";
import { getTemplatesForGarden } from "../../../lib/templates";
import { getAllGardens } from "../../../lib/gardens";
import fs from "node:fs";
import path from "node:path";

export const prerender = false;

import { CONTENT_DIR } from "../../../lib/paths";

function buildTemplateFile(
  name: string,
  description?: string,
  properties?: Record<string, any>,
  content?: string
): string {
  const lines = ["---", `name: ${name}`];
  if (description) lines.push(`description: ${description}`);
  if (properties) {
    for (const [key, value] of Object.entries(properties)) {
      if (Array.isArray(value)) {
        lines.push(`${key}: [${value.map((v: any) => typeof v === "string" && v.includes(" ") ? `"${v}"` : String(v)).join(", ")}]`);
      } else if (typeof value === "boolean") {
        lines.push(`${key}: ${value}`);
      } else {
        lines.push(`${key}: ${value}`);
      }
    }
  }
  lines.push("---");
  return lines.join("\n") + "\n\n" + (content || "") + "\n";
}

function parseTemplateForAdmin(content: string, file: string) {
  const fmMatch = content.match(/^---\n([\s\S]*?)\n---/);
  const body = fmMatch ? content.slice(fmMatch[0].length).trim() : content.trim();
  const filename = file.replace(/\.md$/, "");
  let name = filename;
  let description = "";
  const properties: Record<string, any> = {};

  if (fmMatch) {
    for (const line of fmMatch[1].split("\n")) {
      const match = line.match(/^(\w[\w-]*):\s*(.*)/);
      if (!match) continue;
      const [, key, rawValue] = match;
      const value = rawValue.trim();

      if (key === "name") {
        name = value.replace(/^["']|["']$/g, "");
      } else if (key === "description") {
        description = value.replace(/^["']|["']$/g, "");
      } else {
        // Parse value
        if (value.startsWith("[") && value.endsWith("]")) {
          const inner = value.slice(1, -1).trim();
          properties[key] = inner ? inner.split(",").map((v: string) => v.trim().replace(/^["']|["']$/g, "")).filter(Boolean) : [];
        } else if (value === "true") properties[key] = true;
        else if (value === "false") properties[key] = false;
        else properties[key] = value.replace(/^["']|["']$/g, "");
      }
    }
  }

  return { name, description, filename, body, properties };
}

function json(data: any, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

async function requireAdmin(request: Request) {
  const session = await auth.api.getSession({ headers: request.headers });
  if (!session?.user) return null;
  const user = resolveUser({
    email: session.user.email,
    name: session.user.name,
    image: session.user.image ?? undefined,
  });
  if (!user || user.role !== "admin") return null;
  return user;
}

export const GET: APIRoute = async (context) => {
  const user = await requireAdmin(context.request);
  if (!user) return json({ error: "Admin access required" }, 403);

  const gardens = getAllGardens();
  const allTemplates: Array<any> = [];

  // Global templates — use getTemplatesForGarden with a dummy garden that has no overrides
  const globalDir = path.join(CONTENT_DIR, "templates");
  if (fs.existsSync(globalDir)) {
    for (const file of fs.readdirSync(globalDir).filter((f) => f.endsWith(".md"))) {
      const content = fs.readFileSync(path.join(globalDir, file), "utf-8");
      const parsed = parseTemplateForAdmin(content, file);
      allTemplates.push({ ...parsed, source: "global" });
    }
  }

  // Per-garden templates
  for (const g of gardens) {
    const gardenDir = path.join(CONTENT_DIR, "gardens", g.name, "templates");
    if (!fs.existsSync(gardenDir)) continue;
    for (const file of fs.readdirSync(gardenDir).filter((f) => f.endsWith(".md"))) {
      const content = fs.readFileSync(path.join(gardenDir, file), "utf-8");
      const parsed = parseTemplateForAdmin(content, file);
      allTemplates.push({ ...parsed, source: "garden", garden: g.name });
    }
  }

  return json({ templates: allTemplates });
};

export const POST: APIRoute = async (context) => {
  const user = await requireAdmin(context.request);
  if (!user) return json({ error: "Admin access required" }, 403);

  const body = await context.request.json();
  const { name, description, content, garden, properties } = body as {
    name: string;
    description?: string;
    content: string;
    garden?: string;
    properties?: Record<string, any>;
  };

  if (!name?.trim()) return json({ error: "Template name is required" }, 400);

  const slug = name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
  const dir = garden
    ? path.join(CONTENT_DIR, "gardens", garden, "templates")
    : path.join(CONTENT_DIR, "templates");

  fs.mkdirSync(dir, { recursive: true });

  const filePath = path.join(dir, `${slug}.md`);
  if (fs.existsSync(filePath)) {
    return json({ error: "Template already exists" }, 409);
  }

  fs.writeFileSync(filePath, buildTemplateFile(name, description, properties, content), "utf-8");

  return json({ success: true, filename: slug });
};

export const PUT: APIRoute = async (context) => {
  const user = await requireAdmin(context.request);
  if (!user) return json({ error: "Admin access required" }, 403);

  const body = await context.request.json();
  const { filename, name, description, content, garden, oldGarden, properties } = body as {
    filename: string;
    name: string;
    description?: string;
    content: string;
    garden?: string;
    oldGarden?: string;
    properties?: Record<string, any>;
  };

  // Find the original file location
  const oldDir = oldGarden
    ? path.join(CONTENT_DIR, "gardens", oldGarden, "templates")
    : path.join(CONTENT_DIR, "templates");
  const oldPath = path.join(oldDir, `${filename}.md`);

  const newDir = garden
    ? path.join(CONTENT_DIR, "gardens", garden, "templates")
    : path.join(CONTENT_DIR, "templates");

  // Try old location first, then new location
  if (!fs.existsSync(oldPath) && !fs.existsSync(path.join(newDir, `${filename}.md`))) {
    return json({ error: "Template not found" }, 404);
  }

  // If scope changed, delete from old location and write to new
  fs.mkdirSync(newDir, { recursive: true });
  const newPath = path.join(newDir, `${filename}.md`);
  fs.writeFileSync(newPath, buildTemplateFile(name, description, properties, content), "utf-8");
  if (fs.existsSync(oldPath) && oldPath !== newPath) {
    fs.unlinkSync(oldPath);
  }

  return json({ success: true });
};

export const DELETE: APIRoute = async (context) => {
  const user = await requireAdmin(context.request);
  if (!user) return json({ error: "Admin access required" }, 403);

  const body = await context.request.json();
  const { filename, garden } = body as { filename: string; garden?: string };

  const dir = garden
    ? path.join(CONTENT_DIR, "gardens", garden, "templates")
    : path.join(CONTENT_DIR, "templates");

  const filePath = path.join(dir, `${filename}.md`);
  if (!fs.existsSync(filePath)) {
    return json({ error: "Template not found" }, 404);
  }

  fs.unlinkSync(filePath);
  return json({ success: true });
};
