import { useEffect, useRef } from 'react'

/**
 * Auto-refresh data when the app comes to the foreground (Visibility API)
 * and poll every `intervalMs` while the app is visible.
 * Uses a ref so the latest callback is always called without needing it in deps.
 */
export function usePageRefresh(callback, intervalMs = 60_000) {
  const cbRef = useRef(callback)
  cbRef.current = callback

  useEffect(() => {
    let id = null
    const run = () => cbRef.current()
    const start = () => { id = setInterval(run, intervalMs) }
    const stop = () => { clearInterval(id); id = null }

    const onVisibility = () => {
      if (document.visibilityState === 'visible') {
        run()
        start()
      } else {
        stop()
      }
    }

    document.addEventListener('visibilitychange', onVisibility)
    if (document.visibilityState === 'visible') start()

    return () => {
      document.removeEventListener('visibilitychange', onVisibility)
      stop()
    }
  }, [intervalMs])
}
