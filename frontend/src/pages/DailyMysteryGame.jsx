import { useState, useEffect, useRef, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import confetti from 'canvas-confetti'
import { useAuth } from '../hooks/useAuth'
import { useMembers } from '../store/MembersContext'
import { dailyMysteryApi } from '../services/api'
import DailyMysteryGrid from '../components/games/DailyMysteryGrid'
import DailyMysteryLegendSheet from '../components/games/DailyMysteryLegendSheet'
import DailyMysteryMountain from '../components/games/DailyMysteryMountain'
import Avatar from '../components/shared/Avatar'
import { matchesSearch } from '../utils/normalize'

const TIER1_POINTS = 3 // trouvé en 1-2 essais
const TIER2_POINTS = 2 // trouvé en 3-4 essais
const TIER3_POINTS = 1 // trouvé en 5 essais ou plus

export default function DailyMysteryGame() {
  const { user } = useAuth()
  const { members } = useMembers()
  const navigate = useNavigate()
  const [step, setStep] = useState('lobby')
  const [lobbyTab, setLobbyTab] = useState('today')
  const [participants, setParticipants] = useState(null)
  const [loadingParticipants, setLoadingParticipants] = useState(true)
  const [yesterdayParticipants, setYesterdayParticipants] = useState(null)
  const [loadingYesterday, setLoadingYesterday] = useState(true)
  const [pointsLeaderboard, setPointsLeaderboard] = useState(null)
  const [loadingPoints, setLoadingPoints] = useState(true)
  const [victoriesLeaderboard, setVictoriesLeaderboard] = useState(null)
  const [loadingVictories, setLoadingVictories] = useState(true)
  const [state, setState] = useState(null)
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [pendingGuess, setPendingGuess] = useState(null)
  const [showLegend, setShowLegend] = useState(false)
  const confettiFiredRef = useRef(false)

  useEffect(() => {
    dailyMysteryApi.getTodayLeaderboard()
      .then(({ data }) => setParticipants(data))
      .catch(() => setParticipants([]))
      .finally(() => setLoadingParticipants(false))

    dailyMysteryApi.getYesterdayLeaderboard()
      .then(({ data }) => setYesterdayParticipants(data))
      .catch(() => setYesterdayParticipants([]))
      .finally(() => setLoadingYesterday(false))

    dailyMysteryApi.getPointsLeaderboard()
      .then(({ data }) => setPointsLeaderboard(data))
      .catch(() => setPointsLeaderboard([]))
      .finally(() => setLoadingPoints(false))

    dailyMysteryApi.getVictoriesLeaderboard()
      .then(({ data }) => setVictoriesLeaderboard(data))
      .catch(() => setVictoriesLeaderboard([]))
      .finally(() => setLoadingVictories(false))
  }, [])

  useEffect(() => {
    if (step !== 'game') return
    dailyMysteryApi.getToday()
      .then(({ data }) => setState(data))
      .catch(() => setState(null))
      .finally(() => setLoading(false))
  }, [step])

  useEffect(() => {
    if (state?.status === 'solved' && !confettiFiredRef.current) {
      confettiFiredRef.current = true
      confetti({ particleCount: 120, spread: 80, origin: { y: 0.6 } })
    }
  }, [state?.status])

  const guessedIds = useMemo(() => new Set((state?.rows ?? []).map(r => r.memberId)), [state])

  const suggestions = useMemo(() => {
    const q = search.trim()
    if (!q) return []
    return members
      .filter(m => !guessedIds.has(m.id))
      .filter(m => matchesSearch(`${m.firstName} ${m.lastName}`, q))
      .slice(0, 6)
  }, [search, members, guessedIds])

  async function handleGuess(memberId) {
    if (submitting) return
    const member = members.find(m => m.id === memberId)
    setSubmitting(true)
    setSearch('')
    setPendingGuess(member ?? null)
    try {
      const { data } = await dailyMysteryApi.guess(memberId)
      setState(data)
    } catch {}
    setSubmitting(false)
    setPendingGuess(null)
  }

  if (step === 'lobby') {
    const myEntry = participants?.find(p => p.memberId === user?.memberId)
    const ctaLabel = !myEntry || myEntry.attemptsUsed === 0
      ? 'Lancer le jeu'
      : myEntry.status === 'inProgress'
        ? `Continuer (essai ${myEntry.attemptsUsed})`
        : null

    return (
      <div className="h-full flex flex-col bg-surface">
        <div className="shrink-0">
          <MysteryHeader onBack={() => navigate('/games')} subtitle="Qui a déjà relevé le défi aujourd'hui ?" />
        </div>

        <div className="shrink-0 flex gap-2 px-4 pt-4">
          <TabButton active={lobbyTab === 'today'} onClick={() => setLobbyTab('today')}>Aujourd'hui</TabButton>
          <TabButton active={lobbyTab === 'yesterday'} onClick={() => setLobbyTab('yesterday')}>Hier</TabButton>
          <TabButton active={lobbyTab === 'week'} onClick={() => setLobbyTab('week')}>Cette semaine</TabButton>
        </div>

        <div className="flex-1 min-h-0 overflow-y-auto px-4 pt-3 space-y-2">
          {lobbyTab === 'today' ? (
            loadingParticipants ? (
              <p className="text-center text-sm font-semibold text-gray-400 py-10">Chargement…</p>
            ) : participants.length === 0 ? (
              <p className="text-center text-sm font-semibold text-gray-400 py-10">
                Personne n'a encore relevé le défi aujourd'hui. Sois le premier ! 🚀
              </p>
            ) : (
              <>
                <p className="text-xs font-semibold text-gray-400 px-0.5">
                  Points définitifs à la fin de la journée — encore modifiables si quelqu'un fait mieux.
                </p>
                {participants.map(p => (
                  <ParticipantRow key={p.memberId} p={p} isMe={p.memberId === user?.memberId} />
                ))}
              </>
            )
          ) : lobbyTab === 'yesterday' ? (
            loadingYesterday ? (
              <p className="text-center text-sm font-semibold text-gray-400 py-10">Chargement…</p>
            ) : !yesterdayParticipants || yesterdayParticipants.length === 0 ? (
              <p className="text-center text-sm font-semibold text-gray-400 py-10">
                Personne n'a relevé le défi hier.
              </p>
            ) : (
              <>
                <p className="text-xs font-semibold text-gray-400 px-0.5">
                  Résultats définitifs d'hier — {TIER1_POINTS} pts en 1-2 essais, {TIER2_POINTS} pts en 3-4, {TIER3_POINTS} pt à partir de 5.
                </p>
                {yesterdayParticipants.map(p => (
                  <ParticipantRow key={p.memberId} p={p} isMe={p.memberId === user?.memberId} />
                ))}
              </>
            )
          ) : (
            loadingPoints ? (
              <p className="text-center text-sm font-semibold text-gray-400 py-10">Chargement…</p>
            ) : pointsLeaderboard.length === 0 ? (
              <p className="text-center text-sm font-semibold text-gray-400 py-10">
                Aucun point marqué cette semaine. Reviens demain !
              </p>
            ) : (
              <>
                <p className="text-xs font-semibold text-gray-400 px-0.5">
                  🏆 {TIER1_POINTS} pts en 1-2 essais, {TIER2_POINTS} pts en 3-4, {TIER3_POINTS} pt à partir de 5. Remis à zéro chaque lundi.
                </p>
                {pointsLeaderboard.map((e, i) => (
                  <PointsRow key={e.memberId} e={e} rank={i + 1} isMe={e.memberId === user?.memberId} />
                ))}
              </>
            )
          )}
        </div>

        <div className="shrink-0 px-4 pb-4 pt-2 space-y-2">
          {ctaLabel && (
            <button
              onClick={() => setStep('game')}
              className="w-full rounded-xl bg-primary py-3.5 text-sm font-semibold text-white shadow-lg active:bg-primary-dark"
            >
              {ctaLabel}
            </button>
          )}
          <button
            onClick={() => setStep('general')}
            className="w-full flex items-center justify-center gap-1.5 rounded-xl bg-white border border-gray-200 py-3 text-sm font-semibold text-gray-600 shadow-sm active:bg-gray-50"
          >
            🏔️ Classement général
          </button>
        </div>

        <div className="shrink-0 h-6" />
      </div>
    )
  }

  if (step === 'general') {
    return (
      <div className="h-full flex flex-col bg-surface">
        <div className="shrink-0">
          <MysteryHeader onBack={() => setStep('lobby')} subtitle="Classement général" />
        </div>

        <div className="flex-1 min-h-0 px-4 pt-3 pb-3">
          {loadingVictories ? (
            <p className="text-center text-sm font-semibold text-gray-400 py-10">Chargement…</p>
          ) : victoriesLeaderboard.length === 0 ? (
            <p className="text-center text-sm font-semibold text-gray-400 py-10">
              Personne n'a encore joué. Le classement général démarre à la fin de la première semaine !
            </p>
          ) : (
            <DailyMysteryMountain entries={victoriesLeaderboard} currentMemberId={user?.memberId} />
          )}
        </div>
      </div>
    )
  }

  if (loading) {
    return (
      <div className="h-full bg-surface">
        <MysteryHeader onBack={() => setStep('lobby')} />
      </div>
    )
  }

  if (!state) {
    return (
      <div className="h-full bg-surface">
        <MysteryHeader onBack={() => setStep('lobby')} />
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
          onBack={() => setStep('lobby')}
          subtitle={state.streak > 0 ? `🔥 ${state.streak} jour${state.streak > 1 ? 's' : ''} de suite` : 'Devine le membre mystère 🔍'}
        />
      </div>

      <div className="shrink-0 flex flex-wrap items-center gap-x-3 gap-y-1.5 px-4 pt-3 pb-1.5">
        <span className="text-xs font-extrabold text-dark bg-primary/15 border border-primary/40 rounded-full px-3.5 py-1.5">
          Essai {state.attemptsUsed}
        </span>
        <button
          onClick={() => setShowLegend(true)}
          className="h-6 w-6 shrink-0 rounded-full border border-gray-300 bg-white flex items-center justify-center text-gray-500 text-[11px] font-bold active:bg-gray-50"
          aria-label="Comment lire la grille ?"
        >
          i
        </button>
        <div className="flex items-center gap-2.5 text-[10px] font-semibold text-gray-500">
          <LegendDot className="bg-green-500" label="Trouvé" />
          <LegendDot className="bg-amber-300" label="Proche" />
          <LegendDot className="bg-red-400" label="Différent" />
          <LegendDot className="bg-gray-200" label="Non défini" />
        </div>
        {state.maxStreak > 0 && (
          <span className="ml-auto text-xs font-semibold text-gray-400">Record : {state.maxStreak} 🔥</span>
        )}
      </div>

      {!finished && (
        <div className="shrink-0 px-4 pt-1 pb-2 relative">
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
          {suggestions.length > 0 && (
            <div className="absolute inset-x-4 top-full mt-1 bg-white rounded-2xl shadow-lg border border-gray-100 overflow-hidden z-20">
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

      <div className="flex-1 min-h-0 px-4 pb-4">
        <DailyMysteryGrid rows={state.rows} showBranchColumn={state.showBranchColumn} pendingGuess={pendingGuess} />
      </div>

      {finished && (
        <div className="shrink-0 px-4 pb-4 pt-2 space-y-3">
          {state.answer && (
            <div className="rounded-2xl bg-white shadow-sm p-4 flex items-center gap-3">
              <Avatar src={state.answer.profilePictureUrl} name={`${state.answer.firstName} ${state.answer.lastName}`} size="lg" />
              <div className="min-w-0">
                <p className="text-xs font-bold text-gray-400 uppercase tracking-wide">Trouvé !</p>
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
            onClick={() => navigate('/games')}
            className="w-full rounded-xl bg-primary py-3.5 text-sm font-semibold text-white shadow-lg active:bg-primary-dark"
          >
            Retour aux jeux
          </button>

          <p className="text-center text-xs font-semibold text-gray-400">Reviens demain pour un nouveau mystère !</p>
        </div>
      )}

      {/* Réserve fixe : le FAB de la nav déborde au-dessus de la barre, ce padding l'évite. */}
      <div className="shrink-0 h-6" />

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
          <h1 className="text-xl font-black text-white leading-tight truncate">Le Membre Mystère</h1>
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

const STATUS_LABELS = {
  solved: p => `✅ Trouvé en ${p.attemptsUsed} essai${p.attemptsUsed > 1 ? 's' : ''}`,
  inProgress: p => `🕓 Pas encore trouvé (essai ${p.attemptsUsed})`,
}

function TabButton({ active, onClick, children }) {
  return (
    <button
      onClick={onClick}
      className={`flex-1 rounded-xl px-3 py-2.5 text-xs font-semibold transition-colors ${
        active ? 'bg-primary text-white' : 'bg-white text-gray-600 shadow-sm'
      }`}
    >
      {children}
    </button>
  )
}

function CrownedAvatar({ crowned, ...avatarProps }) {
  if (!crowned) return <Avatar {...avatarProps} />
  return (
    <span className="relative inline-block shrink-0">
      <Avatar {...avatarProps} />
      <span className="absolute -top-2.5 -right-1.5 text-sm rotate-12 select-none" aria-hidden="true">👑</span>
    </span>
  )
}

function PointsRow({ e, rank, isMe }) {
  return (
    <div className={`flex items-center gap-3 rounded-2xl px-4 py-3 ${isMe ? 'bg-primary/10 border border-primary/30' : 'bg-white shadow-sm'}`}>
      <span className="w-5 shrink-0 text-center text-sm font-bold text-gray-400">{rank}</span>
      <CrownedAvatar crowned={rank === 1} src={e.profilePictureUrl} name={`${e.firstName} ${e.lastName}`} size="sm" />
      <div className="flex-1 min-w-0">
        <p className="text-sm font-bold text-gray-800 truncate">
          {e.firstName} {e.lastName}{isMe ? ' (toi)' : ''}
        </p>
        <p className="text-xs text-gray-500">
          {e.daysWon > 0 && `🏆 ${e.daysWon} jour${e.daysWon > 1 ? 's' : ''} en 1-2 essais · `}
          {e.daysPlayed} jour{e.daysPlayed > 1 ? 's' : ''} joué{e.daysPlayed > 1 ? 's' : ''}
        </p>
      </div>
      <span className="shrink-0 text-xs font-bold text-primary bg-primary/10 rounded-full px-2.5 py-1">
        {e.totalPoints} pt{e.totalPoints > 1 ? 's' : ''}
      </span>
    </div>
  )
}

function ParticipantRow({ p, isMe }) {
  const isTopTier = p.pointsPreview === TIER1_POINTS

  return (
    <div className={`flex items-center gap-3 rounded-2xl px-4 py-3 ${isMe ? 'bg-primary/10 border border-primary/30' : 'bg-white shadow-sm'}`}>
      <CrownedAvatar crowned={isTopTier} src={p.profilePictureUrl} name={`${p.firstName} ${p.lastName}`} size="sm" />
      <div className="flex-1 min-w-0">
        <p className="text-sm font-bold text-gray-800 truncate">
          {p.firstName} {p.lastName}{isMe ? ' (toi)' : ''}
        </p>
        <p className="text-xs text-gray-500">{(STATUS_LABELS[p.status] ?? STATUS_LABELS.inProgress)(p)}</p>
      </div>
      <div className="shrink-0 flex flex-col items-end gap-1">
        {p.pointsPreview != null && (
          <span
            className={`text-xs font-bold rounded-full px-2.5 py-1 ${
              isTopTier ? 'bg-amber-100 text-amber-700' : 'bg-primary/10 text-primary'
            }`}
          >
            {isTopTier && '🏆 '}+{p.pointsPreview} pt{p.pointsPreview > 1 ? 's' : ''}
          </span>
        )}
        {p.streak > 0 && (
          <span className="text-xs font-bold text-amber-700 bg-amber-100 rounded-full px-2.5 py-1">
            🔥 {p.streak}
          </span>
        )}
      </div>
    </div>
  )
}
