import type { APIRoute } from "astro";
import { getSessionUser } from "../../lib/auth";
import { resolveUser, canAccessGarden } from "../../lib/roles";
import { isValidGarden, getGardenNames } from "../../lib/gardens";
import { autoDescription, json } from "../../lib/frontmatter-utils";
import fs from "node:fs";
import path from "node:path";
import { GARDENS_DIR } from "../../lib/paths";

export const prerender = false;

export const POST: APIRoute = async (context) => {
  const user = await getSessionUser(context.request.headers, resolveUser);
  if (!user) {
    return json({ error: "Not authenticated" }, 401);
  }

  const body = await context.request.json();
  const { title, content, garden, tags, stage, publish, aliases, template, folder } = body as {
    title: string;
    content: string;
    garden: string;
    tags: string[];
    stage: string;
    publish: boolean;
    aliases?: string[];
    template?: string;
    folder?: string;
  };

  if (!title?.trim()) {
    return json({ error: "Title is required" }, 400);
  }

  if (!garden || !isValidGarden(garden)) {
    return json({ error: "Valid garden is required" }, 400);
  }

  // Check garden permission
  if (!canAccessGarden(user, garden)) {
    return json({ error: `No permission for garden: ${garden}` }, 403);
  }

  // Generate slug from title
  const slug = title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");

  // Resolve template: explicit template > folder's default template
  let templateBody = "";
  let templateProps: Record<string, any> = {};
  const { getTemplatesForGarden } = await import("../../lib/templates");
  const { processTemplate } = await import("../../lib/template-engine");
  const allTemplates = getTemplatesForGarden(garden);

  let resolvedTemplateName = template || "";
  if (!resolvedTemplateName && folder) {
    const { getFoldersForGarden } = await import("../../lib/folders");
    const { getGardenByName } = await import("../../lib/gardens");
    const gardenRow = getGardenByName(garden);
    if (gardenRow) {
      const foldersList = getFoldersForGarden(gardenRow.id);
      const matchedFolder = foldersList.find((f) => f.name === folder);
      if (matchedFolder?.default_template) resolvedTemplateName = matchedFolder.default_template;
    }
  }

  if (resolvedTemplateName) {
    const found = allTemplates.find((t) => t.name === resolvedTemplateName);
    if (found?.body) {
      templateBody = processTemplate(found.body, { title, garden, folder: folder || "" });
    }
    if (found?.properties) {
      templateProps = found.properties;
    }
  }

  // Merge: user-provided values take priority, then template properties, then defaults
  const finalTags = (tags && tags.length > 0) ? tags : (templateProps.tags || []);
  const finalStage = stage || templateProps.stage || "seed";
  const finalPublish = publish ?? templateProps.publish ?? false;
  const finalAliases = (aliases && aliases.length > 0) ? aliases : (templateProps.aliases || []);

  // Build frontmatter
  const now = new Date().toISOString().split("T")[0];
  const autoDesc = autoDescription(content || templateBody || "");

  // Collect custom properties from template (anything beyond known keys)
  const knownKeys = new Set(["tags", "stage", "publish", "aliases", "description"]);
  const customLines: string[] = [];
  for (const [key, value] of Object.entries(templateProps)) {
    if (knownKeys.has(key)) continue;
    if (Array.isArray(value)) {
      customLines.push(`${key}: [${value.map((v: any) => typeof v === "string" && v.includes(" ") ? `"${v}"` : String(v)).join(", ")}]`);
    } else if (typeof value === "boolean") {
      customLines.push(`${key}: ${value}`);
    } else if (typeof value === "string") {
      customLines.push(`${key}: "${value.replace(/"/g, '\\"')}"`);
    } else {
      customLines.push(`${key}: ${String(value)}`);
    }
  }

  const frontmatter = [
    "---",
    `title: "${title.replace(/"/g, '\\"')}"`,
    `aliases: [${finalAliases.map((a: string) => `"${a}"`).join(", ")}]`,
    `stage: ${finalStage}`,
    `tags: [${(Array.isArray(finalTags) ? finalTags : []).map((t: string) => t.trim()).filter(Boolean).join(", ")}]`,
    `created: ${now}`,
    `updated: ${now}`,
    `publish: ${finalPublish}`,
    ...(autoDesc ? [`description: "${autoDesc.replace(/"/g, '\\"')}"`] : []),
    `seeded: false`,
    ...customLines,
    "---",
  ].join("\n");

  // Use template body if user hasn't written content; otherwise use user content
  const hasUserContent = content && content.trim().length > 0;
  const noteBody = hasUserContent ? content : (templateBody || "");
  const fileContent = frontmatter + "\n\n" + noteBody;

  const targetDir = folder
    ? path.join(GARDENS_DIR, garden, "notes", folder)
    : path.join(GARDENS_DIR, garden, "notes");
  fs.mkdirSync(targetDir, { recursive: true });

  const filePath = path.join(targetDir, `${slug}.md`);

  if (fs.existsSync(filePath)) {
    return json({ error: `Note "${slug}" already exists` }, 409);
  }

  fs.writeFileSync(filePath, fileContent, "utf-8");

  const notePath = folder ? `${folder}/${slug}` : slug;
  return json({
    success: true,
    slug: notePath,
    garden,
    path: `/garden/${garden}/${notePath}`,
  });
};

// GET - list notes for editing
export const GET: APIRoute = async (context) => {
  const user = await getSessionUser(context.request.headers, resolveUser);
  if (!user) {
    return json({ error: "Not authenticated" }, 401);
  }

  // Read all markdown files from each garden
  const notes: Array<{
    slug: string;
    title: string;
    aliases: string[];
    garden: string;
    stage: string;
    publish: boolean;
  }> = [];

  for (const garden of getGardenNames()) {
    // Admin sees all, steward sees only their gardens
    if (user.role !== "admin" && !user.gardens.includes(garden)) continue;

    const notesDir = path.join(GARDENS_DIR, garden, "notes");
    const gardenNotes = readNotesFromDir(notesDir, garden);
    notes.push(...gardenNotes);
  }

  return json({ notes });
};

function readNotesFromDir(
  dir: string,
  garden: string
): Array<{
  slug: string;
  title: string;
  aliases: string[];
  garden: string;
  stage: string;
  publish: boolean;
}> {
  const results: Array<any> = [];
  if (!fs.existsSync(dir)) return results;

  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      results.push(...readNotesFromDir(fullPath, garden));
    } else if (entry.name.endsWith(".md")) {
      const content = fs.readFileSync(fullPath, "utf-8");
      const fmMatch = content.match(/^---\n([\s\S]*?)\n---/);
      if (!fmMatch) continue;

      const fm = fmMatch[1];
      const title =
        fm.match(/^title:\s*["']?(.+?)["']?\s*$/m)?.[1] || entry.name;
      const aliasMatch = fm.match(/^aliases:\s*\[([^\]]*)\]/m)?.[1];
      const aliases = aliasMatch
        ? aliasMatch
            .split(",")
            .map((a) => a.trim().replace(/['"]/g, ""))
            .filter(Boolean)
        : [];
      const stage = fm.match(/^stage:\s*(\w+)/m)?.[1] || "seed";
      const publish = fm.includes("publish: true");

      const slug = path.relative(dir, fullPath).replace(/\.md$/, "");
      results.push({ slug, title, aliases, garden, stage, publish });
    }
  }
  return results;
}

