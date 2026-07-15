import { useEffect, useState } from 'react'
import { dailyMysteryApi } from '../services/api'

// État en lecture seule du défi du jour (pour les aperçus sur Accueil/Jeux) :
// n'écrit jamais de tentative, contrairement à la page de jeu elle-même.
export function useDailyMysteryStatus(enabled = true) {
  const [state, setState] = useState(null)
  const [loading, setLoading] = useState(enabled)

  useEffect(() => {
    if (!enabled) {
      setLoading(false)
      return
    }

    let cancelled = false
    setLoading(true)

    dailyMysteryApi.getToday()
      .then(({ data }) => { if (!cancelled) setState(data) })
      .catch(() => {})
      .finally(() => { if (!cancelled) setLoading(false) })

    return () => { cancelled = true }
  }, [enabled])

  return { state, loading }
}
