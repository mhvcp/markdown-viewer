import { AuthProvider, useAuth } from './auth/auth-context.jsx'
import GoogleAuth from './auth/GoogleAuth.jsx'
import Editor from './editor/Editor.jsx'

function AppInner() {
  const { accessToken } = useAuth()
  return accessToken ? <Editor /> : <GoogleAuth />
}

export default function App() {
  return (
    <AuthProvider>
      <AppInner />
    </AuthProvider>
  )
}
