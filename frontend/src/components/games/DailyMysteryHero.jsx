import { useNavigate } from 'react-router-dom'
import { useDailyMysteryStatus } from '../../hooks/useDailyMysteryStatus'

export default function DailyMysteryHero({ unlocked, minMembers }) {
  const navigate = useNavigate()
  const { state, loading } = useDailyMysteryStatus(unlocked)
  const finished = unlocked && state && state.status !== 'inProgress'

  return (
    <div className="relative rounded-3xl bg-dark shadow-lg shadow-black/10 overflow-hidden p-5">
      <span className="absolute top-4 right-4 rounded-full bg-amber-500/90 text-white text-[10px] font-extrabold tracking-wide px-2.5 py-1">
        QUOTIDIEN
      </span>

      <div className={`transition-opacity ${finished ? 'opacity-50' : ''}`}>
        <div className="text-5xl text-center mt-1 mb-2">🔮</div>
        <h2 className="text-xl font-black text-white text-center mt-1">Le Membre Mystère</h2>
        <p className="text-sm text-white/75 font-medium text-center mt-2 mb-1">
          Un membre mystère à deviner, autant d'essais que nécessaire. Un par jour, pour toute la famille !
        </p>

        {!unlocked && (
          <p className="text-xs text-white/60 text-center mb-1">{minMembers} membres min. pour débloquer</p>
        )}

        {unlocked && finished && (
          <div className="mt-3 rounded-2xl bg-white/10 py-3.5 text-center">
            <p className="text-sm font-black text-white">
              ✅ Trouvé en {state.attemptsUsed} essai{state.attemptsUsed > 1 ? 's' : ''}
            </p>
            <p className="text-xs text-white/60 mt-0.5">Reviens demain pour un nouveau mystère</p>
          </div>
        )}
      </div>

      {unlocked && finished && (
        <button
          onClick={() => navigate('/games/daily-mystery')}
          className="w-full rounded-2xl bg-primary text-white font-black text-base py-4 flex items-center justify-center gap-2 shadow-lg shadow-primary/30 active:bg-primary-dark mt-2"
        >
          Voir le classement
        </button>
      )}

      {unlocked && !finished && (
        <button
          disabled={loading}
          onClick={() => navigate('/games/daily-mystery')}
          className="w-full rounded-2xl bg-primary text-white font-black text-base py-4 flex items-center justify-center gap-2 shadow-lg shadow-primary/30 active:bg-primary-dark mt-2 disabled:opacity-50"
        >
          <svg className="h-4 w-4" fill="currentColor" viewBox="0 0 24 24"><path d="M8 5v14l11-7z" /></svg>
          {state?.attemptsUsed > 0 ? `Continuer (essai ${state.attemptsUsed})` : 'Jouer'}
        </button>
      )}
    </div>
  )
}
