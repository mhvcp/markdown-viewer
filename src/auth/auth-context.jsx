import { createContext, useContext, useState, useCallback, useRef, useEffect } from 'react'

const AuthContext = createContext(null)

const USER_INFO_KEY = 'vcp_user_info'
const TOKEN_KEY = 'vcp_access_token'

function loadStoredToken() {
  try {
    const raw = localStorage.getItem(TOKEN_KEY)
    if (!raw) return null
    const { token, expiresAt } = JSON.parse(raw)
    if (Date.now() >= expiresAt) { localStorage.removeItem(TOKEN_KEY); return null }
    return { token, expiresAt }
  } catch { return null }
}

export function AuthProvider({ children }) {
  const stored = loadStoredToken()
  const [accessToken, setAccessTokenState] = useState(stored?.token ?? null)
  const [userInfo, setUserInfoState] = useState(() => {
    try { return JSON.parse(localStorage.getItem(USER_INFO_KEY)) } catch { return null }
  })
  const tokenClientRef = useRef(null)
  const refreshTimerRef = useRef(null)

  const setUserInfo = useCallback((info) => {
    setUserInfoState(info)
    if (info) localStorage.setItem(USER_INFO_KEY, JSON.stringify(info))
    else localStorage.removeItem(USER_INFO_KEY)
  }, [])

  const scheduleRefresh = useCallback((expiresAt) => {
    if (refreshTimerRef.current) clearTimeout(refreshTimerRef.current)
    if (!expiresAt) return
    const delay = expiresAt - Date.now()
    refreshTimerRef.current = setTimeout(() => {
      tokenClientRef.current?.requestAccessToken({ prompt: '', login_hint: tokenClientRef.current._hint })
    }, Math.max(delay, 0))
  }, [])

  const setAccessToken = useCallback((token, expiresAt) => {
    setAccessTokenState(token)
    if (token && expiresAt) {
      localStorage.setItem(TOKEN_KEY, JSON.stringify({ token, expiresAt }))
    } else {
      localStorage.removeItem(TOKEN_KEY)
    }
    scheduleRefresh(expiresAt)
  }, [scheduleRefresh])

  // Start refresh timer for token restored from sessionStorage
  useEffect(() => {
    if (stored?.expiresAt) scheduleRefresh(stored.expiresAt)
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  const setTokenClient = useCallback((client) => {
    tokenClientRef.current = client
  }, [])

  const signOut = useCallback(() => {
    if (refreshTimerRef.current) clearTimeout(refreshTimerRef.current)
    if (accessToken && window.google?.accounts?.oauth2) {
      google.accounts.oauth2.revoke(accessToken, () => {})
    }
    setAccessTokenState(null)
    setUserInfo(null)
    localStorage.removeItem(TOKEN_KEY)
  }, [accessToken, setUserInfo])

  // Cleanup timer on unmount
  useEffect(() => {
    return () => {
      if (refreshTimerRef.current) clearTimeout(refreshTimerRef.current)
    }
  }, [])

  return (
    <AuthContext.Provider
      value={{ accessToken, setAccessToken, userInfo, setUserInfo, setTokenClient, signOut }}
    >
      {children}
    </AuthContext.Provider>
  )
}

export const useAuth = () => useContext(AuthContext)
