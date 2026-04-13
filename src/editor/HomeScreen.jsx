import { useEffect, useState } from 'react'

const RECENT_KEY = 'vcp_recent_files'
const MAX_RECENT = 12

export function readRecent() {
  try { return JSON.parse(localStorage.getItem(RECENT_KEY)) || [] }
  catch { return [] }
}

export function pushRecent(file) {
  if (!file?.id) return
  const list = readRecent().filter(f => f.id !== file.id)
  list.unshift({ id: file.id, name: file.name, time: Date.now() })
  if (list.length > MAX_RECENT) list.length = MAX_RECENT
  localStorage.setItem(RECENT_KEY, JSON.stringify(list))
}

function formatRelative(ts) {
  const diff = Date.now() - ts
  const mins = Math.floor(diff / 60000)
  if (mins < 1) return 'just now'
  if (mins < 60) return `${mins}m ago`
  const hrs = Math.floor(mins / 60)
  if (hrs < 24) return `${hrs}h ago`
  const days = Math.floor(hrs / 24)
  if (days < 7) return `${days}d ago`
  return new Date(ts).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
}

export default function HomeScreen({ onFilePicked, onToggleSidebar }) {
  const [recent, setRecent] = useState(readRecent)

  // Re-read when the component mounts (in case another tab updated)
  useEffect(() => { setRecent(readRecent()) }, [])

  return (
    <div className="home-screen">
      <div className="home-content">
        <h1 className="home-title">VCP Markdown</h1>
        <p className="home-subtitle">Collaborative review editor backed by Google Drive</p>

        {recent.length > 0 && (
          <div className="home-section">
            <h2 className="home-section-title">Recent files</h2>
            <div className="home-recent-list">
              {recent.map(f => (
                <button
                  key={f.id}
                  className="home-recent-item"
                  onClick={() => onFilePicked({ id: f.id, name: f.name })}
                >
                  <span className="home-recent-icon">&#x1F4C4;</span>
                  <span className="home-recent-name">{f.name?.replace(/\.md$/i, '')}</span>
                  <span className="home-recent-time">{formatRelative(f.time)}</span>
                </button>
              ))}
            </div>
          </div>
        )}

        <div className="home-section">
          <h2 className="home-section-title">Get started</h2>
          <div className="home-actions">
            <button className="home-action" onClick={onToggleSidebar}>
              <span className="home-action-icon">&#x1F4C1;</span>
              <span>Browse files</span>
            </button>
          </div>
        </div>

        <div className="home-hints">
          <p>Open a <code>.md</code> file from the sidebar to start editing.</p>
          <p>Edits auto-save after 2 seconds. Use track changes and comments for collaborative review.</p>
        </div>
      </div>
    </div>
  )
}
