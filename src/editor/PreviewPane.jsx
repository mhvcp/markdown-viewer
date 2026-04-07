import { useEffect, useRef } from 'react'
import { marked } from 'marked'
import TurndownService from 'turndown'
import { criticMarkupPlugin } from '../criticmarkup/marked-plugin.js'

marked.use(criticMarkupPlugin())

// Turndown: convert HTML back to markdown, preserving CriticMarkup spans
const td = new TurndownService({ headingStyle: 'atx', bulletListMarker: '-', codeBlockStyle: 'fenced' })

// Restore CriticMarkup elements to their original syntax from the data-critic attribute
td.addRule('criticmarkup', {
  filter: node => node.dataset?.critic,
  replacement: (content, node) => decodeURIComponent(node.dataset.critic),
})

export default function PreviewPane({ content, onChange }) {
  const ref = useRef(null)
  const isFocused = useRef(false)

  // Update innerHTML only when content changes from outside (not while user is editing)
  useEffect(() => {
    if (!ref.current || isFocused.current) return
    try {
      ref.current.innerHTML = marked.parse(content)
    } catch (e) {
      ref.current.innerHTML = `<pre class="parse-error">${e.message}</pre>`
    }
  }, [content])

  const handleBlur = () => {
    isFocused.current = false
    if (!onChange || !ref.current) return
    const markdown = td.turndown(ref.current.innerHTML)
    onChange(markdown)
  }

  return (
    <div
      ref={ref}
      className="preview-content"
      contentEditable={!!onChange}
      suppressContentEditableWarning
      onFocus={() => { isFocused.current = true }}
      onBlur={handleBlur}
    />
  )
}
