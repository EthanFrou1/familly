import { useState, useEffect } from 'react'
import { pushApi } from '../services/api'

function urlBase64ToUint8Array(base64String) {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4)
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/')
  const raw = atob(base64)
  return Uint8Array.from([...raw].map(c => c.charCodeAt(0)))
}

// Site installé en PWA (mode standalone) : requis sur iOS pour recevoir des push,
// et utilisé pour ne cibler les défis qu'aux membres réellement joignables.
function isStandaloneDisplay() {
  return window.matchMedia?.('(display-mode: standalone)').matches || window.navigator.standalone === true
}

export function usePushNotifications() {
  const [permission, setPermission] = useState(
    typeof Notification !== 'undefined' ? Notification.permission : 'default'
  )
  const [subscribed, setSubscribed] = useState(false)
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (!('serviceWorker' in navigator) || !('PushManager' in window)) return
    navigator.serviceWorker.ready.then(async reg => {
      const sub = await reg.pushManager.getSubscription()
      if (sub) { setSubscribed(true); return }

      // Permission déjà accordée (PWA réinstallée) → re-souscrire silencieusement
      if (Notification.permission === 'granted') {
        try {
          const { data } = await pushApi.getVapidPublicKey()
          const newSub = await reg.pushManager.subscribe({
            userVisibleOnly: true,
            applicationServerKey: urlBase64ToUint8Array(data.key),
          })
          const json = newSub.toJSON()
          await pushApi.subscribe(json.endpoint, json.keys.p256dh, json.keys.auth, isStandaloneDisplay())
          setSubscribed(true)
        } catch { /* silencieux */ }
      }
    })
  }, [])

  async function subscribe() {
    if (!('serviceWorker' in navigator) || !('PushManager' in window)) return
    setLoading(true)
    try {
      const perm = await Notification.requestPermission()
      setPermission(perm)
      if (perm !== 'granted') return

      const { data } = await pushApi.getVapidPublicKey()

      // Timeout de 8s au cas où le SW n'est pas encore prêt
      const reg = await Promise.race([
        navigator.serviceWorker.ready,
        new Promise((_, reject) => setTimeout(() => reject(new Error('SW timeout')), 8000)),
      ])

      const sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(data.key),
      })

      const json = sub.toJSON()
      await pushApi.subscribe(json.endpoint, json.keys.p256dh, json.keys.auth, isStandaloneDisplay())
      setSubscribed(true)
    } catch (e) {
      console.error('Push subscribe error', e)
    } finally {
      setLoading(false)
    }
  }

  async function unsubscribe() {
    setLoading(true)
    try {
      const reg = await navigator.serviceWorker.ready
      const sub = await reg.pushManager.getSubscription()
      if (sub) {
        await pushApi.unsubscribe(sub.endpoint)
        await sub.unsubscribe()
      }
      setSubscribed(false)
    } catch (e) {
      console.error('Push unsubscribe error', e)
    } finally {
      setLoading(false)
    }
  }

  const supported = 'serviceWorker' in navigator && 'PushManager' in window
  const blocked = permission === 'denied'

  return { supported, subscribed, permission, blocked, loading, subscribe, unsubscribe }
}
