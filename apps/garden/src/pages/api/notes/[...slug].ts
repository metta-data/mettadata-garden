import type { APIRoute } from "astro";
import { getSessionUser } from "../../../lib/auth";
import { resolveUser, canAccessGarden } from "../../../lib/roles";
import { isValidGarden } from "../../../lib/gardens";
import {
  extractFrontmatter,
  parseFrontmatter,
  serializeFrontmatter,
  json,
} from "../../../lib/frontmatter-utils";
import fs from "node:fs";
import path from "node:path";
import { GARDENS_DIR, NOTES_TRASH_DIR } from "../../../lib/paths";
import { queueContentSync } from "../../../lib/content-sync";

export const prerender = false;

export const PUT: APIRoute = async (context) => {
  const user = await getSessionUser(context.request.headers, resolveUser);
  if (!user) {
    return json({ error: "Not authenticated" }, 401);
  }

  const slug = context.params.slug;
  if (!slug) {
    return json({ error: "Missing slug" }, 400);
  }

  // Parse garden from first segment
  const segments = slug.split("/");
  if (segments.length < 2 || !isValidGarden(segments[0])) {
    return json({ error: "Invalid path — expected garden/slug" }, 400);
  }

  const garden = segments[0];
  const noteSlug = segments.slice(1).join("/");

  // Check garden permission
  if (!canAccessGarden(user, garden)) {
    return json({ error: `No permission for garden: ${garden}` }, 403);
  }

  // Find the note file
  const notePath = path.join(GARDENS_DIR, garden, "notes", `${noteSlug}.md`);
  if (!fs.existsSync(notePath)) {
    return json({ error: "Note not found" }, 404);
  }

  const fileContent = fs.readFileSync(notePath, "utf-8");
  const extracted = extractFrontmatter(fileContent);
  if (!extracted) {
    return json({ error: "Invalid note format" }, 400);
  }

  const body = await context.request.json();
  const { content, frontmatter } = body as {
    content?: string;
    frontmatter?: Record<string, any>;
  };

  // Parse existing frontmatter into key-value pairs
  const existingFm = parseFrontmatter(extracted.raw);
  const now = new Date().toISOString().split("T")[0];

  if (frontmatter) {
    // Merge frontmatter updates
    for (const [key, value] of Object.entries(frontmatter)) {
      // Don't allow overwriting created date
      if (key === "created") continue;
      // Skip gardens field — it's determined by folder now
      if (key === "gardens") continue;
      existingFm[key] = value;
    }
  }

  // Always update the `updated` date
  existingFm.updated = now;

  // Remove gardens key if present (legacy cleanup)
  delete existingFm.gardens;

  // Serialize frontmatter back to YAML
  const newFrontmatter = serializeFrontmatter(existingFm);

  // Get body content: use provided content, or keep existing
  const bodyContent = content !== undefined ? (content || "").trim() : extracted.body;

  const newFileContent = `---\n${newFrontmatter}\n---\n\n${bodyContent}\n`;

  fs.writeFileSync(notePath, newFileContent, "utf-8");
  queueContentSync();

  return json({ success: true, slug: noteSlug, garden, frontmatter: existingFm });
};

export const GET: APIRoute = async (context) => {
  const user = await getSessionUser(context.request.headers, resolveUser);
  if (!user) {
    return json({ error: "Not authenticated" }, 401);
  }

  const slug = context.params.slug;
  if (!slug) {
    return json({ error: "Missing slug" }, 400);
  }

  // Parse garden from first segment
  const segments = slug.split("/");
  if (segments.length < 2 || !isValidGarden(segments[0])) {
    return json({ error: "Invalid path — expected garden/slug" }, 400);
  }

  const garden = segments[0];
  const noteSlug = segments.slice(1).join("/");

  if (!canAccessGarden(user, garden)) {
    return json({ error: `No permission for garden: ${garden}` }, 403);
  }

  const notePath = path.join(GARDENS_DIR, garden, "notes", `${noteSlug}.md`);
  if (!fs.existsSync(notePath)) {
    return json({ error: "Note not found" }, 404);
  }

  const fileContent = fs.readFileSync(notePath, "utf-8");
  const extracted = extractFrontmatter(fileContent);
  if (!extracted) {
    return json({ error: "Invalid note format" }, 400);
  }

  const frontmatter = parseFrontmatter(extracted.raw);

  return json({ slug: noteSlug, garden, frontmatter, content: extracted.body });
};

export const DELETE: APIRoute = async (context) => {
  const user = await getSessionUser(context.request.headers, resolveUser);
  if (!user) {
    return json({ error: "Not authenticated" }, 401);
  }

  const slug = context.params.slug;
  if (!slug) {
    return json({ error: "Missing slug" }, 400);
  }

  const segments = slug.split("/");
  if (segments.length < 2 || !isValidGarden(segments[0])) {
    return json({ error: "Invalid path — expected garden/slug" }, 400);
  }

  const garden = segments[0];
  const noteSlug = segments.slice(1).join("/");

  if (!canAccessGarden(user, garden)) {
    return json({ error: `No permission for garden: ${garden}` }, 403);
  }

  const notePath = path.join(GARDENS_DIR, garden, "notes", `${noteSlug}.md`);
  if (!fs.existsSync(notePath)) {
    return json({ error: "Note not found" }, 404);
  }

  // Move to trash instead of permanent delete
  const trashDir = path.join(NOTES_TRASH_DIR, garden);
  fs.mkdirSync(trashDir, { recursive: true });
  const trashPath = path.join(trashDir, `${noteSlug}.md`);
  fs.renameSync(notePath, trashPath);
  queueContentSync();

  return json({ success: true, slug: noteSlug, garden });
};
