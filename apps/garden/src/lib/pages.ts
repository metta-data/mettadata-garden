import fs from "node:fs";
import path from "node:path";
import { CONTENT_DIR } from "./paths";

const PAGES_DIR = path.join(CONTENT_DIR, "pages");

export interface PageMeta {
  title: string;
  description?: string;
  nav_order?: number;
  nav_label?: string;
  draft?: boolean;
}

export interface PageEntry {
  slug: string;
  meta: PageMeta;
  html: string;
}

/**
 * Parse HTML comment frontmatter from the top of a file:
 * <!--
 * title: About
 * description: About me
 * nav_order: 1
 * -->
 */
function parseMeta(raw: string): { meta: PageMeta; html: string } {
  const match = raw.match(/^<!--\s*\n([\s\S]*?)\n\s*-->\s*\n?/);
  if (!match) {
    return { meta: { title: "Untitled" }, html: raw };
  }

  const meta: Record<string, string | number | boolean> = {};
  for (const line of match[1].split("\n")) {
    const idx = line.indexOf(":");
    if (idx === -1) continue;
    const key = line.slice(0, idx).trim();
    const val = line.slice(idx + 1).trim();
    if (val === "true") meta[key] = true;
    else if (val === "false") meta[key] = false;
    else if (/^\d+$/.test(val)) meta[key] = Number(val);
    else meta[key] = val;
  }

  return {
    meta: { title: "Untitled", ...meta } as unknown as PageMeta,
    html: raw.slice(match[0].length),
  };
}

export function getPage(slug: string): PageEntry | undefined {
  const filePath = path.join(PAGES_DIR, `${slug}.html`);
  if (!fs.existsSync(filePath)) return undefined;

  const raw = fs.readFileSync(filePath, "utf-8");
  const { meta, html } = parseMeta(raw);

  return { slug, meta, html };
}

export function getPublicPage(slug: string): PageEntry | undefined {
  const page = getPage(slug);
  if (!page || page.meta.draft) return undefined;
  return page;
}

export function getAllPages(): PageEntry[] {
  if (!fs.existsSync(PAGES_DIR)) return [];

  const results: PageEntry[] = [];
  for (const file of fs.readdirSync(PAGES_DIR)) {
    if (!file.endsWith(".html")) continue;
    const slug = file.replace(/\.html$/, "");
    const raw = fs.readFileSync(path.join(PAGES_DIR, file), "utf-8");
    const { meta, html } = parseMeta(raw);
    results.push({ slug, meta, html });
  }
  return results.sort((a, b) => a.slug.localeCompare(b.slug));
}

function serializeMeta(meta: PageMeta): string {
  const lines: string[] = [];
  lines.push(`title: ${meta.title}`);
  if (meta.description) lines.push(`description: ${meta.description}`);
  if (meta.nav_order !== undefined) lines.push(`nav_order: ${meta.nav_order}`);
  if (meta.nav_label) lines.push(`nav_label: ${meta.nav_label}`);
  if (meta.draft) lines.push(`draft: true`);
  return `<!--\n${lines.join("\n")}\n-->\n`;
}

export function writePage(slug: string, meta: PageMeta, html: string): void {
  fs.mkdirSync(PAGES_DIR, { recursive: true });
  const filePath = path.join(PAGES_DIR, `${slug}.html`);
  fs.writeFileSync(filePath, serializeMeta(meta) + html, "utf-8");
}

export function deletePage(slug: string): boolean {
  const filePath = path.join(PAGES_DIR, `${slug}.html`);
  if (!fs.existsSync(filePath)) return false;
  fs.unlinkSync(filePath);
  return true;
}

export function getNavPages(): Array<{ slug: string; label: string; order: number }> {
  if (!fs.existsSync(PAGES_DIR)) return [];

  const results: Array<{ slug: string; label: string; order: number }> = [];

  for (const file of fs.readdirSync(PAGES_DIR)) {
    if (!file.endsWith(".html")) continue;
    const slug = file.replace(/\.html$/, "");
    const raw = fs.readFileSync(path.join(PAGES_DIR, file), "utf-8");
    const { meta } = parseMeta(raw);
    if (meta.draft || meta.nav_order === undefined) continue;
    results.push({
      slug,
      label: meta.nav_label || meta.title,
      order: meta.nav_order,
    });
  }

  return results.sort((a, b) => a.order - b.order);
}
