import fs from "node:fs";
import path from "node:path";
import { GARDENS_DIR } from "./paths";

export interface NoteInfo {
  slug: string;
  title: string;
  description: string;
  aliases: string[];
  garden: string;
  stage: string;
  tags: string[];
  publish: boolean;
  created: Date;
  updated: Date;
}

/**
 * Read all notes from the filesystem (not Astro content collections).
 * This works for runtime-created files that content collections miss.
 */
export function readAllNotes(): NoteInfo[] {
  const results: NoteInfo[] = [];

  if (!fs.existsSync(GARDENS_DIR)) return results;

  for (const gardenEntry of fs.readdirSync(GARDENS_DIR, { withFileTypes: true })) {
    if (!gardenEntry.isDirectory() || gardenEntry.name.startsWith(".")) continue;
    const notesDir = path.join(GARDENS_DIR, gardenEntry.name, "notes");
    results.push(...readNotesFromDir(notesDir, gardenEntry.name));
  }

  return results;
}

function readNotesFromDir(dir: string, garden: string): NoteInfo[] {
  const results: NoteInfo[] = [];
  if (!fs.existsSync(dir)) return results;

  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory() && !entry.name.startsWith(".")) {
      results.push(...readNotesFromDir(fullPath, garden));
    } else if (entry.name.endsWith(".md")) {
      const note = parseNoteFile(fullPath, dir, garden);
      if (note) results.push(note);
    }
  }

  return results;
}

function parseNoteFile(filePath: string, baseDir: string, garden: string): NoteInfo | null {
  const content = fs.readFileSync(filePath, "utf-8");
  const fmMatch = content.match(/^---\n([\s\S]*?)\n---/);
  if (!fmMatch) return null;

  const fm = fmMatch[1];
  const title = fm.match(/^title:\s*["']?(.+?)["']?\s*$/m)?.[1] || path.basename(filePath, ".md");
  const description = fm.match(/^description:\s*["']?(.+?)["']?\s*$/m)?.[1] || "";
  const stage = fm.match(/^stage:\s*(\w+)/m)?.[1] || "seed";
  const publish = fm.includes("publish: true");

  const aliasMatch = fm.match(/^aliases:\s*\[([^\]]*)\]/m)?.[1];
  const aliases = aliasMatch
    ? aliasMatch.split(",").map((a) => a.trim().replace(/['"]/g, "")).filter(Boolean)
    : [];

  const tagsMatch = fm.match(/^tags:\s*\[([^\]]*)\]/m)?.[1];
  const tags = tagsMatch
    ? tagsMatch.split(",").map((t) => t.trim().replace(/['"]/g, "")).filter(Boolean)
    : [];

  const createdStr = fm.match(/^created:\s*(.+)$/m)?.[1]?.trim() || "";
  const updatedStr = fm.match(/^updated:\s*(.+)$/m)?.[1]?.trim() || "";

  const slug = path.relative(baseDir, filePath).replace(/\.md$/, "");

  return {
    slug,
    title,
    description,
    aliases,
    garden,
    stage,
    tags,
    publish,
    created: createdStr ? new Date(createdStr) : new Date(),
    updated: updatedStr ? new Date(updatedStr) : new Date(),
  };
}
