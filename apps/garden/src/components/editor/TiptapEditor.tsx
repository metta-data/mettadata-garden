import { useState, useCallback, useRef } from "react";
import { useEditor, EditorContent } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import TaskList from "@tiptap/extension-task-list";
import TaskItem from "@tiptap/extension-task-item";
import Link from "@tiptap/extension-link";
import Placeholder from "@tiptap/extension-placeholder";
import { Markdown } from "tiptap-markdown";
import { TextSelection } from "@tiptap/pm/state";
import {
  GardenExtensions,
  type AutocompleteState,
} from "./WikilinkExtension";
import { useNoteList, type NoteMatch } from "./useNoteList";
import { WikilinkAutocomplete } from "./WikilinkAutocomplete";
import { CommandPalette } from "./CommandPalette";
import { TemplatePicker } from "./TemplatePicker";
import "./editor-styles.css";

interface TiptapEditorProps {
  content?: string;
  placeholder?: string;
  onChange?: (markdown: string) => void;
  editable?: boolean;
  /** Called before navigating away (e.g. clicking a wikilink). Should save current content. */
  onSaveBeforeNavigate?: () => Promise<void>;
  /** Current garden context for cross-garden wikilink insertion */
  currentGarden?: string;
}

export function TiptapEditor({
  content = "",
  placeholder = "Start writing...\n\nUse [[Note Title]] for wikilinks\n# for headings\n- [ ] for checkboxes",
  onChange,
  editable = true,
  onSaveBeforeNavigate,
  currentGarden,
}: TiptapEditorProps) {
  const [autocompleteState, setAutocompleteState] =
    useState<AutocompleteState | null>(null);
  const { notes, findMatches, noteExists, refresh } = useNoteList();
  const notesListRef = useRef<typeof notes>([]);
  notesListRef.current = notes;
  const matchesRef = useRef<NoteMatch[]>([]);
  const editorRef = useRef<any>(null);
  const autocompleteStateRef = useRef<AutocompleteState | null>(null);
  autocompleteStateRef.current = autocompleteState;

  // Compute matches whenever autocomplete state changes
  const currentMatches = autocompleteState?.active
    ? findMatches(autocompleteState.query)
    : [];
  matchesRef.current = currentMatches;

  const saveBeforeNavRef = useRef(onSaveBeforeNavigate);
  saveBeforeNavRef.current = onSaveBeforeNavigate;

  const handlePillClick = useCallback(
    async (target: string, alias?: string) => {
      // Save current content before navigating
      if (saveBeforeNavRef.current) {
        try {
          await saveBeforeNavRef.current();
        } catch {
          // Continue navigating even if save fails
        }
      }

      // Check if target includes a garden prefix (e.g. "spiritual/Stoicism")
      let lookupTarget = target;
      let targetGarden: string | undefined;
      const slashIdx = target.indexOf("/");
      if (slashIdx > 0) {
        targetGarden = target.slice(0, slashIdx);
        lookupTarget = target.slice(slashIdx + 1);
      }

      if (noteExists(lookupTarget)) {
        // Navigate to existing note — find slug from note list
        const matchingNote = notesListRef.current.find(
          (n) =>
            (n.title.toLowerCase() === lookupTarget.toLowerCase() ||
            n.aliases.some((a) => a.toLowerCase() === lookupTarget.toLowerCase())) &&
            (!targetGarden || n.garden === targetGarden)
        );
        if (matchingNote) {
          window.location.href = `/garden/${matchingNote.garden}/${matchingNote.slug}`;
        } else {
          // Fallback: find any matching note
          const anyMatch = notesListRef.current.find(
            (n) =>
              n.title.toLowerCase() === lookupTarget.toLowerCase() ||
              n.aliases.some((a) => a.toLowerCase() === lookupTarget.toLowerCase())
          );
          if (anyMatch) {
            window.location.href = `/garden/${anyMatch.garden}/${anyMatch.slug}`;
          }
        }
      } else {
        // Create new seed note in current garden or private
        const noteGarden = currentGarden || "private";
        try {
          const res = await fetch("/api/notes", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              title: lookupTarget,
              content: "",
              garden: noteGarden,
              tags: [],
              stage: "seed",
              description: "",
              publish: false,
              aliases: alias ? [alias] : [],
            }),
          });
          if (res.ok) {
            refresh();
            const data = await res.json();
            if (data.path) {
              window.location.href = data.path;
            }
          }
        } catch {
          console.error("Failed to create note");
        }
      }
    },
    [noteExists, refresh]
  );

  const handleAutocompleteSelect = useCallback(
    (match: NoteMatch) => {
      const ed = editorRef.current;
      if (!ed) return;

      const acState = autocompleteStateRef.current;
      if (!acState) return;

      const view = ed.view;
      const state = view.state;
      const cursorPos = state.selection.from;
      let replaceTo = cursorPos;

      // Check if ]] follows cursor (from auto-bracket)
      const textAfter =
        replaceTo + 2 <= state.doc.content.size
          ? state.doc.textBetween(replaceTo, replaceTo + 2, "")
          : "";
      if (textAfter === "]]") {
        replaceTo += 2;
      }

      // Build wikilink text — use garden prefix if different from current
      const needsGardenPrefix = currentGarden && match.garden !== currentGarden;
      const prefix = needsGardenPrefix ? `${match.garden}/` : "";

      const wikilinkText = match.matchedAlias
        ? `[[${prefix}${match.title}|${match.matchedAlias}]]`
        : `[[${prefix}${match.title}]]`;

      const tr = state.tr.insertText(wikilinkText, acState.from, replaceTo);
      tr.setSelection(
        TextSelection.create(tr.doc, acState.from + wikilinkText.length)
      );
      view.dispatch(tr);
      view.focus();
    },
    [currentGarden]
  );

  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        heading: { levels: [1, 2, 3, 4] },
      }),
      TaskList,
      TaskItem.configure({
        nested: true,
        HTMLAttributes: { class: "task-item" },
      }),
      Link.configure({
        openOnClick: false,
        HTMLAttributes: { class: "editor-link" },
      }),
      Placeholder.configure({ placeholder }),
      Markdown.configure({
        html: false,
        transformPastedText: true,
        transformCopiedText: true,
      }),
      GardenExtensions.configure({
        onPillClick: handlePillClick,
        noteExists,
        onAutocompleteStateChange: setAutocompleteState,
        getMatches: () => matchesRef.current,
        currentGarden,
      }),
    ],
    content,
    editable,
    editorProps: {
      attributes: {
        class: "tiptap-editor",
        spellcheck: "true",
      },
      // Handle typing "- [ ] " to create a task list
      handleTextInput(view, from, to, text) {
        if (text !== " ") return false;

        const { state } = view;
        const $from = state.doc.resolve(from);
        const lineStart = $from.start();
        const textBefore = state.doc.textBetween(lineStart, from, "");

        // Match "- [ ]" or "- [x]" at start of line in a paragraph
        if (textBefore === "- [ ]" || textBefore === "- [x]") {
          const checked = textBefore === "- [x]";

          // Delete the typed text and convert to task list
          const tr = state.tr.delete(lineStart, to);
          view.dispatch(tr);

          // Use the editor commands to create a task list
          const editorInstance = (view as any).__tiptapEditor;
          if (editorInstance) {
            editorInstance.chain().focus().toggleTaskList().run();
            if (checked) {
              editorInstance
                .chain()
                .focus()
                .updateAttributes("taskItem", { checked: true })
                .run();
            }
          }
          return true;
        }

        return false;
      },
    },
    onUpdate: ({ editor }) => {
      if (onChange) {
        let md = editor.storage.markdown.getMarkdown();
        // Unescape wikilink brackets that prosemirror-markdown escapes
        md = md.replace(/\\\[\\\[/g, "[[").replace(/\\\]\\\]/g, "]]");
        onChange(md);
      }
    },
  });

  // Store editor references
  if (editor?.view) {
    (editor.view as any).__tiptapEditor = editor;
    editorRef.current = editor;
  }

  // Template picker state
  const [templatePickerOpen, setTemplatePickerOpen] = useState(false);

  const handleApplyTemplate = useCallback(
    (_templateName: string, processedBody: string) => {
      setTemplatePickerOpen(false);
      if (!editor) return;
      // Insert the processed template body at cursor position
      editor.chain().focus().insertContent(processedBody).run();
    },
    [editor]
  );

  // Build commands for the command palette
  const commands = [
    {
      id: "apply-template",
      label: "Apply Template",
      icon: "📄",
      category: "Templates",
      action: () => setTemplatePickerOpen(true),
    },
    {
      id: "insert-wikilink",
      label: "Insert Wikilink",
      icon: "🔗",
      category: "Insert",
      action: () => editor?.chain().focus().insertContent("[[").run(),
    },
    {
      id: "insert-heading-1",
      label: "Heading 1",
      icon: "H1",
      category: "Format",
      action: () => editor?.chain().focus().toggleHeading({ level: 1 }).run(),
    },
    {
      id: "insert-heading-2",
      label: "Heading 2",
      icon: "H2",
      category: "Format",
      action: () => editor?.chain().focus().toggleHeading({ level: 2 }).run(),
    },
    {
      id: "insert-heading-3",
      label: "Heading 3",
      icon: "H3",
      category: "Format",
      action: () => editor?.chain().focus().toggleHeading({ level: 3 }).run(),
    },
    {
      id: "toggle-bold",
      label: "Bold",
      icon: "B",
      category: "Format",
      action: () => editor?.chain().focus().toggleBold().run(),
    },
    {
      id: "toggle-italic",
      label: "Italic",
      icon: "I",
      category: "Format",
      action: () => editor?.chain().focus().toggleItalic().run(),
    },
    {
      id: "toggle-bullet-list",
      label: "Bullet List",
      icon: "•",
      category: "Insert",
      action: () => editor?.chain().focus().toggleBulletList().run(),
    },
    {
      id: "toggle-task-list",
      label: "Task List",
      icon: "☑",
      category: "Insert",
      action: () => editor?.chain().focus().toggleTaskList().run(),
    },
    {
      id: "toggle-blockquote",
      label: "Blockquote",
      icon: ">",
      category: "Insert",
      action: () => editor?.chain().focus().toggleBlockquote().run(),
    },
    {
      id: "toggle-code-block",
      label: "Code Block",
      icon: "</>",
      category: "Insert",
      action: () => editor?.chain().focus().toggleCodeBlock().run(),
    },
    {
      id: "insert-hr",
      label: "Horizontal Rule",
      icon: "—",
      category: "Insert",
      action: () => editor?.chain().focus().setHorizontalRule().run(),
    },
    {
      id: "insert-date",
      label: "Insert Today's Date",
      icon: "📅",
      category: "Insert",
      action: () => editor?.chain().focus().insertContent(new Date().toISOString().split("T")[0]).run(),
    },
  ];

  if (!editor) return null;

  return (
    <div className="tiptap-wrapper">
      {editable && <EditorToolbar editor={editor} />}
      <EditorContent editor={editor} />
      {autocompleteState?.active && currentMatches.length > 0 && (
        <WikilinkAutocomplete
          items={currentMatches}
          selectedIndex={autocompleteState.selectedIndex}
          coords={autocompleteState.coords}
          onSelect={handleAutocompleteSelect}
        />
      )}
      {editable && <CommandPalette commands={commands} />}
      {templatePickerOpen && currentGarden && (
        <TemplatePicker
          garden={currentGarden}
          onSelect={handleApplyTemplate}
          onClose={() => setTemplatePickerOpen(false)}
        />
      )}
    </div>
  );
}

function EditorToolbar({ editor }: { editor: any }) {
  const btn = (active: boolean) =>
    `rounded px-2 py-1 text-xs transition-colors ${
      active
        ? "bg-[var(--color-accent)] text-white"
        : "text-[var(--color-text-muted)] hover:bg-[var(--color-surface-hover)]"
    }`;

  return (
    <div className="flex flex-wrap items-center gap-0.5 border-b border-[var(--color-border)] bg-[var(--color-bg-secondary)] px-2 py-1">
      <button
        onClick={() =>
          editor.chain().focus().toggleHeading({ level: 1 }).run()
        }
        className={btn(editor.isActive("heading", { level: 1 }))}
        title="Heading 1"
      >
        H1
      </button>
      <button
        onClick={() =>
          editor.chain().focus().toggleHeading({ level: 2 }).run()
        }
        className={btn(editor.isActive("heading", { level: 2 }))}
        title="Heading 2"
      >
        H2
      </button>
      <button
        onClick={() =>
          editor.chain().focus().toggleHeading({ level: 3 }).run()
        }
        className={btn(editor.isActive("heading", { level: 3 }))}
        title="Heading 3"
      >
        H3
      </button>

      <span className="mx-1 text-[var(--color-border)]">|</span>

      <button
        onClick={() => editor.chain().focus().toggleBold().run()}
        className={btn(editor.isActive("bold"))}
        title="Bold (Cmd+B)"
      >
        <strong>B</strong>
      </button>
      <button
        onClick={() => editor.chain().focus().toggleItalic().run()}
        className={btn(editor.isActive("italic"))}
        title="Italic (Cmd+I)"
      >
        <em>I</em>
      </button>
      <button
        onClick={() => editor.chain().focus().toggleCode().run()}
        className={btn(editor.isActive("code"))}
        title="Inline code"
      >
        {"</>"}
      </button>

      <span className="mx-1 text-[var(--color-border)]">|</span>

      <button
        onClick={() => editor.chain().focus().toggleBulletList().run()}
        className={btn(editor.isActive("bulletList"))}
        title="Bullet list"
      >
        &#8226; List
      </button>
      <button
        onClick={() => editor.chain().focus().toggleOrderedList().run()}
        className={btn(editor.isActive("orderedList"))}
        title="Numbered list"
      >
        1. List
      </button>
      <button
        onClick={() => editor.chain().focus().toggleTaskList().run()}
        className={btn(editor.isActive("taskList"))}
        title="Checkbox list"
      >
        &#9745; Tasks
      </button>

      <span className="mx-1 text-[var(--color-border)]">|</span>

      <button
        onClick={() => editor.chain().focus().toggleBlockquote().run()}
        className={btn(editor.isActive("blockquote"))}
        title="Blockquote"
      >
        &#8220; Quote
      </button>
      <button
        onClick={() => editor.chain().focus().toggleCodeBlock().run()}
        className={btn(editor.isActive("codeBlock"))}
        title="Code block"
      >
        Code Block
      </button>
      <button
        onClick={() => editor.chain().focus().setHorizontalRule().run()}
        className={btn(false)}
        title="Horizontal rule"
      >
        &#8212;
      </button>

      <span className="mx-1 text-[var(--color-border)]">|</span>

      <button
        onClick={() => {
          const sel = editor.state.selection;
          const text =
            editor.state.doc.textBetween(sel.from, sel.to) || "";
          if (text) {
            editor.chain().focus().insertContent(`[[${text}]]`).run();
          } else {
            // Insert [[ with cursor between, ]] will auto-close
            editor.chain().focus().insertContent("[[").run();
          }
        }}
        className={btn(false)}
        title="Insert wikilink"
      >
        [[&thinsp;]]
      </button>
    </div>
  );
}
