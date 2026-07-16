import { precacheAndRoute, cleanupOutdatedCaches } from 'workbox-precaching'

cleanupOutdatedCaches()
precacheAndRoute(self.__WB_MANIFEST ?? [])

// Prend le contrôle immédiatement sans attendre la fermeture de toutes les fenêtres
self.addEventListener('install', () => self.skipWaiting())
self.addEventListener('activate', event => event.waitUntil(clients.claim()))

// Compatibilité avec vite-plugin-pwa autoUpdate (envoie ce message quand une MAJ est détectée)
self.addEventListener('message', event => {
  if (event.data?.type === 'SKIP_WAITING') self.skipWaiting()
})

self.addEventListener('push', event => {
  if (!event.data) return
  const { title, body, url } = event.data.json()
  event.waitUntil(
    self.registration.showNotification(title, {
      body,
      icon: '/icons/icon-192x192.png',
      badge: '/icons/icon-96x96.png',
      vibrate: [200, 100, 200],
      data: { url: url ?? '/' },
    })
  )
})

self.addEventListener('notificationclick', event => {
  event.notification.close()
  const url = event.notification.data?.url ?? '/'
  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then(async list => {
      const existing = list.find(c => 'focus' in c)
      if (existing) {
        // Sur iOS/Safari en PWA, une fenêtre déjà ouverte ne change pas de route
        // via clients.openWindow (elle est juste ramenée au premier plan) : on
        // délègue la navigation à l'app elle-même via postMessage.
        await existing.focus()
        existing.postMessage({ type: 'navigate', url })
        return
      }
      return clients.openWindow(url)
    })
  )
})
