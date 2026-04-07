import { useState } from 'react'
import { useAuth } from '../auth/auth-context.jsx'

async function apiGet(token, url) {
  const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` } })
  const text = await res.text()
  let json
  try { json = JSON.parse(text) } catch { json = text }
  return { status: res.status, ok: res.ok, body: json }
}

const CHECKS = [
  {
    label: '1. Token info (scopes granted)',
    run: async (token) => apiGet(token,
      `https://www.googleapis.com/oauth2/v3/tokeninfo?access_token=${token}`
    ),
  },
  {
    label: '2. Drive about (basic token test)',
    run: (token) => apiGet(token,
      'https://www.googleapis.com/drive/v3/about?fields=user,kind'
    ),
  },
  {
    label: '3. List Shared Drives',
    run: (token) => apiGet(token,
      'https://www.googleapis.com/drive/v3/drives?fields=drives(id,name)&pageSize=20'
    ),
  },
  {
    label: '4. Global search for VCP folder (corpora=allDrives)',
    run: (token) => apiGet(token,
      "https://www.googleapis.com/drive/v3/files?corpora=allDrives&supportsAllDrives=true&includeItemsFromAllDrives=true&q=name%3D'VCP'%20and%20mimeType%3D'application%2Fvnd.google-apps.folder'%20and%20trashed%3Dfalse&fields=files(id,name,parents)&pageSize=10"
    ),
  },
  {
    label: "5. Global search lowercase 'vcp'",
    run: (token) => apiGet(token,
      "https://www.googleapis.com/drive/v3/files?corpora=allDrives&supportsAllDrives=true&includeItemsFromAllDrives=true&q=name%3D'vcp'%20and%20mimeType%3D'application%2Fvnd.google-apps.folder'%20and%20trashed%3Dfalse&fields=files(id,name,parents)&pageSize=10"
    ),
  },
  {
    label: '6. List ALL folders in My Drive root',
    run: (token) => apiGet(token,
      "https://www.googleapis.com/drive/v3/files?q='root'%20in%20parents%20and%20mimeType%3D'application%2Fvnd.google-apps.folder'%20and%20trashed%3Dfalse&fields=files(id,name)&pageSize=50&supportsAllDrives=true&includeItemsFromAllDrives=true"
    ),
  },
  {
    label: '7. List ALL top-level folders (corpora=allDrives, no parent filter)',
    run: (token) => apiGet(token,
      "https://www.googleapis.com/drive/v3/files?corpora=allDrives&supportsAllDrives=true&includeItemsFromAllDrives=true&q=mimeType%3D'application%2Fvnd.google-apps.folder'%20and%20trashed%3Dfalse&fields=files(id,name,parents,driveId)&pageSize=20"
    ),
  },
]

export default function DiagnosticsPanel() {
  const { accessToken } = useAuth()
  const [results, setResults] = useState([])
  const [running, setRunning] = useState(false)

  const runAll = async () => {
    setRunning(true)
    setResults([])
    for (const check of CHECKS) {
      setResults(prev => [...prev, { label: check.label, status: 'running…', body: null }])
      try {
        const r = await check.run(accessToken)
        setResults(prev => prev.map(x =>
          x.label === check.label
            ? { label: check.label, status: `HTTP ${r.status}`, body: r.body, ok: r.ok }
            : x
        ))
      } catch (err) {
        setResults(prev => prev.map(x =>
          x.label === check.label
            ? { label: check.label, status: 'ERROR', body: err.message, ok: false }
            : x
        ))
      }
    }
    setRunning(false)
  }

  return (
    <div style={{ padding: 20, fontFamily: 'monospace', fontSize: 13, color: '#ccc', background: '#1a1a1a', height: '100%', overflow: 'auto' }}>
      <h2 style={{ color: '#fff', marginBottom: 12 }}>Drive API Diagnostics</h2>
      <button
        onClick={runAll}
        disabled={running}
        style={{ background: '#4285F4', color: '#fff', border: 'none', borderRadius: 6, padding: '8px 18px', cursor: 'pointer', marginBottom: 20, fontSize: 14 }}
      >
        {running ? 'Running…' : 'Run All Checks'}
      </button>

      {results.map((r, i) => (
        <div key={i} style={{ marginBottom: 16, background: '#242424', borderRadius: 6, padding: 12, border: `1px solid ${r.ok === false ? '#e07070' : r.ok ? '#6bcb77' : '#444'}` }}>
          <div style={{ fontWeight: 700, marginBottom: 6, color: r.ok === false ? '#e07070' : r.ok ? '#6bcb77' : '#aaa' }}>
            {r.label} — {r.status}
          </div>
          {r.body !== null && (
            <pre style={{ margin: 0, whiteSpace: 'pre-wrap', wordBreak: 'break-all', color: '#bbb', fontSize: 12 }}>
              {typeof r.body === 'string' ? r.body : JSON.stringify(r.body, null, 2)}
            </pre>
          )}
        </div>
      ))}
    </div>
  )
}
