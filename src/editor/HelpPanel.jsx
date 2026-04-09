import { useEffect, useRef } from 'react'
import { marked } from 'marked'

const HELP_MD = `
# VCP Markdown Editor — Help

---

## Capture / Dump screen

The **Capture** screen is the quick-entry point for capturing thoughts, voice dictation, or pasted content on the fly.

Tap **Capture** in the Editor header to get there. Tap **Editor** in the Capture header to go back.

### How to capture
1. Tap the text area and **dictate** (use your phone's mic), **paste** from clipboard, or type freely
2. Tap **✨ Process with Gemini** to clean up the text (see below)
3. Choose a **context** and **type**, then tap **Save to Inbox**
4. The note lands in \`/VCP/inbox/\` on the shared drive, ready for processing

### Context
Engagements are loaded automatically from your Drive. Static contexts: **Ops**, **Brain**, **Other**.

### Type
- **Note** — a plain knowledge note
- **Also a task** — adds a one-line task title that downstream tools can pick up

---

## Gemini AI processing

After entering raw text, tap **✨ Process with Gemini** to:

- **Clean up** grammar, punctuation, and filler words from voice dictation
- **Detect language** automatically (German or English) and keep content in that language
- **Format** the content as clean Markdown with a title heading
- **Suggest context** — which engagement or area the note belongs to
- **Suggest type** — note vs. content+task
- **Extract task title** if the content implies a clear action item

Gemini uses your existing Google login — no separate API key needed.

---

## File browser (Editor)

- Tap **☰** to open/close the sidebar
- Tap **▸** next to a folder to expand it (lazy-loaded)
- Tap any **.md** file to open it
- Shared drives appear at the root alongside My Drive
- Tap **New** in the header to create a new file in the current folder

Non-markdown files are shown with a type badge and open in a new tab:

| Badge | Type | Opens in |
|-------|------|----------|
| PDF | PDF file | Google Drive viewer |
| DOC | Google Doc | Google Docs |
| SHEET | Google Sheet | Google Sheets |
| SLIDE | Google Slides | Google Slides |

---

## Views (Editor)

| Button | Mode | Description |
|--------|------|-------------|
| Split | Side-by-side | Raw source left, rendered preview right |
| Editor | Source only | Full CodeMirror editor |
| Review | Preview only | **Main editing surface** — rich text, inline markup |

On mobile the app always starts in Review mode. Use the tab bar to switch.

---

## Editing in Review mode

Tap anywhere in the preview to place your cursor and start typing.
Select text to open the **bubble menu** with formatting and review actions.

| Button | Action |
|--------|--------|
| 💬 | Add a comment anchored to the selection |
| H | Highlight selection |
| + | Mark selection as an insertion |
| − | Mark selection as a deletion |
| B | Bold |
| I | Italic |

---

## Track changes

Toggle **Track** in the toolbar (desktop) or the Track tab (mobile).

While active, every edit is automatically wrapped in CriticMarkup on blur:

| Edit type | Markup |
|-----------|--------|
| New text | \`{++ inserted text ++}\` |
| Removed text | \`{-- deleted text --}\` |
| Replaced text | \`{~~ old ~> new ~~}\` |

Each tracked session is attributed: \`{>> @mh (date): edit <<}\`

---

## Comments

1. Select text in the preview, then tap 💬 in the bubble menu
2. Or tap 💬 in the header / mobile tab bar
3. Enter your handle and comment text — stored as \`{>> @handle (date): text <<}\`
4. Tap an existing 💬 badge to read the comment

---

## CriticMarkup reference

\`\`\`
{++ inserted text ++}
{-- deleted text --}
{== highlighted text ==}
{~~ old text ~> new text ~~}
{>> @handle (2026-04-07): comment <<}
\`\`\`

---

## Saving

- **Auto-save**: 2 s after you stop typing (requires an open file)
- **Manual**: tap **Save** in the header, or **Cmd/Ctrl + S**

---

## Keyboard shortcuts

| Shortcut | Action |
|----------|--------|
| Cmd/Ctrl + S | Save |
| Cmd/Ctrl + B | Bold |
| Cmd/Ctrl + I | Italic |
`

export default function HelpPanel({ onClose }) {
  const ref = useRef(null)

  // Close on Escape
  useEffect(() => {
    const handler = (e) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [onClose])

  // Trap focus inside panel
  useEffect(() => { ref.current?.focus() }, [])

  return (
    <div className="help-overlay" onClick={onClose} aria-modal="true" role="dialog">
      <div
        className="help-panel"
        onClick={e => e.stopPropagation()}
        ref={ref}
        tabIndex={-1}
      >
        <div className="help-header">
          <span className="help-title">Help</span>
          <button className="help-close" onClick={onClose} aria-label="Close help">✕</button>
        </div>
        <div
          className="help-body preview-content"
          dangerouslySetInnerHTML={{ __html: marked.parse(HELP_MD) }}
        />
      </div>
    </div>
  )
}
