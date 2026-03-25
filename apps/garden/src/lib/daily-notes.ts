import fs from "node:fs";
import path from "node:path";
import type { GardenRow } from "./gardens";
import { getTemplatesForGarden } from "./templates";
import { processTemplate } from "./template-engine";
import { GARDENS_DIR } from "./paths";

export function getDailyNoteSlug(date: Date): string {
  return date.toISOString().split("T")[0]; // "2026-03-25"
}

export function getDailyNoteTitle(date: Date): string {
  return date.toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}

export function getDailyNotePath(gardenName: string, folder: string, date: Date): string {
  const slug = getDailyNoteSlug(date);
  return path.join(GARDENS_DIR, gardenName, "notes", folder, `${slug}.md`);
}

export function dailyNoteExists(gardenName: string, folder: string, date: Date): boolean {
  return fs.existsSync(getDailyNotePath(gardenName, folder, date));
}

export function createDailyNote(
  gardenName: string,
  garden: GardenRow,
  date: Date
): { slug: string; urlPath: string } {
  const folder = garden.daily_notes_folder || "journal";
  const dateSlug = getDailyNoteSlug(date);
  const title = getDailyNoteTitle(date);
  const notePath = getDailyNotePath(gardenName, folder, date);

  if (fs.existsSync(notePath)) {
    return {
      slug: `${folder}/${dateSlug}`,
      urlPath: `/garden/${gardenName}/${folder}/${dateSlug}`,
    };
  }

  // Ensure folder exists
  fs.mkdirSync(path.dirname(notePath), { recursive: true });

  // Load template body if configured, and process variables
  let templateBody = "";
  if (garden.daily_notes_template) {
    const templates = getTemplatesForGarden(gardenName);
    const tmpl = templates.find((t) => t.name === garden.daily_notes_template);
    if (tmpl?.body) {
      templateBody = processTemplate(tmpl.body, {
        title,
        garden: gardenName,
        folder,
      });
    }
  }

  const now = dateSlug;
  const frontmatter = [
    "---",
    `title: "${title}"`,
    `aliases: []`,
    `stage: seed`,
    `tags: [journal, daily]`,
    `created: ${now}`,
    `updated: ${now}`,
    `publish: false`,
    `seeded: false`,
    "---",
  ].join("\n");

  fs.writeFileSync(notePath, `${frontmatter}\n\n${templateBody}\n`, "utf-8");

  return {
    slug: `${folder}/${dateSlug}`,
    urlPath: `/garden/${gardenName}/${folder}/${dateSlug}`,
  };
}

export interface JournalEntry {
  date: string;
  slug: string;
  wordCount: number;
  title: string;
}

export function getJournalEntries(
  gardenName: string,
  folder: string,
  year: number,
  month: number
): JournalEntry[] {
  const folderDir = path.join(GARDENS_DIR, gardenName, "notes", folder);
  if (!fs.existsSync(folderDir)) return [];

  const entries: JournalEntry[] = [];
  const prefix = `${year}-${String(month).padStart(2, "0")}`;

  for (const file of fs.readdirSync(folderDir)) {
    if (!file.endsWith(".md")) continue;
    const dateStr = file.replace(/\.md$/, "");
    if (!dateStr.startsWith(prefix)) continue;
    if (!/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) continue;

    const filePath = path.join(folderDir, file);
    const content = fs.readFileSync(filePath, "utf-8");

    // Strip frontmatter and count words in body
    const body = content.replace(/^---\n[\s\S]*?\n---/, "").trim();
    const wordCount = body ? body.split(/\s+/).length : 0;

    // Extract title from frontmatter
    const titleMatch = content.match(/^title:\s*["']?(.+?)["']?\s*$/m);
    const title = titleMatch ? titleMatch[1] : dateStr;

    entries.push({
      date: dateStr,
      slug: `${folder}/${dateStr}`,
      wordCount,
      title,
    });
  }

  return entries.sort((a, b) => a.date.localeCompare(b.date));
}
