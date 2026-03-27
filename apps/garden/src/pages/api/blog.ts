import type { APIRoute } from "astro";
import { getSessionUser } from "../../lib/auth";
import { resolveUser } from "../../lib/roles";
import {
  slugify,
  autoDescription,
  json,
} from "../../lib/frontmatter-utils";
import fs from "node:fs";
import path from "node:path";
import { BLOG_DIR } from "../../lib/paths";
import { queueContentSync } from "../../lib/content-sync";

export const prerender = false;

export const POST: APIRoute = async (context) => {
  const user = await getSessionUser(context.request.headers, resolveUser);
  if (!user || (user.role !== "admin" && user.role !== "steward")) {
    return json({ error: "Insufficient permissions" }, 403);
  }

  const body = await context.request.json();
  const {
    title,
    content,
    description,
    tags,
    date,
    draft,
    gardenRefs,
    coverImage,
  } = body as {
    title: string;
    content: string;
    description?: string;
    tags?: string[];
    date?: string;
    draft?: boolean;
    gardenRefs?: string[];
    coverImage?: string;
  };

  if (!title?.trim()) {
    return json({ error: "Title is required" }, 400);
  }

  const slug = slugify(title);
  const now = new Date().toISOString().split("T")[0];
  const postDate = date || now;
  const postDesc = description?.trim() || autoDescription(content || "");
  const postTags = (tags || []).filter(Boolean);
  const postRefs = (gardenRefs || []).filter(Boolean);
  const isDraft = draft ?? false;

  // Build frontmatter
  const fmLines = [
    `title: "${title.replace(/"/g, '\\"')}"`,
    `date: ${postDate}`,
    `updated: ${now}`,
    `tags: [${postTags.join(", ")}]`,
    `description: "${postDesc.replace(/"/g, '\\"')}"`,
    `draft: ${isDraft}`,
    `gardenRefs: [${postRefs.join(", ")}]`,
  ];
  if (coverImage) {
    fmLines.push(`coverImage: "${coverImage.replace(/"/g, '\\"')}"`);
  }

  const fileContent = `---\n${fmLines.join("\n")}\n---\n\n${(content || "").trim()}\n`;

  fs.mkdirSync(BLOG_DIR, { recursive: true });
  const filePath = path.join(BLOG_DIR, `${slug}.md`);

  if (fs.existsSync(filePath)) {
    return json({ error: `Post "${slug}" already exists` }, 409);
  }

  fs.writeFileSync(filePath, fileContent, "utf-8");
  queueContentSync();

  return json({
    success: true,
    slug,
    path: `/blog/${slug}`,
  });
};

export const GET: APIRoute = async (context) => {
  const user = await getSessionUser(context.request.headers, resolveUser);
  if (!user) {
    return json({ error: "Not authenticated" }, 401);
  }

  if (!fs.existsSync(BLOG_DIR)) {
    return json({ posts: [] });
  }

  const posts: Array<{
    slug: string;
    title: string;
    date: string;
    draft: boolean;
    tags: string[];
    description: string;
  }> = [];

  for (const entry of fs.readdirSync(BLOG_DIR)) {
    if (!entry.endsWith(".md")) continue;

    const content = fs.readFileSync(path.join(BLOG_DIR, entry), "utf-8");
    const fmMatch = content.match(/^---\n([\s\S]*?)\n---/);
    if (!fmMatch) continue;

    const fm = fmMatch[1];
    const title =
      fm.match(/^title:\s*["']?(.+?)["']?\s*$/m)?.[1] || entry;
    const date = fm.match(/^date:\s*(.+)$/m)?.[1]?.trim() || "";
    const draft = fm.includes("draft: true");
    const tagsMatch = fm.match(/^tags:\s*\[([^\]]*)\]/m)?.[1];
    const tags = tagsMatch
      ? tagsMatch.split(",").map((t) => t.trim().replace(/['"]/g, "")).filter(Boolean)
      : [];
    const description =
      fm.match(/^description:\s*["']?(.+?)["']?\s*$/m)?.[1] || "";

    posts.push({
      slug: entry.replace(/\.md$/, ""),
      title,
      date,
      draft,
      tags,
      description,
    });
  }

  // Sort by date descending
  posts.sort((a, b) => b.date.localeCompare(a.date));

  return json({ posts });
};
