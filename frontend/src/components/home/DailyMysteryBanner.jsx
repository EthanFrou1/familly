import { useNavigate } from 'react-router-dom'
import { useDailyMysteryStatus } from '../../hooks/useDailyMysteryStatus'

export default function DailyMysteryBanner() {
  const navigate = useNavigate()
  const { state, loading } = useDailyMysteryStatus()

  if (loading || !state) return null

  const finished = state.status !== 'inProgress'

  return (
    <button
      onClick={() => !finished && navigate('/games/daily-mystery')}
      disabled={finished}
      className={`flex items-center gap-3 w-full rounded-2xl shadow-sm px-4 py-3.5 text-left transition-opacity ${
        finished ? 'bg-white opacity-50 cursor-default' : 'bg-gradient-to-r from-primary/10 to-amber-50 active:opacity-70'
      }`}
    >
      <span className="text-2xl shrink-0">🔮</span>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-bold text-gray-900">Le Membre Mystère</p>
        <p className="text-xs text-gray-500 mt-0.5">
          {finished
            ? `Trouvé en ${state.attemptsUsed} essai${state.attemptsUsed > 1 ? 's' : ''} · reviens demain`
            : state.attemptsUsed > 0
              ? `Essai ${state.attemptsUsed} en cours`
              : 'Devine le membre mystère du jour'}
        </p>
      </div>
      {!finished && (
        <svg className="h-4 w-4 text-gray-300 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
        </svg>
      )}
    </button>
  )
}
