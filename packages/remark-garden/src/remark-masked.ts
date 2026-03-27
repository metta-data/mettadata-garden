import type { Root, PhrasingContent } from "mdast";
import { visit } from "unist-util-visit";

// Match %%masked content%% (non-greedy)
const MASKED_REGEX = /%%(.+?)%%/g;

/**
 * Remark plugin that transforms %%masked text%% into HTML spans
 * that are hidden by default and revealed via CSS for authorized users.
 */
export function remarkMasked() {
  return (tree: Root) => {
    visit(tree, "text", (node, index, parent) => {
      if (!parent || index === undefined) return;

      const value = node.value;
      const matches = [...value.matchAll(MASKED_REGEX)];
      if (matches.length === 0) return;

      const children: PhrasingContent[] = [];
      let lastIndex = 0;

      for (const match of matches) {
        const [fullMatch, content] = match;
        const matchStart = match.index!;

        // Add text before this match
        if (matchStart > lastIndex) {
          children.push({
            type: "text",
            value: value.slice(lastIndex, matchStart),
          });
        }

        // Add masked span
        children.push({
          type: "html",
          value: `<span class="masked-content">${content}</span>`,
        } as unknown as PhrasingContent);

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
