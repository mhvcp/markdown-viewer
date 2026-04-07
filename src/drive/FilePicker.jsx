import { useEffect, useState } from 'react'
import { useAuth } from '../auth/auth-context.jsx'

const API_KEY = import.meta.env.VITE_GOOGLE_API_KEY || ''
const APP_ID = import.meta.env.VITE_GOOGLE_APP_ID || ''

export default function FilePicker({ onFilePicked }) {
  const { accessToken } = useAuth()
  const [pickerReady, setPickerReady] = useState(false)

  useEffect(() => {
    const load = () => {
      window.gapi.load('picker', () => setPickerReady(true))
    }
    if (window.gapi) {
      load()
    } else {
      const iv = setInterval(() => {
        if (window.gapi) {
          clearInterval(iv)
          load()
        }
      }, 200)
      return () => clearInterval(iv)
    }
  }, [])

  const openPicker = () => {
    if (!pickerReady || !accessToken) return

    const mdView = new google.picker.DocsView()
      .setMimeTypes('text/markdown,text/plain')
      .setMode(google.picker.DocsViewMode.LIST)

    const picker = new google.picker.PickerBuilder()
      .addView(mdView)
      .setOAuthToken(accessToken)
      .setDeveloperKey(API_KEY)
      .setAppId(APP_ID)
      .setTitle('Select a Markdown file')
      .setCallback((data) => {
        if (data.action === google.picker.Action.PICKED) {
          const doc = data.docs[0]
          onFilePicked({ id: doc.id, name: doc.name })
        }
      })
      .build()

    picker.setVisible(true)
  }

  return (
    <button className="toolbar-btn" onClick={openPicker} title="Open file from Google Drive">
      Open
    </button>
  )
}
