import { useEffect, useRef, useState } from 'react'
import { useAuth } from './auth-context.jsx'

const CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID || ''

// drive          → full Drive access (read/write all files + shared drives)
// cloud-platform → Vertex AI / Gemini API calls
const SCOPE = [
  'https://www.googleapis.com/auth/drive',
  'https://www.googleapis.com/auth/cloud-platform',
].join(' ')

export default function GoogleAuth() {
  const { setAccessToken, setUserInfo, setTokenClient, userInfo } = useAuth()
  const tokenClientRef = useRef(null)
  const [gisReady, setGisReady] = useState(false)
  // Only show "restoring" if we have a cached user but NO stored token (token expired)
  const hasStoredToken = !!sessionStorage.getItem('vcp_access_token')
  const [restoring, setRestoring] = useState(!!userInfo && !hasStoredToken)

  useEffect(() => {
    const init = () => {
      const client = google.accounts.oauth2.initTokenClient({
        client_id: CLIENT_ID,
        scope: SCOPE,
        callback: (response) => {
          setRestoring(false)
          if (response.error) {
            console.error('Auth error:', response.error)
            return
          }
          const token = response.access_token
          const expiresAt = Date.now() + (response.expires_in - 60) * 1000
          setAccessToken(token, expiresAt)

          fetch('https://www.googleapis.com/oauth2/v3/userinfo', {
            headers: { Authorization: `Bearer ${token}` },
          })
            .then((r) => r.json())
            .then((info) => setUserInfo(info))
            .catch(() => {})
        },
      })
      // Store email hint for background refresh calls
      client._hint = userInfo?.email || ''
      tokenClientRef.current = client
      setTokenClient(client)
      setGisReady(true)

      // Only do a silent restore if token expired (no stored token) but we know the user
      if (userInfo && !hasStoredToken) {
        client.requestAccessToken({ prompt: '', login_hint: userInfo.email })
      }
    }

    if (window.google?.accounts?.oauth2) {
      init()
    } else {
      const iv = setInterval(() => {
        if (window.google?.accounts?.oauth2) {
          clearInterval(iv)
          init()
        }
      }, 100)
      return () => clearInterval(iv)
    }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  const handleSignIn = () => {
    tokenClientRef.current?.requestAccessToken({ prompt: 'consent' })
  }

  if (restoring) {
    return (
      <div className="auth-screen">
        <div className="auth-card">
          <div className="auth-logo">VCP MD</div>
          <p>Restoring session…</p>
        </div>
      </div>
    )
  }

  return (
    <div className="auth-screen">
      <div className="auth-card">
        <div className="auth-logo">VCP MD</div>
        <h1>VCP Markdown Editor</h1>
        <p>Sign in with Google to access your Drive files.</p>
        <button className="signin-btn" onClick={handleSignIn} disabled={!gisReady}>
          {gisReady ? 'Sign in with Google' : 'Loading…'}
        </button>
        {!CLIENT_ID && (
          <p className="auth-warning">
            ⚠ VITE_GOOGLE_CLIENT_ID not set — add it to <code>.env.local</code>
          </p>
        )}
      </div>
    </div>
  )
}
