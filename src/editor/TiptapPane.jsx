import {
  useEffect,
  useImperativeHandle,
  useRef,
  forwardRef,
  useCallback,
  useMemo,
} from "react";
import { useEditor, EditorContent } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Table from "@tiptap/extension-table";
import TableRow from "@tiptap/extension-table-row";
import TableHeader from "@tiptap/extension-table-header";
import TableCell from "@tiptap/extension-table-cell";
import { marked } from "marked";
import { criticMarkupPlugin } from "../criticmarkup/marked-plugin.js";
import {
  CriticInsertion,
  CriticDeletion,
  CriticHighlight,
  CriticSubstitution,
  CriticComment,
} from "../criticmarkup/tiptap-extensions.js";
import { serializeToMarkdown } from "./tiptap-serializer.js";
import { TrackChanges } from "../criticmarkup/track-changes-extension.js";

marked.use(criticMarkupPlugin());

// ── Frontmatter handling ──────────────────────────────────────────────────────
const FRONTMATTER_RE = /^---\r?\n([\s\S]*?)\r?\n---(?:\r?\n|$)/;

/** Extract YAML frontmatter → { body, frontmatter: [{key,value}] | null } */
function extractFrontmatter(md) {
  const m = md.match(FRONTMATTER_RE);
  if (!m) return { body: md, frontmatter: null };
  const fields = [];
  const lines = m[1].split("\n");
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    // Skip indented continuation lines (handled below with their parent)
    if (/^\s/.test(line) && fields.length) continue;
    const colon = line.indexOf(":");
    if (colon <= 0) continue;
    const key = line.slice(0, colon).trim();
    let val = line.slice(colon + 1).trim();
    // Strip surrounding quotes
    if (
      (val.startsWith('"') && val.endsWith('"')) ||
      (val.startsWith("'") && val.endsWith("'"))
    ) {
      val = val.slice(1, -1);
    }
    // Collect indented continuation lines (nested YAML values)
    if (!val) {
      const nested = [];
      while (i + 1 < lines.length && /^\s/.test(lines[i + 1])) {
        i++;
        nested.push(lines[i].trim());
      }
      val = nested.join(", ");
    }
    fields.push({ key, value: val });
  }
  const body = md.slice(m[0].length);
  return { body, frontmatter: fields.length ? fields : null };
}

// Convert markdown → HTML for Tiptap input (frontmatter stripped, rendered separately)
function markdownToHtml(md) {
  try {
    const { body } = extractFrontmatter(md);
    return marked.parse(body);
  } catch {
    return `<p>${md}</p>`;
  }
}

/** Return the raw frontmatter block (including delimiters + trailing newline) or '' */
function extractRawFrontmatter(md) {
  const m = md.match(FRONTMATTER_RE);
  return m ? m[0] : "";
}

const CRITIC_MARK_EXTENSIONS = [
  CriticInsertion,
  CriticDeletion,
  CriticHighlight,
  CriticSubstitution,
  CriticComment,
];

// ── Component ─────────────────────────────────────────────────────────────────

const TiptapPane = forwardRef(function TiptapPane(
  { content, onChange, tracking = false, author = "" },
  ref,
) {
  const lastMd = useRef(content);
  // Store raw frontmatter block so we can prepend it back on serialization
  const frontmatterRef = useRef(extractRawFrontmatter(content));
  // Extract frontmatter fields for rendering as a React component
  const frontmatterFields = useMemo(
    () => extractFrontmatter(content).frontmatter,
    [content],
  );

  const editor = useEditor({
    extensions: [
      StarterKit,
      Table.configure({ resizable: false }),
      TableRow,
      TableHeader,
      TableCell,
      ...CRITIC_MARK_EXTENSIONS,
      TrackChanges.configure({ tracking, author }),
    ],
    content: markdownToHtml(content),
    editable: !!onChange,
    onUpdate({ editor }) {
      const bodyMd = serializeToMarkdown(editor.getJSON());
      const md = frontmatterRef.current
        ? frontmatterRef.current + bodyMd
        : bodyMd;
      lastMd.current = md;
      onChange?.(md);
    },
  });

  // Set editor content without triggering track-changes (file loads, external syncs)
  const setContentSafe = useCallback(
    (md) => {
      if (!editor) return;
      frontmatterRef.current = extractRawFrontmatter(md);
      const ext = editor.extensionManager.extensions.find(
        (e) => e.name === "trackChanges",
      );
      const prev = ext?.options.tracking;
      if (ext) ext.options.tracking = false;
      editor.commands.setContent(markdownToHtml(md), false);
      if (ext) ext.options.tracking = prev;
    },
    [editor],
  );

  // Sync external content changes (e.g. file open, CodeMirror edits in split)
  useEffect(() => {
    if (!editor || editor.isFocused) return;
    if (content === lastMd.current) return;
    lastMd.current = content;
    setContentSafe(content);
  }, [content, editor, setContentSafe]);

  // Update editable when onChange presence changes
  useEffect(() => {
    editor?.setEditable(!!onChange, false);
  }, [editor, onChange]);

  // Keep TrackChanges extension options in sync with props
  useEffect(() => {
    if (!editor) return;
    const ext = editor.extensionManager.extensions.find(
      (e) => e.name === "trackChanges",
    );
    if (ext) {
      ext.options.tracking = tracking;
      ext.options.author = author;
    }
  }, [editor, tracking, author]);


  // Expose methods to Editor parent via ref
  useImperativeHandle(
    ref,
    () => ({
      // Force content update regardless of focus state (used by accept/reject all)
      forceContent: (md) => {
        if (!editor) return;
        lastMd.current = md;
        setContentSafe(md);
      },
      // Insert CriticMarkup comment (called after dialog submit)
      insertComment: ({ author, date, text, selectedText }) => {
        if (!editor) return;
        const h = author.startsWith("@") ? author : `@${author}`;
        // If selected text exists, apply highlight mark first
        if (selectedText) {
          const { from, to } = editor.state.selection;
          if (from !== to) {
            editor
              .chain()
              .focus()
              .setMark("criticHighlight")
              .insertContentAt(to, {
                type: "criticComment",
                attrs: { author: h, date, text },
              })
              .run();
            return;
          }
        }
        editor
          .chain()
          .focus()
          .insertContent({
            type: "criticComment",
            attrs: { author: h, date, text },
          })
          .run();
      },
      // Get selected text
      getSelection: () => {
        if (!editor) return "";
        const { from, to } = editor.state.selection;
        return editor.state.doc.textBetween(from, to, " ");
      },
    }),
    [editor],
  );

  return (
    <div className={`tiptap-wrap${tracking ? "" : " no-track"}`}>
      <div className="tiptap-content">
        {frontmatterFields && (
          <div className="frontmatter-table">
            <table>
              <tbody>
                {frontmatterFields.map(({ key, value }, i) => (
                  <tr key={i}>
                    <td className="fm-key">{key}</td>
                    <td className="fm-val">
                      {value || <span className="fm-empty">—</span>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        <EditorContent editor={editor} />
      </div>

    </div>
  );
});

export default TiptapPane;
