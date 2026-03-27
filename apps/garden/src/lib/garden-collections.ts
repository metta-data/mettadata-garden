import { getCollection, type CollectionEntry } from "astro:content";

export interface GardenEntry {
  garden: string;
  noteSlug: string;
  entry: CollectionEntry<"gardens">;
}

/**
 * Parse garden name and note slug from a unified collection entry ID.
 * Entry IDs are like "spiritual/notes/stoicism" — garden is the first segment,
 * "notes" is skipped, and the rest is the note slug.
 */
function parseEntryId(id: string): { garden: string; noteSlug: string } {
  const parts = id.split("/");
  const garden = parts[0];
  // Skip "notes" segment (index 1)
  const noteSlug = parts.slice(2).join("/");
  return { garden, noteSlug };
}

export async function getAllGardenNotes(): Promise<GardenEntry[]> {
  const entries = await getCollection("gardens");
  return entries.map((entry) => {
    const { garden, noteSlug } = parseEntryId(entry.id);
    return { garden, noteSlug, entry };
  });
}

export async function getGardenNotes(garden: string): Promise<GardenEntry[]> {
  const all = await getAllGardenNotes();
  return all.filter((e) => e.garden === garden);
}

export function isPublishable(
  garden: string,
  note: { data?: { publish: boolean }; publish?: boolean }
): boolean {
  const publish = note.data?.publish ?? note.publish ?? false;
  return garden !== "private" && publish;
}
