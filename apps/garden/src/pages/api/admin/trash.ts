import type { APIRoute } from "astro";
import { getSessionUser } from "../../../lib/auth";
import { resolveUser } from "../../../lib/roles";
import {
  extractFrontmatter,
  parseFrontmatter,
  json,
} from "../../../lib/frontmatter-utils";
import fs from "node:fs";
import path from "node:path";
import {
  GARDENS_DIR,
  BLOG_DIR,
  NOTES_TRASH_DIR,
  BLOG_TRASH_DIR,
} from "../../../lib/paths";
import { queueContentSync } from "../../../lib/content-sync";

export const prerender = false;

interface TrashedItem {
  type: "note" | "blog";
  slug: string;
  garden?: string;
  title: string;
  deletedAt: string;
}

function readTrashedItems(): TrashedItem[] {
  const items: TrashedItem[] = [];

  // Read trashed notes
  if (fs.existsSync(NOTES_TRASH_DIR)) {
    for (const garden of fs.readdirSync(NOTES_TRASH_DIR)) {
      const gardenTrash = path.join(NOTES_TRASH_DIR, garden);
      if (!fs.statSync(gardenTrash).isDirectory()) continue;
      for (const file of fs.readdirSync(gardenTrash)) {
        if (!file.endsWith(".md")) continue;
        const filePath = path.join(gardenTrash, file);
        const stat = fs.statSync(filePath);
        const content = fs.readFileSync(filePath, "utf-8");
        const extracted = extractFrontmatter(content);
        const fm = extracted ? parseFrontmatter(extracted.raw) : {};
        items.push({
          type: "note",
          slug: file.replace(/\.md$/, ""),
          garden,
          title: fm.title || file.replace(/\.md$/, ""),
          deletedAt: stat.mtime.toISOString(),
        });
      }
    }
  }

  // Read trashed blog posts
  if (fs.existsSync(BLOG_TRASH_DIR)) {
    for (const file of fs.readdirSync(BLOG_TRASH_DIR)) {
      if (!file.endsWith(".md")) continue;
      const filePath = path.join(BLOG_TRASH_DIR, file);
      const stat = fs.statSync(filePath);
      const content = fs.readFileSync(filePath, "utf-8");
      const extracted = extractFrontmatter(content);
      const fm = extracted ? parseFrontmatter(extracted.raw) : {};
      items.push({
        type: "blog",
        slug: file.replace(/\.md$/, ""),
        title: fm.title || file.replace(/\.md$/, ""),
        deletedAt: stat.mtime.toISOString(),
      });
    }
  }

  return items.sort(
    (a, b) => new Date(b.deletedAt).getTime() - new Date(a.deletedAt).getTime()
  );
}

export const GET: APIRoute = async (context) => {
  const user = await getSessionUser(context.request.headers, resolveUser);
  if (!user || user.role !== "admin") {
    return json({ error: "Admin only" }, 403);
  }

  return json({ items: readTrashedItems() });
};

export const POST: APIRoute = async (context) => {
  const user = await getSessionUser(context.request.headers, resolveUser);
  if (!user || user.role !== "admin") {
    return json({ error: "Admin only" }, 403);
  }

  const body = await context.request.json();
  const { action, type, slug, garden } = body as {
    action: "restore" | "empty";
    type?: "note" | "blog";
    slug?: string;
    garden?: string;
  };

  if (action === "restore") {
    if (!type || !slug) {
      return json({ error: "Missing type or slug" }, 400);
    }

    if (type === "note") {
      if (!garden) return json({ error: "Missing garden" }, 400);
      const trashPath = path.join(NOTES_TRASH_DIR, garden, `${slug}.md`);
      if (!fs.existsSync(trashPath)) {
        return json({ error: "Item not found in trash" }, 404);
      }
      const restorePath = path.join(GARDENS_DIR, garden, "notes", `${slug}.md`);
      fs.mkdirSync(path.dirname(restorePath), { recursive: true });
      fs.renameSync(trashPath, restorePath);
    } else {
      const trashPath = path.join(BLOG_TRASH_DIR, `${slug}.md`);
      if (!fs.existsSync(trashPath)) {
        return json({ error: "Item not found in trash" }, 404);
      }
      const restorePath = path.join(BLOG_DIR, `${slug}.md`);
      fs.renameSync(trashPath, restorePath);
    }

    queueContentSync();
    return json({ success: true, action: "restored" });
  }

  if (action === "empty") {
    // If type+slug provided, delete single item; otherwise empty all
    if (type && slug) {
      if (type === "note" && garden) {
        const trashPath = path.join(NOTES_TRASH_DIR, garden, `${slug}.md`);
        if (fs.existsSync(trashPath)) fs.unlinkSync(trashPath);
      } else if (type === "blog") {
        const trashPath = path.join(BLOG_TRASH_DIR, `${slug}.md`);
        if (fs.existsSync(trashPath)) fs.unlinkSync(trashPath);
      }
    } else {
      // Empty all trash
      if (fs.existsSync(NOTES_TRASH_DIR)) {
        fs.rmSync(NOTES_TRASH_DIR, { recursive: true, force: true });
      }
      if (fs.existsSync(BLOG_TRASH_DIR)) {
        fs.rmSync(BLOG_TRASH_DIR, { recursive: true, force: true });
      }
    }

    queueContentSync();
    return json({ success: true, action: "emptied" });
  }

  return json({ error: "Invalid action" }, 400);
};
