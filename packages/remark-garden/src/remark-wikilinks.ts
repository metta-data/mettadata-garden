import type { Root, PhrasingContent } from "mdast";
import { visit } from "unist-util-visit";

export interface WikilinkResolution {
  url: string;
  isPrivate: boolean;
  garden: string;
}

export interface RemarkWikilinksOptions {
  /**
   * Map from "garden/lowercase-title" → resolution info.
   */
  qualified: Map<string, WikilinkResolution>;
  /**
   * Map from "lowercase-title" → all resolutions across gardens.
   */
  unqualified: Map<string, WikilinkResolution[]>;
}

// Match [[Target]], [[Target|Display]], or [[garden/Target]] / [[garden/Target|Display]]
const WIKILINK_REGEX = /\[\[(?:(\w+)\/)?([^\]|]+)(?:\|([^\]]+))?\]\]/g;

/**
 * Remark plugin that transforms [[wikilinks]] into HTML links.
 * Supports:
 * - [[Note Title]] → link to the note (same-garden preferred)
 * - [[garden/Note Title]] → link to note in specific garden
 * - [[Note Title|display text]] → link with custom display text
 * - Missing notes → rendered with wikilink-missing class
 * - Private notes → rendered as "(private note)" with no link
 */
export function remarkWikilinks(options: RemarkWikilinksOptions) {
  const { qualified, unqualified } = options;

  return (tree: Root, file?: any) => {
    // Try to determine current garden from file path
    let currentGarden: string | undefined;
    const filePath = file?.path || file?.history?.[0] || "";
    const gardenMatch = filePath.match(/gardens\/(\w+)\/notes\//);
    if (gardenMatch) {
      currentGarden = gardenMatch[1];
    }

    visit(tree, "text", (node, index, parent) => {
      if (!parent || index === undefined) return;

      const value = node.value;
      const matches = [...value.matchAll(WIKILINK_REGEX)];
      if (matches.length === 0) return;

      const children: PhrasingContent[] = [];
      let lastIndex = 0;

      for (const match of matches) {
        const [fullMatch, gardenPrefix, target, displayText] = match;
        const matchStart = match.index!;

        // Add text before this match
        if (matchStart > lastIndex) {
          children.push({
            type: "text",
            value: value.slice(lastIndex, matchStart),
          });
        }

        const lookupKey = target.trim().toLowerCase();
        let resolution: WikilinkResolution | undefined;

        if (gardenPrefix) {
          // Explicit garden prefix: [[garden/Note]]
          resolution = qualified.get(`${gardenPrefix.toLowerCase()}/${lookupKey}`);
        } else {
          // No prefix: prefer same-garden, then fall back to first match
          if (currentGarden) {
            resolution = qualified.get(`${currentGarden}/${lookupKey}`);
          }
          if (!resolution) {
            const candidates = unqualified.get(lookupKey);
            if (candidates && candidates.length > 0) {
              resolution = candidates[0];
            }
          }
        }

        const display = displayText?.trim() || target.trim();

        if (resolution?.isPrivate) {
          // Private note — render as plain text marker
          children.push({
            type: "html",
            value: `<span class="wikilink-private" title="Private note">(private note)</span>`,
          } as unknown as PhrasingContent);
        } else if (resolution) {
          // Resolved link
          children.push({
            type: "link",
            url: resolution.url,
            data: {
              hProperties: { className: ["wikilink"] },
            },
            children: [{ type: "text", value: display }],
          });
        } else {
          // Missing note — red link
          children.push({
            type: "html",
            value: `<span class="wikilink-missing" title="Note not found: ${target.trim()}">${display}</span>`,
          } as unknown as PhrasingContent);
        }

        lastIndex = matchStart + fullMatch.length;
      }

      // Add remaining text after last match
      if (lastIndex < value.length) {
        children.push({
          type: "text",
          value: value.slice(lastIndex),
        });
      }

      // Replace this text node with the new children
      parent.children.splice(index, 1, ...children);
    });
  };
}
