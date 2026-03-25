import { folderQueries } from "./db";
import { getAllGardens } from "./gardens";
import fs from "node:fs";
import path from "node:path";
import { GARDENS_DIR } from "./paths";

export interface FolderRow {
  id: string;
  name: string;
  display_name: string;
  icon: string;
  is_global: number;
  garden_id: string | null;
  default_template: string;
  created_at: string;
}

export function getAllFolders(): FolderRow[] {
  return folderQueries.getAll.all() as FolderRow[];
}

export function getGlobalFolders(): FolderRow[] {
  return folderQueries.getGlobal.all() as FolderRow[];
}

export function getFoldersForGarden(gardenId: string): FolderRow[] {
  return folderQueries.getForGarden.all(gardenId) as FolderRow[];
}

export function getFolderById(id: string): FolderRow | undefined {
  return folderQueries.getById.get(id) as FolderRow | undefined;
}

export function createFolder(data: {
  name: string;
  display_name: string;
  icon?: string;
  is_global: boolean;
  garden_id?: string | null;
}): FolderRow {
  const slug = data.name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");

  if (!slug) throw new Error("Invalid folder name");

  const id = crypto.randomUUID();
  folderQueries.create.run(
    id,
    slug,
    data.display_name || slug,
    data.icon || "",
    data.is_global ? 1 : 0,
    data.is_global ? null : (data.garden_id || null)
  );

  // Create filesystem directories
  if (data.is_global) {
    // Create in every garden
    for (const garden of getAllGardens()) {
      fs.mkdirSync(path.join(GARDENS_DIR, garden.name, "notes", slug), { recursive: true });
    }
  } else if (data.garden_id) {
    // Create in the specific garden
    const garden = getAllGardens().find((g) => g.id === data.garden_id);
    if (garden) {
      fs.mkdirSync(path.join(GARDENS_DIR, garden.name, "notes", slug), { recursive: true });
    }
  }

  return folderQueries.getById.get(id) as FolderRow;
}

export function updateFolder(id: string, data: { display_name?: string; icon?: string; default_template?: string }): FolderRow | null {
  const existing = folderQueries.getById.get(id) as FolderRow | undefined;
  if (!existing) return null;

  folderQueries.update.run(
    data.display_name ?? existing.display_name,
    data.icon ?? existing.icon,
    data.default_template ?? existing.default_template,
    id
  );

  return folderQueries.getById.get(id) as FolderRow;
}

export function deleteFolder(id: string): { success: boolean; error?: string } {
  const existing = folderQueries.getById.get(id) as FolderRow | undefined;
  if (!existing) return { success: false, error: "Folder not found" };

  // Check if folder has notes in any garden
  if (existing.is_global) {
    for (const garden of getAllGardens()) {
      const folderDir = path.join(GARDENS_DIR, garden.name, "notes", existing.name);
      if (fs.existsSync(folderDir) && countFiles(folderDir) > 0) {
        return { success: false, error: `Folder has notes in ${garden.display_name} — remove them first` };
      }
    }
  } else if (existing.garden_id) {
    const garden = getAllGardens().find((g) => g.id === existing.garden_id);
    if (garden) {
      const folderDir = path.join(GARDENS_DIR, garden.name, "notes", existing.name);
      if (fs.existsSync(folderDir) && countFiles(folderDir) > 0) {
        return { success: false, error: "Folder has notes — remove them first" };
      }
    }
  }

  folderQueries.delete.run(id);
  return { success: true };
}

function countFiles(dir: string): number {
  let count = 0;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (entry.isDirectory()) count += countFiles(path.join(dir, entry.name));
    else if (entry.name.endsWith(".md")) count++;
  }
  return count;
}

/**
 * Ensure all global folder directories exist in the given garden.
 */
export function ensureGlobalFolderDirs(gardenName: string) {
  for (const folder of getGlobalFolders()) {
    fs.mkdirSync(path.join(GARDENS_DIR, gardenName, "notes", folder.name), { recursive: true });
  }
}
