import { precacheAndRoute, cleanupOutdatedCaches } from 'workbox-precaching'
import { savePendingRedirect } from './utils/pendingRedirect'

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
        await existing.focus()
        // client.navigate() redirige réellement la fenêtre existante — contrairement à un
        // postMessage seul, qui ne fonctionne que si l'app écoute déjà ce message, ce qui n'est
        // pas garanti si elle était en arrière-plan ou gelée par l'OS (c'était le bug : la
        // fenêtre revenait au premier plan sur la page où elle était restée, ex. Home, au lieu
        // de la room défiée). postMessage reste envoyé en complément pour Firefox, qui ne
        // supporte pas navigate() sur un WindowClient.
        if ('navigate' in existing) {
          try {
            await existing.navigate(url)
          } catch {
            existing.postMessage({ type: 'navigate', url })
          }
        } else {
          existing.postMessage({ type: 'navigate', url })
        }
        return
      }
      // Filet de secours pour le bug WebKit qui ignore parfois l'URL passée à openWindow au
      // lancement à froid (voir utils/pendingRedirect.js) : l'app la relira à son démarrage.
      await savePendingRedirect(url)
      return clients.openWindow(url)
    })
  )
})
