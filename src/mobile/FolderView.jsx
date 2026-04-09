import { useCallback, useEffect, useState } from 'react'
import { useAuth } from '../auth/auth-context.jsx'
import { listFolderContents, listSharedDrives, trashFile } from '../drive/drive-api.js'

const FOLDER_MIME = 'application/vnd.google-apps.folder'

const EXTERNAL_TYPES = {
  'application/pdf':                           { badge: 'PDF',   url: id => `https://drive.google.com/file/d/${id}/view` },
  'application/vnd.google-apps.document':      { badge: 'DOC',   url: id => `https://docs.google.com/document/d/${id}/edit` },
  'application/vnd.google-apps.spreadsheet':   { badge: 'SHEET', url: id => `https://docs.google.com/spreadsheets/d/${id}/edit` },
  'application/vnd.google-apps.presentation':  { badge: 'SLIDE', url: id => `https://docs.google.com/presentation/d/${id}/edit` },
}

function formatDate(iso) {
  if (!iso) return ''
  return new Date(iso).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
}

export default function FolderView({ folder, title, onBack, onFolderPush, onFilePick, onNewFile }) {
  const { accessToken } = useAuth()
  const [items, setItems] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [confirmId, setConfirmId] = useState(null)   // id of file pending delete confirm
  const [deleting, setDeleting] = useState(null)     // id currently being deleted

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    setItems(null)
    setConfirmId(null)
    try {
      let result
      if (!folder) {
        const drives = await listSharedDrives(accessToken)
        result = [
          { id: 'root', name: 'My Drive', isFolder: true },
          ...drives.map(d => ({ id: d.id, name: d.name, isFolder: true })),
        ]
      } else {
        const contents = await listFolderContents(accessToken, folder.id)
        result = contents.map(item => ({
          id: item.id,
          name: item.name,
          mimeType: item.mimeType,
          isFolder: item.mimeType === FOLDER_MIME,
          external: EXTERNAL_TYPES[item.mimeType] ?? null,
          modifiedTime: item.modifiedTime,
        }))
      }
      setItems(result)
    } catch (e) {
      setError(e.message)
    } finally {
      setLoading(false)
    }
  }, [folder?.id, accessToken]) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => { load() }, [load])

  async function handleDelete(e, id) {
    e.stopPropagation()
    if (confirmId !== id) {
      setConfirmId(id)
      return
    }
    // Second tap — confirmed
    setConfirmId(null)
    setDeleting(id)
    try {
      await trashFile(accessToken, id)
      setItems(prev => prev.filter(i => i.id !== id))
    } catch (err) {
      setError(`Delete failed: ${err.message}`)
    } finally {
      setDeleting(null)
    }
  }

  function cancelConfirm(e) {
    e.stopPropagation()
    setConfirmId(null)
  }

  const folders = items?.filter(i => i.isFolder) ?? []
  const files   = items?.filter(i => !i.isFolder) ?? []

  return (
    <div className="folder-view">
      <header className="fv-header">
        {onBack
          ? <button className="fv-back" onClick={onBack}>←</button>
          : <span className="fv-back-placeholder" />
        }
        <span className="fv-title">{title || 'Files'}</span>
        <button className="fv-new-btn" onClick={onNewFile} title="New file here">+</button>
      </header>

      <div className="fv-list">
        {loading && <div className="fv-status">Loading…</div>}
        {error && (
          <div className="fv-status fv-error">
            {error}
            <button className="fv-retry" onClick={load}>Retry</button>
          </div>
        )}

        {folders.map(item => (
          <button
            key={item.id}
            className="fv-row fv-folder"
            onClick={() => onFolderPush({ id: item.id, name: item.name })}
          >
            <span className="fv-row-name">{item.name}</span>
            <span className="fv-chevron">›</span>
          </button>
        ))}

        {files.map(item => {
          const isConfirming = confirmId === item.id
          const isDeleting   = deleting === item.id

          if (item.external) {
            return (
              <a
                key={item.id}
                className="fv-row fv-file fv-file-external"
                href={item.external.url(item.id)}
                target="_blank"
                rel="noreferrer"
              >
                <span className="fv-row-name">{item.name.replace(/\.\w+$/i, '')}</span>
                <span className="fv-badge">{item.external.badge}</span>
              </a>
            )
          }

          return (
            <div key={item.id} className={`fv-row fv-file fv-file-row${isConfirming ? ' fv-confirming' : ''}`}>
              <button
                className="fv-file-main"
                onClick={() => !isConfirming && onFilePick({ id: item.id, name: item.name })}
                disabled={isDeleting}
              >
                <span className="fv-row-name">{item.name.replace(/\.md$/i, '')}</span>
                <span className="fv-date">{formatDate(item.modifiedTime)}</span>
              </button>

              {isConfirming ? (
                <span className="fv-delete-confirm">
                  <button className="fv-delete-yes" onClick={e => handleDelete(e, item.id)}>
                    Trash
                  </button>
                  <button className="fv-delete-cancel" onClick={cancelConfirm}>
                    ✕
                  </button>
                </span>
              ) : (
                <button
                  className="fv-delete-btn"
                  onClick={e => handleDelete(e, item.id)}
                  disabled={isDeleting}
                  title="Move to trash"
                  aria-label="Delete file"
                >
                  {isDeleting ? '…' : '🗑'}
                </button>
              )}
            </div>
          )
        })}

        {!loading && !error && folders.length === 0 && files.length === 0 && (
          <div className="fv-status">Empty</div>
        )}
      </div>
    </div>
  )
}
