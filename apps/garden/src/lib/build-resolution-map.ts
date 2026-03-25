import fs from "node:fs";
import path from "node:path";
import type { WikilinkResolution } from "@mettadata/remark-garden";

const FRONTMATTER_REGEX = /^---\n([\s\S]*?)\n---/;
const TITLE_REGEX = /^title:\s*["']?(.+?)["']?\s*$/m;
const ALIASES_REGEX = /^aliases:\s*\[([^\]]*)\]/m;
const PUBLISH_REGEX = /^publish:\s*(true|false)/m;

interface NoteInfo {
  title: string;
  aliases: string[];
  garden: string;
  publish: boolean;
  slug: string;
  filePath: string;
}

function parseNoteFile(filePath: string, notesDir: string, garden: string): NoteInfo | null {
  const content = fs.readFileSync(filePath, "utf-8");
  const fmMatch = content.match(FRONTMATTER_REGEX);
  if (!fmMatch) return null;

  const fm = fmMatch[1];

  const titleMatch = fm.match(TITLE_REGEX);
  if (!titleMatch) return null;

  const aliasesMatch = fm.match(ALIASES_REGEX);
  const aliases = aliasesMatch
    ? aliasesMatch[1]
        .split(",")
        .map((a) => a.trim().replace(/['"]/g, ""))
        .filter(Boolean)
    : [];

  const publishMatch = fm.match(PUBLISH_REGEX);
  const publish = publishMatch ? publishMatch[1] === "true" : false;

  const relativePath = path.relative(notesDir, filePath);
  const slug = relativePath.replace(/\.md$/, "");

  return {
    title: titleMatch[1],
    aliases,
    garden,
    publish,
    slug,
    filePath,
  };
}

function findMarkdownFiles(dir: string): string[] {
  const results: string[] = [];
  if (!fs.existsSync(dir)) return results;

  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      results.push(...findMarkdownFiles(fullPath));
    } else if (entry.name.endsWith(".md")) {
      results.push(fullPath);
    }
  }
  return results;
}

/**
 * Discover garden names by scanning the filesystem for subdirectories.
 * This runs at Astro config time before the DB is necessarily available.
 */
function discoverGardens(gardensContentDir: string): string[] {
  if (!fs.existsSync(gardensContentDir)) return [];
  return fs
    .readdirSync(gardensContentDir, { withFileTypes: true })
    .filter((e) => e.isDirectory())
    .map((e) => e.name);
}

export interface GardenResolutionMaps {
  qualified: Map<string, WikilinkResolution>;
  unqualified: Map<string, WikilinkResolution[]>;
}

/**
 * Builds the wikilink resolution maps by reading markdown files directly
 * from the filesystem. This runs at Astro config time before content
 * collections are available.
 *
 * Discovers gardens dynamically by scanning subdirectories.
 */
export function buildResolutionMapSync(
  gardensContentDir: string
): GardenResolutionMaps {
  const qualified = new Map<string, WikilinkResolution>();
  const unqualified = new Map<string, WikilinkResolution[]>();

  const gardenNames = discoverGardens(gardensContentDir);

  for (const garden of gardenNames) {
    const notesDir = path.join(gardensContentDir, garden, "notes");
    const files = findMarkdownFiles(notesDir);

    for (const filePath of files) {
      const note = parseNoteFile(filePath, notesDir, garden);
      if (!note) continue;

      const isPrivate = garden === "private" || !note.publish;
      const url = `/garden/${garden}/${note.slug}`;
      const resolution: WikilinkResolution = { url, isPrivate, garden };

      const keys = [
        note.title.toLowerCase(),
        ...note.aliases.map((a) => a.toLowerCase()),
        path.basename(note.slug).toLowerCase(),
      ];

      for (const key of keys) {
        qualified.set(`${garden}/${key}`, resolution);

        const existing = unqualified.get(key) || [];
        existing.push(resolution);
        unqualified.set(key, existing);
      }
    }
  }

  return { qualified, unqualified };
}
