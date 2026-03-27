import type { APIRoute } from "astro";
import { getSessionUser } from "../../../lib/auth";
import { resolveUser } from "../../../lib/roles";
import {
  extractFrontmatter,
  parseFrontmatter,
  serializeFrontmatter,
  serializeValue,
  json,
} from "../../../lib/frontmatter-utils";
import fs from "node:fs";
import path from "node:path";
import { BLOG_DIR, BLOG_TRASH_DIR } from "../../../lib/paths";

export const prerender = false;

const BLOG_KEY_ORDER = [
  "title",
  "slug",
  "date",
  "updated",
  "tags",
  "description",
  "draft",
  "gardenRefs",
  "coverImage",
];

export const GET: APIRoute = async (context) => {
  const user = await getSessionUser(context.request.headers, resolveUser);
  if (!user) {
    return json({ error: "Not authenticated" }, 401);
  }

  const slug = context.params.slug;
  if (!slug) {
    return json({ error: "Missing slug" }, 400);
  }

  const filePath = path.join(BLOG_DIR, `${slug}.md`);
  if (!fs.existsSync(filePath)) {
    return json({ error: "Post not found" }, 404);
  }

  const fileContent = fs.readFileSync(filePath, "utf-8");
  const extracted = extractFrontmatter(fileContent);
  if (!extracted) {
    return json({ error: "Invalid post format" }, 400);
  }

  const frontmatter = parseFrontmatter(extracted.raw);

  return json({ slug, frontmatter, content: extracted.body });
};

export const PUT: APIRoute = async (context) => {
  const user = await getSessionUser(context.request.headers, resolveUser);
  if (!user || (user.role !== "admin" && user.role !== "steward")) {
    return json({ error: "Insufficient permissions" }, 403);
  }

  const slug = context.params.slug;
  if (!slug) {
    return json({ error: "Missing slug" }, 400);
  }

  const filePath = path.join(BLOG_DIR, `${slug}.md`);
  if (!fs.existsSync(filePath)) {
    return json({ error: "Post not found" }, 404);
  }

  const fileContent = fs.readFileSync(filePath, "utf-8");
  const extracted = extractFrontmatter(fileContent);
  if (!extracted) {
    return json({ error: "Invalid post format" }, 400);
  }

  const body = await context.request.json();
  const { content, frontmatter } = body as {
    content?: string;
    frontmatter?: Record<string, any>;
  };

  const existingFm = parseFrontmatter(extracted.raw);
  const now = new Date().toISOString().split("T")[0];

  if (frontmatter) {
    for (const [key, value] of Object.entries(frontmatter)) {
      existingFm[key] = value;
    }
  }

  // Always update the `updated` date
  existingFm.updated = now;

  const newFrontmatter = serializeFrontmatter(existingFm, BLOG_KEY_ORDER);
  const bodyContent =
    content !== undefined ? (content || "").trim() : extracted.body;

  const newFileContent = `---\n${newFrontmatter}\n---\n\n${bodyContent}\n`;

  fs.writeFileSync(filePath, newFileContent, "utf-8");

  return json({ success: true, slug, frontmatter: existingFm });
};

export const DELETE: APIRoute = async (context) => {
  const user = await getSessionUser(context.request.headers, resolveUser);
  if (!user || user.role !== "admin") {
    return json({ error: "Admin only" }, 403);
  }

  const slug = context.params.slug;
  if (!slug) {
    return json({ error: "Missing slug" }, 400);
  }

  const filePath = path.join(BLOG_DIR, `${slug}.md`);
  if (!fs.existsSync(filePath)) {
    return json({ error: "Post not found" }, 404);
  }

  // Move to trash instead of permanent delete
  fs.mkdirSync(BLOG_TRASH_DIR, { recursive: true });
  const trashPath = path.join(BLOG_TRASH_DIR, `${slug}.md`);
  fs.renameSync(filePath, trashPath);

  return json({ success: true, slug });
};
