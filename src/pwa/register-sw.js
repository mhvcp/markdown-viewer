export function registerSW() {
  if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
      navigator.serviceWorker
        .register('/vcp-md-editor/sw.js')
        .catch(() => {
          // Service worker not available in dev — that's fine
        })
    })
  }
}
