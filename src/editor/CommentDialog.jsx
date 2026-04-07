import { useEffect, useRef, useState } from 'react'
import { useAuth } from '../auth/auth-context.jsx'
import { buildCommentInsertion } from '../criticmarkup/syntax.js'

export default function CommentDialog({ selectedText, onInsert, onClose }) {
  const { userInfo } = useAuth()
  const defaultHandle = userInfo?.name?.split(' ')[0]?.toLowerCase() || ''
  const [handle, setHandle] = useState(defaultHandle)
  const [text, setText] = useState('')
  const textRef = useRef(null)

  useEffect(() => {
    textRef.current?.focus()
  }, [])

  const handleSubmit = (e) => {
    e.preventDefault()
    if (!handle.trim() || !text.trim()) return
    const markup = buildCommentInsertion(handle.trim(), text.trim(), selectedText || '')
    onInsert(markup)
  }

  const handleKeyDown = (e) => {
    if (e.key === 'Escape') onClose()
    if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) handleSubmit(e)
  }

  return (
    <div className="dialog-overlay" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="dialog" onKeyDown={handleKeyDown}>
        <div className="dialog-header">
          <h2>Add Comment</h2>
          <button className="dialog-close" onClick={onClose} aria-label="Close">✕</button>
        </div>

        {selectedText && (
          <div className="dialog-selection-preview">
            <span className="label">Commenting on:</span>
            <blockquote>{selectedText.slice(0, 120)}{selectedText.length > 120 ? '…' : ''}</blockquote>
          </div>
        )}

        <form onSubmit={handleSubmit} className="dialog-form">
          <label>
            Your handle
            <input
              type="text"
              value={handle}
              onChange={(e) => setHandle(e.target.value)}
              placeholder="e.g. alice"
              required
            />
          </label>
          <label>
            Comment
            <textarea
              ref={textRef}
              value={text}
              onChange={(e) => setText(e.target.value)}
              placeholder="Write your comment…"
              rows={4}
              required
            />
          </label>
          <div className="dialog-preview-label">Will insert:</div>
          <code className="dialog-preview">
            {handle && text
              ? buildCommentInsertion(handle, text, selectedText || '')
              : '…'}
          </code>
          <div className="dialog-actions">
            <button type="button" className="btn-secondary" onClick={onClose}>Cancel</button>
            <button type="submit" className="btn-primary">Insert (Ctrl+Enter)</button>
          </div>
        </form>
      </div>
    </div>
  )
}
