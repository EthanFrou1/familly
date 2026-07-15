import { useState, useEffect, useRef, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import confetti from 'canvas-confetti'
import { useMembers } from '../store/MembersContext'
import { dailyMysteryApi } from '../services/api'
import { MAX_ATTEMPTS, buildShareText } from '../utils/dailyMystery'
import GameHeader from '../components/games/GameHeader'
import DailyMysteryGrid from '../components/games/DailyMysteryGrid'
import DailyMysteryLegendSheet from '../components/games/DailyMysteryLegendSheet'
import Avatar from '../components/shared/Avatar'

export default function DailyMysteryGame() {
  const { members } = useMembers()
  const navigate = useNavigate()
  const [state, setState] = useState(null)
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [copied, setCopied] = useState(false)
  const [showLegend, setShowLegend] = useState(false)
  const confettiFiredRef = useRef(false)

  useEffect(() => {
    dailyMysteryApi.getToday()
      .then(({ data }) => setState(data))
      .catch(() => setState(null))
      .finally(() => setLoading(false))
  }, [])

  useEffect(() => {
    if (state?.status === 'solved' && !confettiFiredRef.current) {
      confettiFiredRef.current = true
      confetti({ particleCount: 120, spread: 80, origin: { y: 0.6 } })
    }
  }, [state?.status])

  const guessedIds = useMemo(() => new Set((state?.rows ?? []).map(r => r.memberId)), [state])

  const suggestions = useMemo(() => {
    const q = search.trim().toLowerCase()
    if (!q) return []
    return members
      .filter(m => !guessedIds.has(m.id))
      .filter(m => `${m.firstName} ${m.lastName}`.toLowerCase().includes(q))
      .slice(0, 6)
  }, [search, members, guessedIds])

  async function handleGuess(memberId) {
    if (submitting) return
    setSubmitting(true)
    setSearch('')
    try {
      const { data } = await dailyMysteryApi.guess(memberId)
      setState(data)
    } catch {}
    setSubmitting(false)
  }

  async function handleShare() {
    if (!state) return
    try {
      await navigator.clipboard.writeText(buildShareText(state))
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {}
  }

  if (loading) {
    return (
      <div className="h-full bg-gray-50">
        <GameHeader title="Le Mystère du jour" onBack={() => navigate('/games')} />
      </div>
    )
  }

  if (!state) {
    return (
      <div className="h-full bg-gray-50">
        <GameHeader title="Le Mystère du jour" onBack={() => navigate('/games')} />
        <p className="text-center text-sm font-semibold text-gray-400 mt-10">
          Impossible de charger le défi du jour. Réessaie plus tard.
        </p>
      </div>
    )
  }

  const finished = state.status !== 'inProgress'

  return (
    <div className="overflow-y-auto h-full bg-gray-50 pb-24">
      <GameHeader
        title="Le Mystère du jour"
        subtitle={state.streak > 0 ? `🔥 ${state.streak} jour${state.streak > 1 ? 's' : ''} de suite` : 'Devine le membre mystère'}
        onBack={() => navigate('/games')}
      />

      <div className="px-4 pt-4 space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-xs font-bold text-primary bg-white rounded-full px-3 py-1 shadow-sm">
              Essai {state.attemptsUsed}/{MAX_ATTEMPTS}
            </span>
            <button
              onClick={() => setShowLegend(true)}
              className="h-6 w-6 shrink-0 rounded-full bg-white shadow-sm flex items-center justify-center text-gray-400 text-xs font-bold active:bg-gray-50"
              aria-label="Comment lire la grille ?"
            >
              ⓘ
            </button>
          </div>
          {state.maxStreak > 0 && (
            <span className="text-xs font-semibold text-gray-400">Record : {state.maxStreak} 🔥</span>
          )}
        </div>

        <DailyMysteryGrid rows={state.rows} showBranchColumn={state.showBranchColumn} />

        {!finished && (
          <div className="relative">
            <input
              value={search}
              onChange={e => setSearch(e.target.value)}
              disabled={submitting}
              placeholder="Cherche un membre de la famille..."
              className="w-full rounded-xl border border-gray-200 bg-white px-4 py-3 text-sm font-semibold text-gray-700 shadow-sm focus:outline-none focus:ring-2 focus:ring-primary/40"
            />
            {suggestions.length > 0 && (
              <div className="absolute inset-x-0 mt-1 bg-white rounded-xl shadow-lg border border-gray-100 overflow-hidden z-10">
                {suggestions.map(m => (
                  <button
                    key={m.id}
                    onClick={() => handleGuess(m.id)}
                    className="w-full flex items-center gap-3 px-4 py-2.5 active:bg-gray-50"
                  >
                    <Avatar src={m.profilePictureUrl} name={`${m.firstName} ${m.lastName}`} size="sm" />
                    <span className="text-sm font-semibold text-gray-700">{m.firstName} {m.lastName}</span>
                  </button>
                ))}
              </div>
            )}
          </div>
        )}

        {finished && state.answer && (
          <div className="rounded-2xl bg-white shadow-sm p-4 flex items-center gap-3">
            <Avatar src={state.answer.profilePictureUrl} name={`${state.answer.firstName} ${state.answer.lastName}`} size="lg" />
            <div className="min-w-0">
              <p className="text-xs font-bold text-gray-400 uppercase tracking-wide">
                {state.status === 'solved' ? 'Trouvé !' : 'La réponse était'}
              </p>
              <p className="text-base font-black text-gray-800 truncate">
                {state.answer.firstName} {state.answer.lastName}
              </p>
              {state.answer.birthDate && (
                <p className="text-xs font-semibold text-gray-400">
                  Né(e) en {new Date(state.answer.birthDate).getFullYear()}
                  {state.answer.city ? ` · ${state.answer.city}` : ''}
                </p>
              )}
            </div>
          </div>
        )}

        {finished && (
          <button
            onClick={handleShare}
            className="w-full rounded-xl bg-primary py-3.5 text-sm font-semibold text-white shadow-lg active:bg-primary-dark"
          >
            {copied ? 'Copié ! 📋' : 'Partager mon résultat'}
          </button>
        )}

        {finished && (
          <p className="text-center text-xs font-semibold text-gray-400">Reviens demain pour un nouveau mystère !</p>
        )}
      </div>

      {showLegend && (
        <DailyMysteryLegendSheet showBranchColumn={state.showBranchColumn} onClose={() => setShowLegend(false)} />
      )}
    </div>
  )
}
