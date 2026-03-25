import { useState, useEffect, useCallback, useRef } from "react";

export interface NoteEntry {
  slug: string;
  title: string;
  aliases: string[];
  garden: string;
}

export interface NoteMatch {
  title: string;
  slug: string;
  garden: string;
  /** If the match came from an alias, this is the alias that matched */
  matchedAlias?: string;
}

export function useNoteList() {
  const [notes, setNotes] = useState<NoteEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const notesRef = useRef<NoteEntry[]>([]);

  const fetchNotes = useCallback(async () => {
    try {
      const res = await fetch("/api/notes");
      if (!res.ok) return;
      const data = await res.json();
      const entries: NoteEntry[] = (data.notes || []).map((n: any) => ({
        slug: n.slug,
        title: n.title,
        aliases: n.aliases || [],
        garden: n.garden || "",
      }));
      setNotes(entries);
      notesRef.current = entries;
    } catch {
      // silently fail — user may not be authenticated
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchNotes();
  }, [fetchNotes]);

  const findMatches = useCallback(
    (query: string, limit = 10): NoteMatch[] => {
      if (!query.trim()) {
        // Return all notes (up to limit) when query is empty
        return notesRef.current.slice(0, limit).map((n) => ({
          title: n.title,
          slug: n.slug,
          garden: n.garden,
        }));
      }

      const q = query.toLowerCase().trim();
      const matches: NoteMatch[] = [];
      const seen = new Set<string>();

      for (const note of notesRef.current) {
        if (matches.length >= limit) break;

        const noteKey = `${note.garden}/${note.slug}`;

        // Check title match
        if (note.title.toLowerCase().includes(q)) {
          if (!seen.has(noteKey)) {
            seen.add(noteKey);
            matches.push({ title: note.title, slug: note.slug, garden: note.garden });
          }
          continue;
        }

        // Check alias matches
        for (const alias of note.aliases) {
          if (matches.length >= limit) break;
          if (alias.toLowerCase().includes(q) && !seen.has(noteKey)) {
            seen.add(noteKey);
            matches.push({
              title: note.title,
              slug: note.slug,
              garden: note.garden,
              matchedAlias: alias,
            });
            break;
          }
        }
      }

      return matches;
    },
    []
  );

  const noteExists = useCallback((title: string): boolean => {
    const t = title.toLowerCase().trim();
    return notesRef.current.some(
      (n) =>
        n.title.toLowerCase() === t ||
        n.slug.toLowerCase() === t ||
        n.aliases.some((a) => a.toLowerCase() === t)
    );
  }, []);

  const refresh = useCallback(() => {
    fetchNotes();
  }, [fetchNotes]);

  return { notes, loading, findMatches, noteExists, refresh };
}
