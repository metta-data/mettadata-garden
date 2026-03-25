import type { WikilinkResolution } from "@mettadata/remark-garden";
import { getAllGardenNotes } from "./garden-collections";

export interface GardenResolutionMaps {
  qualified: Map<string, WikilinkResolution>;
  unqualified: Map<string, WikilinkResolution[]>;
}

/**
 * Builds resolution maps from all garden collections (async version).
 * Used in pages at render time when content collections are available.
 */
export async function buildResolutionMap(): Promise<GardenResolutionMaps> {
  const allNotes = await getAllGardenNotes();
  const qualified = new Map<string, WikilinkResolution>();
  const unqualified = new Map<string, WikilinkResolution[]>();

  for (const { garden, entry: note } of allNotes) {
    const isPrivate = garden === "private";
    const url = `/garden/${garden}/${note.id}`;
    const resolution: WikilinkResolution = { url, isPrivate, garden };

    const keys = [
      note.data.title.toLowerCase(),
      ...note.data.aliases.map((a: string) => a.toLowerCase()),
    ];

    // Also map by slug/filename
    const slug = note.id.split("/").pop()?.replace(/\.md$/, "") || note.id;
    keys.push(slug.toLowerCase());

    for (const key of keys) {
      qualified.set(`${garden}/${key}`, resolution);

      const existing = unqualified.get(key) || [];
      existing.push(resolution);
      unqualified.set(key, existing);
    }
  }

  return { qualified, unqualified };
}

/**
 * Checks if a note should be published (not in private garden, publish=true).
 */
export function isPublishable(
  garden: string,
  note: { data: { publish: boolean } }
): boolean {
  return garden !== "private" && note.data.publish;
}
