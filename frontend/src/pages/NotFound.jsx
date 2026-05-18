import { useNavigate } from 'react-router-dom'

export default function NotFound() {
  const navigate = useNavigate()

  return (
    <div className="flex h-full flex-col items-center justify-center bg-gray-50 px-6 text-center">
      <div className="animate-fade-in">
        <p className="text-7xl font-black text-primary/20 select-none">404</p>
        <h1 className="mt-2 text-xl font-bold text-gray-900">Page introuvable</h1>
        <p className="mt-2 text-sm text-gray-400">
          Cette page n'existe pas ou a été déplacée.
        </p>
        <div className="mt-8 flex flex-col gap-3">
          <button
            onClick={() => navigate('/')}
            className="rounded-2xl bg-primary px-8 py-3.5 font-semibold text-white active:bg-primary/90 transition-colors"
          >
            Retour à l'accueil
          </button>
          <button
            onClick={() => navigate(-1)}
            className="rounded-2xl border border-gray-200 px-8 py-3.5 text-sm font-medium text-gray-500 active:bg-gray-50 transition-colors"
          >
            Page précédente
          </button>
        </div>
      </div>
    </div>
  )
}
