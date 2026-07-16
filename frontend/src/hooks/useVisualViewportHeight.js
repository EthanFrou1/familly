import { useEffect, useState } from 'react'

// Sur iOS Safari, l'ouverture du clavier ne redimensionne pas window.innerHeight
// (utilisé par h-full) : elle décale le viewport visuel, ce qui masque le contenu
// au-dessus du champ focus au lieu de le faire remonter. On mesure la hauteur
// visible réelle pour pouvoir contraindre le layout dessus.
export function useVisualViewportHeight() {
  const [height, setHeight] = useState(() => window.visualViewport?.height ?? window.innerHeight)

  useEffect(() => {
    const vv = window.visualViewport
    if (!vv) return
    const update = () => setHeight(vv.height)
    vv.addEventListener('resize', update)
    vv.addEventListener('scroll', update)
    return () => {
      vv.removeEventListener('resize', update)
      vv.removeEventListener('scroll', update)
    }
  }, [])

  return height
}
