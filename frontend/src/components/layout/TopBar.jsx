import { useLocation } from 'react-router-dom'
import { useAuth } from '../../hooks/useAuth'

const TITLES = {
  '/': 'Accueil',
  '/tree': 'Arbre généalogique',
  '/map': 'Carte',
  '/photos': 'Photos',
  '/profile': 'Profil',
}

export default function TopBar() {
  const { pathname } = useLocation()
  const { user } = useAuth()
  const title = TITLES[pathname] ?? 'Famille'

  return (
    <header className="safe-top bg-dark text-white">
      <div className="flex items-center justify-between px-4 py-3">
        <h1 className="text-lg font-semibold">{title}</h1>
        <div className="flex items-center gap-2">
          <span className="text-sm text-gray-300">{user?.firstName}</span>
        </div>
      </div>
    </header>
  )
}
