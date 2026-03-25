import { gardenQueries, folderQueries } from "./db";
import fs from "node:fs";
import path from "node:path";
import { GARDENS_DIR } from "./paths";

export interface GardenRow {
  id: string;
  name: string;
  display_name: string;
  description: string;
  icon: string;
  icon_type: string;
  published: number;
  sort_order: number;
  created_at: string;
  daily_notes_enabled: number;
  daily_notes_template: string;
  daily_notes_folder: string;
  calendar_enabled: number;
  custom_domain: string;
}

export function getAllGardens(): GardenRow[] {
  return gardenQueries.getAll.all() as GardenRow[];
}

export function getPublicGardens(): GardenRow[] {
  return gardenQueries.getPublic.all() as GardenRow[];
}

export function getGardenNames(): string[] {
  return getAllGardens().map((g) => g.name);
}

export function getPublicGardenNames(): string[] {
  return getPublicGardens().map((g) => g.name);
}

export function getGardenByName(name: string): GardenRow | undefined {
  return gardenQueries.getByName.get(name) as GardenRow | undefined;
}

export function getGardenByCustomDomain(domain: string): GardenRow | undefined {
  return gardenQueries.getByCustomDomain.get(domain) as GardenRow | undefined;
}

export function isValidGarden(name: string): boolean {
  return !!gardenQueries.getByName.get(name);
}

export function createGarden(data: {
  name: string;
  display_name: string;
  description?: string;
  icon?: string;
  icon_type?: string;
  published?: boolean;
}): GardenRow {
  const slug = data.name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");

  if (!slug) throw new Error("Invalid garden name");
  if (gardenQueries.getByName.get(slug)) {
    throw new Error(`Garden "${slug}" already exists`);
  }

  // Get next sort order
  const all = getAllGardens();
  const maxSort = all.reduce((max, g) => Math.max(max, g.sort_order), -1);

  const id = crypto.randomUUID();
  gardenQueries.create.run(
    id,
    slug,
    data.display_name || slug,
    data.description || "",
    data.icon || "",
    data.icon_type || "emoji",
    data.published ? 1 : 0,
    maxSort + 1
  );

  // Create filesystem directories
  fs.mkdirSync(path.join(GARDENS_DIR, slug, "notes"), { recursive: true });
  fs.mkdirSync(path.join(GARDENS_DIR, slug, "templates"), { recursive: true });

  // Create directories for all global folders
  const globalFolders = folderQueries.getGlobal.all() as Array<{ name: string }>;
  for (const folder of globalFolders) {
    fs.mkdirSync(path.join(GARDENS_DIR, slug, "notes", folder.name), { recursive: true });
  }

  return gardenQueries.getById.get(id) as GardenRow;
}

export function updateGarden(
  id: string,
  data: {
    display_name?: string;
    description?: string;
    icon?: string;
    icon_type?: string;
    published?: boolean;
    sort_order?: number;
    custom_domain?: string;
  }
): GardenRow | null {
  const existing = gardenQueries.getById.get(id) as GardenRow | undefined;
  if (!existing) return null;

  gardenQueries.update.run(
    data.display_name ?? existing.display_name,
    data.description ?? existing.description,
    data.icon ?? existing.icon,
    data.icon_type ?? existing.icon_type,
    data.published !== undefined ? (data.published ? 1 : 0) : existing.published,
    data.sort_order ?? existing.sort_order,
    data.custom_domain ?? existing.custom_domain,
    id
  );

  return gardenQueries.getById.get(id) as GardenRow;
}

export function renameGarden(id: string, newName: string): boolean {
  const existing = gardenQueries.getById.get(id) as GardenRow | undefined;
  if (!existing || existing.name === "private") return false;

  const slug = newName
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
  if (!slug || slug === existing.name) return false;
  if (gardenQueries.getByName.get(slug)) return false;

  // Rename filesystem directory
  const oldDir = path.join(GARDENS_DIR, existing.name);
  const newDir = path.join(GARDENS_DIR, slug);
  if (fs.existsSync(oldDir)) {
    fs.renameSync(oldDir, newDir);
  } else {
    fs.mkdirSync(path.join(newDir, "notes"), { recursive: true });
    fs.mkdirSync(path.join(newDir, "templates"), { recursive: true });
  }

  gardenQueries.updateName.run(slug, id);
  return true;
}

export function deleteGarden(id: string): { success: boolean; error?: string } {
  const existing = gardenQueries.getById.get(id) as GardenRow | undefined;
  if (!existing) return { success: false, error: "Garden not found" };
  if (existing.name === "private") return { success: false, error: "Cannot delete the private garden" };

  // Check if garden has notes
  const notesDir = path.join(GARDENS_DIR, existing.name, "notes");
  if (fs.existsSync(notesDir)) {
    const files = fs.readdirSync(notesDir).filter((f) => f.endsWith(".md"));
    if (files.length > 0) {
      return { success: false, error: `Garden has ${files.length} note(s) — move or delete them first` };
    }
  }

  gardenQueries.delete.run(id);

  // Remove empty directories
  const gardenDir = path.join(GARDENS_DIR, existing.name);
  if (fs.existsSync(gardenDir)) {
    fs.rmSync(gardenDir, { recursive: true, force: true });
  }

  return { success: true };
}

export function reorderGardens(order: Array<{ id: string; sort_order: number }>) {
  for (const item of order) {
    gardenQueries.reorder.run(item.sort_order, item.id);
  }
}

/**
 * Get note count for a garden by checking the filesystem.
 */
export function getGardenNoteCount(gardenName: string): number {
  const notesDir = path.join(GARDENS_DIR, gardenName, "notes");
  if (!fs.existsSync(notesDir)) return 0;
  return countMarkdownFiles(notesDir);
}

export function updateGardenConfig(
  id: string,
  config: {
    daily_notes_enabled?: boolean;
    daily_notes_template?: string;
    daily_notes_folder?: string;
    calendar_enabled?: boolean;
  }
): GardenRow | null {
  const existing = gardenQueries.getById.get(id) as GardenRow | undefined;
  if (!existing) return null;

  gardenQueries.updateConfig.run(
    config.daily_notes_enabled !== undefined ? (config.daily_notes_enabled ? 1 : 0) : existing.daily_notes_enabled,
    config.daily_notes_template ?? existing.daily_notes_template,
    config.daily_notes_folder ?? existing.daily_notes_folder,
    config.calendar_enabled !== undefined ? (config.calendar_enabled ? 1 : 0) : existing.calendar_enabled,
    id
  );

  // Ensure the daily notes folder directory exists
  const folder = config.daily_notes_folder ?? existing.daily_notes_folder;
  if (folder) {
    fs.mkdirSync(path.join(GARDENS_DIR, existing.name, "notes", folder), { recursive: true });
  }

  return gardenQueries.getById.get(id) as GardenRow;
}

function countMarkdownFiles(dir: string): number {
  let count = 0;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (entry.isDirectory()) {
      count += countMarkdownFiles(path.join(dir, entry.name));
    } else if (entry.name.endsWith(".md")) {
      count++;
    }
  }
  return count;
}
