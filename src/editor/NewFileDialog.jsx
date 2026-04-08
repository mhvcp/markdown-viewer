import { useCallback, useState } from 'react'
import { useAuth } from '../auth/auth-context.jsx'
import { createFile } from '../drive/drive-api.js'

export default function NewFileDialog({ currentFolder, onCreated, onClose }) {
  const { accessToken } = useAuth()
  const [name, setName]     = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError]   = useState('')

  const handleCreate = useCallback(async () => {
    if (!name.trim()) return
    const filename = name.trim().endsWith('.md') ? name.trim() : name.trim() + '.md'
    setSaving(true)
    setError('')
    try {
      const file = await createFile(accessToken, filename, '', currentFolder?.id || null)
      onCreated({ id: file.id, name: file.name })
      onClose()
    } catch (err) {
      setError(err.message)
      setSaving(false)
    }
  }, [accessToken, name, currentFolder, onCreated, onClose])

  return (
    <div className="dialog-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="dialog nfd-dialog">
        <div className="dialog-header">
          <h2>New file</h2>
          <button className="dialog-close" onClick={onClose} aria-label="Close">✕</button>
        </div>

        <div className="nfd-mode">
          <div className="nfd-location">
            <span className="nfd-location-label">Location</span>
            <span className="nfd-location-path">
              {currentFolder ? currentFolder.name : 'My Drive (root)'}
            </span>
          </div>

          <label className="nfd-label">
            File name
            <input
              className="nfd-input"
              type="text"
              value={name}
              onChange={e => setName(e.target.value)}
              placeholder="my-notes.md"
              autoFocus
              onKeyDown={e => {
                if (e.key === 'Enter') handleCreate()
                if (e.key === 'Escape') onClose()
              }}
            />
          </label>

          {error && <p className="nfd-status error">{error}</p>}

          <div className="nfd-dedicated-actions">
            <button className="btn-secondary" onClick={onClose}>Cancel</button>
            <button
              className="btn-primary"
              onClick={handleCreate}
              disabled={saving || !name.trim()}
            >
              {saving ? 'Creating…' : 'Create'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
