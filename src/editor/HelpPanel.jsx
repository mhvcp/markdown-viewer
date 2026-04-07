import { useEffect, useRef } from 'react'
import { marked } from 'marked'

const HELP_MD = `
# VCP Markdown Editor — Help

## File browser
- Tap **☰** to open/close the sidebar
- Tap **▸** next to a folder to expand it (lazy-loaded)
- Tap any **.md** file to open it
- Shared drives appear at the root alongside My Drive
- Tap **New** in the header to create a new file in the current folder

---

## Views
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

### Bubble menu actions
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

While active, every edit you finish is automatically wrapped in CriticMarkup:

| Edit type | Markup |
|-----------|--------|
| New text | \`{++ inserted text ++}\` |
| Removed text | \`{-- deleted text --}\` |
| Replaced text | \`{~~ old ~> new ~~}\` |

Each tracked session is attributed with a comment showing your handle and date.

---

## Comments
1. Select text in the preview, then tap 💬 in the bubble menu
2. Or tap the 💬 button in the header / mobile tab bar
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
- **Auto-save**: 2 seconds after you stop typing (requires an open file)
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
