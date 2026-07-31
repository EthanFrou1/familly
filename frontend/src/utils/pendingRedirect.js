// Filet de secours pour le deep-link des notifications push : sur certaines versions
// d'iOS/Safari, clients.openWindow(url) appelé depuis le service worker au lancement à froid
// ignore parfois l'URL demandée et ouvre le start_url du manifest à la place (bug WebKit connu).
// IndexedDB est la seule mémoire partagée entre le service worker et les pages de l'app
// (localStorage n'est pas accessible depuis un service worker) : le SW y dépose l'URL cible
// juste avant openWindow, et l'app la relit à son démarrage pour terminer la redirection.
const DB_NAME = 'familyapp-sw'
const STORE_NAME = 'pending'
const KEY = 'redirectUrl'

function openDb() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, 1)
    req.onupgradeneeded = () => req.result.createObjectStore(STORE_NAME)
    req.onsuccess = () => resolve(req.result)
    req.onerror = () => reject(req.error)
  })
}

export async function savePendingRedirect(url) {
  try {
    const db = await openDb()
    await new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readwrite')
      tx.objectStore(STORE_NAME).put(url, KEY)
      tx.oncomplete = resolve
      tx.onerror = () => reject(tx.error)
    })
  } catch {
    // Best-effort : si indexedDB est indisponible, openWindow(url) reste tenté normalement.
  }
}

export async function readAndClearPendingRedirect() {
  try {
    const db = await openDb()
    return await new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readwrite')
      const store = tx.objectStore(STORE_NAME)
      const getReq = store.get(KEY)
      getReq.onsuccess = () => {
        store.delete(KEY)
        resolve(getReq.result ?? null)
      }
      getReq.onerror = () => reject(getReq.error)
    })
  } catch {
    return null
  }
}
