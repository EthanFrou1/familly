import { useState, useEffect, useRef, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import confetti from 'canvas-confetti'
import { useMembers } from '../store/MembersContext'
import { dailyMysteryApi } from '../services/api'
import { MAX_ATTEMPTS, buildShareText } from '../utils/dailyMystery'
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
      <div className="h-full bg-surface">
        <MysteryHeader onBack={() => navigate('/games')} />
      </div>
    )
  }

  if (!state) {
    return (
      <div className="h-full bg-surface">
        <MysteryHeader onBack={() => navigate('/games')} />
        <p className="text-center text-sm font-semibold text-gray-400 mt-10">
          Impossible de charger le défi du jour. Réessaie plus tard.
        </p>
      </div>
    )
  }

  const finished = state.status !== 'inProgress'

  return (
    <div className="h-full flex flex-col bg-surface">
      <div className="shrink-0">
        <MysteryHeader
          onBack={() => navigate('/games')}
          subtitle={state.streak > 0 ? `🔥 ${state.streak} jour${state.streak > 1 ? 's' : ''} de suite` : 'Devine le membre mystère 🔍'}
        />
      </div>

      <div className="shrink-0 flex items-center gap-2 px-4 pt-3">
        <span className="text-xs font-extrabold text-dark bg-primary/15 border border-primary/40 rounded-full px-3.5 py-1.5">
          Essai {state.attemptsUsed}/{MAX_ATTEMPTS}
        </span>
        <button
          onClick={() => setShowLegend(true)}
          className="h-6 w-6 shrink-0 rounded-full border border-gray-300 bg-white flex items-center justify-center text-gray-500 text-[11px] font-bold active:bg-gray-50"
          aria-label="Comment lire la grille ?"
        >
          i
        </button>
        {state.maxStreak > 0 && (
          <span className="ml-auto text-xs font-semibold text-gray-400">Record : {state.maxStreak} 🔥</span>
        )}
      </div>

      <div className="shrink-0 flex items-center gap-3 px-4 pb-1.5 pt-1 text-[10px] font-semibold text-gray-500">
        <LegendDot className="bg-green-500" label="Trouvé" />
        <LegendDot className="bg-primary" label="Proche" />
        <LegendDot className="bg-stone-100 border border-stone-300" label="Différent" />
      </div>

      <div className="px-4">
        <DailyMysteryGrid rows={state.rows} showBranchColumn={state.showBranchColumn} />
      </div>

      {!finished && (
        <div className="shrink-0 px-4 pb-4 pt-2 relative">
          {suggestions.length > 0 && (
            <div className="absolute inset-x-4 bottom-full mb-1 bg-white rounded-2xl shadow-lg border border-gray-100 overflow-hidden z-20">
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
          <div className="flex items-center gap-2 bg-white border border-gray-200 rounded-2xl px-3.5 py-2.5 shadow-sm">
            <span className="text-base shrink-0">🔎</span>
            <input
              value={search}
              onChange={e => setSearch(e.target.value)}
              disabled={submitting}
              placeholder="Cherche un membre de la famille..."
              className="flex-1 min-w-0 bg-transparent text-sm font-semibold text-gray-700 focus:outline-none"
            />
          </div>
        </div>
      )}

      {finished && (
        <div className="shrink-0 px-4 pb-4 pt-2 space-y-3">
          {state.answer && (
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

          <button
            onClick={handleShare}
            className="w-full rounded-xl bg-primary py-3.5 text-sm font-semibold text-white shadow-lg active:bg-primary-dark"
          >
            {copied ? 'Copié ! 📋' : 'Partager mon résultat'}
          </button>

          <p className="text-center text-xs font-semibold text-gray-400">Reviens demain pour un nouveau mystère !</p>
        </div>
      )}

      {showLegend && (
        <DailyMysteryLegendSheet showBranchColumn={state.showBranchColumn} onClose={() => setShowLegend(false)} />
      )}
    </div>
  )
}

function MysteryHeader({ onBack, subtitle }) {
  return (
    <div
      className="relative overflow-hidden px-5 pt-12 pb-6"
      style={{ background: 'linear-gradient(135deg, rgb(45 122 66), rgb(33 92 51))' }}
    >
      <div className="pointer-events-none absolute -top-8 -right-5 h-24 w-24 rounded-full bg-white/10" />
      <div className="pointer-events-none absolute bottom-1 right-16 h-9 w-9 rounded-xl bg-white/10 rotate-12" />
      <div className="pointer-events-none absolute top-5 right-28 h-3.5 w-3.5 rounded-full bg-white/20" />

      <div className="relative flex items-center gap-3">
        <button
          onClick={onBack}
          className="shrink-0 h-9 w-9 rounded-xl bg-white/15 flex items-center justify-center text-white active:bg-white/25"
        >
          <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
          </svg>
        </button>
        <div className="min-w-0">
          <h1 className="text-xl font-black text-white leading-tight truncate">Le Mystère du jour</h1>
          {subtitle && <p className="text-xs font-semibold text-white/80 mt-0.5 truncate">{subtitle}</p>}
        </div>
      </div>
    </div>
  )
}

function LegendDot({ className, label }) {
  return (
    <span className="flex items-center gap-1.5">
      <span className={`h-2.5 w-2.5 rounded-sm shrink-0 ${className}`} />
      {label}
    </span>
  )
}
