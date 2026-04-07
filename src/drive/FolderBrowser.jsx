import { useCallback, useEffect, useState } from 'react'
import { useAuth } from '../auth/auth-context.jsx'
import { listFolderContents, listSharedDrives } from './drive-api.js'

const FOLDER_MIME = 'application/vnd.google-apps.folder'

function formatDate(iso) {
  if (!iso) return ''
  return new Date(iso).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
}

// Root view: shows "My Drive" entry + all Shared Drives
function RootView({ sharedDrives, loadingDrives, onEnter }) {
  return (
    <div className="fb-list">
      {/* My Drive */}
      <button
        className="fb-item fb-folder"
        onClick={() => onEnter({ id: 'root', name: 'My Drive' })}
      >
        <span className="fb-icon">🗂</span>
        <span className="fb-name">My Drive</span>
        <span className="fb-chevron">›</span>
      </button>

      {/* Shared Drives section */}
      {loadingDrives ? (
        <div className="fb-status">Loading shared drives…</div>
      ) : sharedDrives.length > 0 ? (
        <>
          <div className="fb-section-label">Shared Drives</div>
          {sharedDrives.map((drive) => (
            <button
              key={drive.id}
              className="fb-item fb-folder fb-shared-drive"
              onClick={() => onEnter({ id: drive.id, name: drive.name, isSharedDrive: true })}
            >
              <span className="fb-icon">🏢</span>
              <span className="fb-name">{drive.name}</span>
              <span className="fb-chevron">›</span>
            </button>
          ))}
        </>
      ) : null}
    </div>
  )
}

const PATH_STACK_KEY = 'vcp_path_stack'

function loadPathStack() {
  try { return JSON.parse(sessionStorage.getItem(PATH_STACK_KEY)) } catch { return null }
}

export default function FolderBrowser({ currentFileId, onFilePicked, onNewFileInFolder, onFolderChange }) {
  const { accessToken } = useAuth()

  // null = show root (My Drive + Shared Drives chooser)
  // array = path stack of { id, name } entries
  const [pathStack, setPathStack] = useState(() => loadPathStack())
  const [items, setItems] = useState([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const [sharedDrives, setSharedDrives] = useState([])
  const [loadingDrives, setLoadingDrives] = useState(true)

  // Load shared drives once on mount
  useEffect(() => {
    listSharedDrives(accessToken)
      .then(setSharedDrives)
      .catch(() => {}) // graceful — user may not have shared drives
      .finally(() => setLoadingDrives(false))
  }, [accessToken])

  const currentFolder = pathStack ? pathStack[pathStack.length - 1] : null

  // Notify parent whenever current folder changes
  useEffect(() => {
    onFolderChange?.(currentFolder)
  }, [currentFolder, onFolderChange])

  const loadFolder = useCallback(
    async (folderId) => {
      setLoading(true)
      setError(null)
      try {
        const files = await listFolderContents(accessToken, folderId)
        setItems(files)
      } catch (err) {
        setError(err.message)
      } finally {
        setLoading(false)
      }
    },
    [accessToken],
  )

  useEffect(() => {
    if (currentFolder) loadFolder(currentFolder.id)
  }, [currentFolder, loadFolder])

  const enterFolder = (entry) => {
    setPathStack((prev) => {
      const next = prev ? [...prev, entry] : [entry]
      sessionStorage.setItem(PATH_STACK_KEY, JSON.stringify(next))
      return next
    })
  }

  const navigateTo = (index) => {
    if (index < 0) {
      sessionStorage.removeItem(PATH_STACK_KEY)
      setPathStack(null)
    } else {
      setPathStack((prev) => {
        const next = prev.slice(0, index + 1)
        sessionStorage.setItem(PATH_STACK_KEY, JSON.stringify(next))
        return next
      })
    }
  }

  const refresh = () => {
    if (currentFolder) loadFolder(currentFolder.id)
    else {
      setLoadingDrives(true)
      listSharedDrives(accessToken)
        .then(setSharedDrives)
        .catch(() => {})
        .finally(() => setLoadingDrives(false))
    }
  }

  const folders = items.filter((f) => f.mimeType === FOLDER_MIME)
  const files = items.filter((f) => f.mimeType !== FOLDER_MIME)

  return (
    <aside className="folder-browser">
      {/* Breadcrumb */}
      <div className="fb-breadcrumb">
        {/* Home crumb — always shown */}
        <span className="fb-crumb-item">
          <button
            className={`fb-crumb-btn ${!pathStack ? 'active' : ''}`}
            onClick={() => navigateTo(-1)}
            title="Drive root"
          >
            ⌂
          </button>
        </span>

        {pathStack && pathStack.map((crumb, i) => (
          <span key={crumb.id} className="fb-crumb-item">
            <span className="fb-crumb-sep">›</span>
            <button
              className={`fb-crumb-btn ${i === pathStack.length - 1 ? 'active' : ''}`}
              onClick={() => navigateTo(i)}
              title={crumb.name}
            >
              {crumb.name}
            </button>
          </span>
        ))}
      </div>

      {/* Toolbar */}
      <div className="fb-toolbar">
        <button className="fb-action-btn" onClick={refresh} title="Refresh" disabled={loading || loadingDrives}>
          ↻
        </button>
        {currentFolder && (
          <button
            className="fb-action-btn"
            onClick={() => onNewFileInFolder(currentFolder.id)}
            title="New .md file in this folder"
          >
            + New
          </button>
        )}
      </div>

      {/* Root view or folder contents */}
      {!pathStack ? (
        <RootView
          sharedDrives={sharedDrives}
          loadingDrives={loadingDrives}
          onEnter={enterFolder}
        />
      ) : (
        <div className="fb-list">
          {loading && <div className="fb-status">Loading…</div>}
          {error && <div className="fb-status fb-error">{error}</div>}

          {!loading && !error && items.length === 0 && (
            <div className="fb-status fb-empty">Empty folder</div>
          )}

          {folders.map((folder) => (
            <button
              key={folder.id}
              className="fb-item fb-folder"
              onClick={() => enterFolder({ id: folder.id, name: folder.name })}
            >
              <span className="fb-icon">📁</span>
              <span className="fb-name">{folder.name}</span>
              <span className="fb-chevron">›</span>
            </button>
          ))}

          {files.map((file) => (
            <button
              key={file.id}
              className={`fb-item fb-file ${file.id === currentFileId ? 'active' : ''}`}
              onClick={() => onFilePicked({ id: file.id, name: file.name })}
              title={file.name}
            >
              <span className="fb-icon">📄</span>
              <span className="fb-name">{file.name}</span>
              <span className="fb-date">{formatDate(file.modifiedTime)}</span>
            </button>
          ))}
        </div>
      )}
    </aside>
  )
}
