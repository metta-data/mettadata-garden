import { getAllGardenNotes } from "./garden-collections";

export interface LinkGraphEntry {
  id: string;
  title: string;
  garden: string;
  stage: string;
  outgoing: string[]; // note IDs this note links to
  incoming: string[]; // note IDs that link to this note
}

export type LinkGraph = Record<string, LinkGraphEntry>;

// Match [[Target]], [[Target|Display]], or [[garden/Target]]
const WIKILINK_REGEX = /\[\[(?:(\w+)\/)?([^\]|]+)(?:\|[^\]]+)?\]\]/g;

/**
 * Builds a complete link graph from all garden notes.
 * Node IDs are garden-qualified: "<garden>/<noteId>" to avoid collisions.
 * Returns a map of qualified note ID → { outgoing links, incoming backlinks }.
 */
export async function buildLinkGraph(): Promise<LinkGraph> {
  const allNotes = await getAllGardenNotes();
  const graph: LinkGraph = {};

  // Build a lookup from lowercase title/alias → qualified ID
  // For same-garden resolution, also track per-garden lookups
  const titleToId = new Map<string, string>();
  const gardenTitleToId = new Map<string, string>();

  for (const { garden, entry: note } of allNotes) {
    const qualifiedId = `${garden}/${note.id}`;
    const title = note.data.title.toLowerCase();
    const slug = note.id.split("/").pop()?.replace(/\.md$/, "") || note.id;

    // Qualified lookups: "garden/title"
    gardenTitleToId.set(`${garden}/${title}`, qualifiedId);
    gardenTitleToId.set(`${garden}/${slug.toLowerCase()}`, qualifiedId);
    for (const alias of note.data.aliases) {
      gardenTitleToId.set(`${garden}/${alias.toLowerCase()}`, qualifiedId);
    }

    // Unqualified: first match wins
    if (!titleToId.has(title)) titleToId.set(title, qualifiedId);
    if (!titleToId.has(slug.toLowerCase())) titleToId.set(slug.toLowerCase(), qualifiedId);
    for (const alias of note.data.aliases) {
      if (!titleToId.has(alias.toLowerCase())) titleToId.set(alias.toLowerCase(), qualifiedId);
    }

    graph[qualifiedId] = {
      id: qualifiedId,
      title: note.data.title,
      garden,
      stage: note.data.stage,
      outgoing: [],
      incoming: [],
    };
  }

  // Parse wikilinks from each note's body to build outgoing links
  for (const { garden, entry: note } of allNotes) {
    const qualifiedId = `${garden}/${note.id}`;
    const body = note.body || "";
    const matches = [...body.matchAll(WIKILINK_REGEX)];

    for (const match of matches) {
      const [, gardenPrefix, target] = match;
      const targetKey = target.trim().toLowerCase();

      let targetId: string | undefined;
      if (gardenPrefix) {
        // Explicit garden prefix
        targetId = gardenTitleToId.get(`${gardenPrefix.toLowerCase()}/${targetKey}`);
      } else {
        // Same-garden first, then global fallback
        targetId = gardenTitleToId.get(`${garden}/${targetKey}`) || titleToId.get(targetKey);
      }

      if (targetId && targetId !== qualifiedId) {
        if (!graph[qualifiedId].outgoing.includes(targetId)) {
          graph[qualifiedId].outgoing.push(targetId);
        }
      }
    }
  }

  // Build incoming (backlinks) from outgoing
  for (const [id, entry] of Object.entries(graph)) {
    for (const targetId of entry.outgoing) {
      if (graph[targetId] && !graph[targetId].incoming.includes(id)) {
        graph[targetId].incoming.push(id);
      }
    }
  }

  return graph;
}
