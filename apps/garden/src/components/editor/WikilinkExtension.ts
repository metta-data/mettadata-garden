import { Extension } from "@tiptap/core";
import { Plugin, PluginKey, TextSelection } from "@tiptap/pm/state";
import { Decoration, DecorationSet } from "@tiptap/pm/view";
import type { EditorView } from "@tiptap/pm/view";
import type { EditorState, Transaction } from "@tiptap/pm/state";

// Match [[target]] or [[target|display]] or [[garden/target]] or [[garden/target|display]]
const WIKILINK_REGEX = /\[\[(?:(\w+)\/)?([^\]|]+)(?:\|([^\]]+))?\]\]/g;

// ─── Types ───────────────────────────────────────────────────────

export interface AutocompleteState {
  active: boolean;
  query: string;
  /** Document position of the opening [[ */
  from: number;
  selectedIndex: number;
  /** Viewport coordinates for popup positioning */
  coords: { top: number; left: number };
}

export interface GardenExtensionOptions {
  onPillClick?: (target: string, alias?: string) => void;
  noteExists?: (title: string) => boolean;
  onAutocompleteStateChange?: (state: AutocompleteState | null) => void;
  /** Called when autocomplete selects an item — the plugin needs access to matched items */
  getMatches?: () => Array<{ title: string; slug: string; garden: string; matchedAlias?: string }>;
  /** Current garden context for cross-garden wikilink insertion */
  currentGarden?: string;
}

// ─── Wikilink Decoration Plugin ──────────────────────────────────

function createWikilinkDecorationPlugin(options: GardenExtensionOptions) {
  return new Plugin({
    key: new PluginKey("wikilinkDecoration"),
    props: {
      // Intercept clicks BEFORE ProseMirror processes them
      handleDOMEvents: {
        mousedown(view: EditorView, event: MouseEvent) {
          const target = event.target as HTMLElement;
          if (!target.classList.contains("wikilink-pill")) return false;

          // Prevent ProseMirror from handling this click (which would
          // move cursor into the wikilink and destroy the pill)
          event.preventDefault();
          event.stopPropagation();

          const noteTarget = target.dataset.target;
          const noteAlias = target.dataset.alias;
          if (noteTarget && options.onPillClick) {
            options.onPillClick(noteTarget, noteAlias || undefined);
          }
          return true;
        },
      },

      decorations(state) {
        const decorations: Decoration[] = [];
        const doc = state.doc;
        const cursorPos = state.selection.from;

        doc.descendants((node, pos) => {
          if (!node.isText || !node.text) return;

          const text = node.text;
          let match;
          WIKILINK_REGEX.lastIndex = 0;

          while ((match = WIKILINK_REGEX.exec(text)) !== null) {
            const start = pos + match.index;
            const end = start + match[0].length;
            const gardenPrefix = match[1];
            const target = match[2];
            const display = match[3];

            // If cursor is inside the wikilink, show raw syntax
            if (cursorPos >= start && cursorPos <= end) {
              decorations.push(
                Decoration.inline(start, end, {
                  class: "wikilink-editing",
                })
              );
            } else {
              // Hide raw syntax and show pill
              const label = display?.trim() || target.trim();
              const lookupTitle = target.trim();
              const exists = options.noteExists
                ? options.noteExists(lookupTitle)
                : true;

              decorations.push(
                Decoration.inline(start, end, {
                  class: "wikilink-hidden",
                })
              );
              decorations.push(
                Decoration.widget(start, () => {
                  const span = document.createElement("span");
                  span.className = exists
                    ? "wikilink-pill"
                    : "wikilink-pill wikilink-pill-missing";
                  span.textContent = label;
                  span.title = exists
                    ? `Link to: ${gardenPrefix ? gardenPrefix + "/" : ""}${target.trim()}`
                    : `Create: ${target.trim()}`;
                  // Store data for the mousedown handler
                  span.dataset.target = gardenPrefix
                    ? `${gardenPrefix}/${target.trim()}`
                    : target.trim();
                  if (display?.trim()) {
                    span.dataset.alias = display.trim();
                  }
                  return span;
                })
              );
            }
          }
        });

        return DecorationSet.create(doc, decorations);
      },
    },
  });
}

// ─── Autocomplete Plugin ─────────────────────────────────────────

const autocompletePluginKey = new PluginKey("wikilinkAutocomplete");

interface AutocompletePluginState {
  active: boolean;
  query: string;
  from: number;
  selectedIndex: number;
}

function createAutocompletePlugin(options: GardenExtensionOptions) {
  function getAutocompleteContext(
    state: EditorState
  ): { query: string; from: number } | null {
    const { from } = state.selection;
    const $from = state.doc.resolve(from);
    const textNode = $from.parent;
    if (!textNode.isTextblock) return null;

    // Get text from start of block to cursor
    const startOfBlock = $from.start();
    const textBefore = state.doc.textBetween(startOfBlock, from, "");

    // Find last [[ that doesn't have a ]] after it
    const lastOpen = textBefore.lastIndexOf("[[");
    if (lastOpen === -1) return null;

    const afterOpen = textBefore.slice(lastOpen + 2);
    // If there's a ]] in the text between [[ and cursor, the wikilink is closed
    if (afterOpen.includes("]]")) return null;

    // Don't activate if there's a | (user is typing alias, not searching)
    if (afterOpen.includes("|")) return null;

    return {
      query: afterOpen,
      from: startOfBlock + lastOpen,
    };
  }

  return new Plugin({
    key: autocompletePluginKey,
    state: {
      init(): AutocompletePluginState {
        return { active: false, query: "", from: 0, selectedIndex: 0 };
      },
      apply(
        tr: Transaction,
        prev: AutocompletePluginState,
        _oldState: EditorState,
        newState: EditorState
      ): AutocompletePluginState {
        // Check if we're in a wikilink context
        const context = getAutocompleteContext(newState);
        if (context) {
          return {
            active: true,
            query: context.query,
            from: context.from,
            selectedIndex:
              prev.active && prev.from === context.from
                ? prev.selectedIndex
                : 0,
          };
        }
        return { active: false, query: "", from: 0, selectedIndex: 0 };
      },
    },
    view(editorView) {
      return {
        update(view: EditorView) {
          const pluginState = autocompletePluginKey.getState(
            view.state
          ) as AutocompletePluginState;

          if (pluginState.active) {
            const coords = view.coordsAtPos(view.state.selection.from);
            options.onAutocompleteStateChange?.({
              active: true,
              query: pluginState.query,
              from: pluginState.from,
              selectedIndex: pluginState.selectedIndex,
              coords: { top: coords.bottom, left: coords.left },
            });
          } else {
            options.onAutocompleteStateChange?.(null);
          }
        },
        destroy() {
          options.onAutocompleteStateChange?.(null);
        },
      };
    },
    props: {
      handleKeyDown(view: EditorView, event: KeyboardEvent) {
        const pluginState = autocompletePluginKey.getState(
          view.state
        ) as AutocompletePluginState;
        if (!pluginState.active) return false;

        const matches = options.getMatches?.() || [];
        if (matches.length === 0) return false;

        if (event.key === "ArrowDown") {
          event.preventDefault();
          const newIndex = (pluginState.selectedIndex + 1) % matches.length;
          updateSelectedIndex(view, newIndex);
          return true;
        }

        if (event.key === "ArrowUp") {
          event.preventDefault();
          const newIndex =
            (pluginState.selectedIndex - 1 + matches.length) % matches.length;
          updateSelectedIndex(view, newIndex);
          return true;
        }

        if (event.key === "Enter" || event.key === "Tab") {
          event.preventDefault();
          const selected = matches[pluginState.selectedIndex];
          if (selected) {
            insertWikilinkCompletion(view, pluginState, selected, options.currentGarden);
          }
          return true;
        }

        if (event.key === "Escape") {
          event.preventDefault();
          // Move cursor after ]] to dismiss
          const { state } = view;
          const pos = state.selection.from;
          // Check if ]] follows cursor
          const textAfter =
            pos + 2 <= state.doc.content.size
              ? state.doc.textBetween(pos, pos + 2, "")
              : "";
          if (textAfter === "]]") {
            const tr = state.tr.setSelection(
              TextSelection.create(state.doc, pos + 2)
            );
            view.dispatch(tr);
          }
          return true;
        }

        return false;
      },
    },
  });
}

function updateSelectedIndex(view: EditorView, newIndex: number) {
  // Dispatch a no-op transaction to trigger plugin state recomputation
  // We use metadata to pass the new index
  const tr = view.state.tr.setMeta(autocompletePluginKey, {
    selectedIndex: newIndex,
  });
  view.dispatch(tr);
}

function insertWikilinkCompletion(
  view: EditorView,
  pluginState: AutocompletePluginState,
  match: { title: string; slug: string; garden: string; matchedAlias?: string },
  currentGarden?: string
) {
  const { state } = view;
  const cursorPos = state.selection.from;

  // Determine replacement range: from [[ to cursor + any trailing ]]
  const replaceFrom = pluginState.from;
  let replaceTo = cursorPos;

  // Check if ]] follows cursor (from auto-bracket)
  const textAfter =
    replaceTo + 2 <= state.doc.content.size
      ? state.doc.textBetween(replaceTo, replaceTo + 2, "")
      : "";
  if (textAfter === "]]") {
    replaceTo += 2;
  }

  // Build the wikilink text
  // If the note is in a different garden, use garden prefix
  const needsGardenPrefix = currentGarden && match.garden !== currentGarden;
  const prefix = needsGardenPrefix ? `${match.garden}/` : "";

  let wikilinkText: string;
  if (match.matchedAlias) {
    wikilinkText = `[[${prefix}${match.title}|${match.matchedAlias}]]`;
  } else {
    wikilinkText = `[[${prefix}${match.title}]]`;
  }

  const tr = state.tr.insertText(wikilinkText, replaceFrom, replaceTo);
  // Place cursor after the closing ]]
  tr.setSelection(
    TextSelection.create(tr.doc, replaceFrom + wikilinkText.length)
  );
  view.dispatch(tr);
}

// Override apply to handle selectedIndex updates via metadata
const originalCreateAutocompletePlugin = createAutocompletePlugin;
// We need to patch the state.apply to handle meta
function createAutocompletePluginPatched(
  options: GardenExtensionOptions
): Plugin {
  const plugin = originalCreateAutocompletePlugin(options);

  // Patch the state spec to handle metadata
  const origApply = (plugin.spec.state as any).apply;
  (plugin.spec.state as any).apply = function (
    tr: Transaction,
    prev: AutocompletePluginState,
    oldState: EditorState,
    newState: EditorState
  ): AutocompletePluginState {
    const meta = tr.getMeta(autocompletePluginKey);
    if (meta && typeof meta.selectedIndex === "number") {
      return { ...prev, selectedIndex: meta.selectedIndex };
    }
    return origApply(tr, prev, oldState, newState);
  };

  return plugin;
}

// ─── Auto-Bracket Plugin ─────────────────────────────────────────

const autoBracketPlugin = new Plugin({
  key: new PluginKey("autoBracket"),
  props: {
    handleTextInput(
      view: EditorView,
      from: number,
      to: number,
      text: string
    ) {
      const { state } = view;

      // Check character before cursor
      const charBefore =
        from > 0 ? state.doc.textBetween(from - 1, from, "") : "";

      // Typing second [ after first [ → complete to [[|]]
      if (text === "[" && charBefore === "[") {
        const tr = state.tr.insertText("[]]", from, to);
        tr.setSelection(TextSelection.create(tr.doc, from + 1));
        view.dispatch(tr);
        return true;
      }

      // Auto-close ( and {
      if (text === "(") {
        const tr = state.tr.insertText("()", from, to);
        tr.setSelection(TextSelection.create(tr.doc, from + 1));
        view.dispatch(tr);
        return true;
      }
      if (text === "{") {
        const tr = state.tr.insertText("{}", from, to);
        tr.setSelection(TextSelection.create(tr.doc, from + 1));
        view.dispatch(tr);
        return true;
      }

      return false;
    },

    handleKeyDown(view: EditorView, event: KeyboardEvent) {
      // Let autocomplete plugin handle keys first
      const acState = autocompletePluginKey.getState(
        view.state
      ) as AutocompletePluginState | undefined;
      if (acState?.active) {
        // Don't interfere with autocomplete keyboard handling
        if (
          ["ArrowDown", "ArrowUp", "Enter", "Tab", "Escape"].includes(
            event.key
          )
        ) {
          return false; // Let autocomplete plugin handle it
        }
      }

      // Skip over closing brackets if already present
      const closers = ["]", ")", "}"];
      if (closers.includes(event.key)) {
        const { state } = view;
        const pos = state.selection.from;
        if (pos < state.doc.content.size) {
          const charAfter = state.doc.textBetween(pos, pos + 1, "");
          if (charAfter === event.key) {
            const tr = state.tr.setSelection(
              TextSelection.create(state.doc, pos + 1)
            );
            view.dispatch(tr);
            event.preventDefault();
            return true;
          }
        }
      }

      // Backspace: delete matching bracket pair
      if (event.key === "Backspace") {
        const { state } = view;
        const pos = state.selection.from;
        if (pos > 0 && pos < state.doc.content.size) {
          const charBefore = state.doc.textBetween(pos - 1, pos, "");
          const charAfter = state.doc.textBetween(pos, pos + 1, "");
          const pairs: Record<string, string> = {
            "[": "]",
            "(": ")",
            "{": "}",
          };
          if (pairs[charBefore] === charAfter) {
            const tr = state.tr.delete(pos - 1, pos + 1);
            view.dispatch(tr);
            event.preventDefault();
            return true;
          }
        }
      }

      return false;
    },
  },
});

// ─── Combined Extension ──────────────────────────────────────────

export const GardenExtensions = Extension.create<GardenExtensionOptions>({
  name: "gardenExtensions",

  addOptions() {
    return {
      onPillClick: undefined,
      noteExists: undefined,
      onAutocompleteStateChange: undefined,
      getMatches: undefined,
      currentGarden: undefined,
    };
  },

  addProseMirrorPlugins() {
    return [
      createWikilinkDecorationPlugin(this.options),
      createAutocompletePluginPatched(this.options),
      autoBracketPlugin,
    ];
  },
});
