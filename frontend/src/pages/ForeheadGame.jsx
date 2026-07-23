import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'
import { useMembers } from '../store/MembersContext'
import useTiltDetector from '../hooks/useTiltDetector'
import { gamesApi } from '../services/api'
import { PLAYER_COLORS, formatDuration } from '../utils/memoryGame'
import { shuffle } from '../utils/shuffle'
import { THEMES, buildWordPool } from '../utils/foreheadThemes'
import GameHeader from '../components/games/GameHeader'
import Avatar from '../components/shared/Avatar'

const TEAM_COUNT_OPTIONS = [2, 3, 4]
const DURATION_OPTIONS = [30, 45, 60]
const ROUNDS_OPTIONS = [2, 3, 4]

function buildTurnOrder(teams, totalRounds) {
  const order = []
  const pointers = teams.map(() => 0)
  for (let round = 0; round < totalRounds; round++) {
    teams.forEach((team, ti) => {
      if (team.members.length === 0) return
      const player = team.members[pointers[ti] % team.members.length]
      order.push({ teamIndex: ti, player, round: round + 1 })
      pointers[ti] += 1
    })
  }
  return order
}

export default function ForeheadGame() {
  const navigate = useNavigate()
  const { user } = useAuth()
  const { members } = useMembers()
  const tilt = useTiltDetector()

  const [step, setStep] = useState('setup-teams')

  // --- Configuration (équipes, thèmes, manches) ---
  const [teamCount, setTeamCount] = useState(2)
  const [memberTeams, setMemberTeams] = useState(() => (user.memberId ? { [user.memberId]: 0 } : {}))
  const [guests, setGuests] = useState([])
  const [guestInput, setGuestInput] = useState('')
  const guestIdRef = useRef(0)
  const [selectedThemes, setSelectedThemes] = useState(() => [THEMES[0].key])
  const [roundDuration, setRoundDuration] = useState(45)
  const [totalRounds, setTotalRounds] = useState(3)

  // --- Partie en cours ---
  const [teams, setTeams] = useState([])
  const [turnOrder, setTurnOrder] = useState([])
  const [turnIndex, setTurnIndex] = useState(0)
  const [timeLeft, setTimeLeft] = useState(0)
  const [currentWord, setCurrentWord] = useState(null)
  const [turnLog, setTurnLog] = useState([])
  const startTimeRef = useRef(null)
  const wordPoolRef = useRef([])
  const queueRef = useRef([])
  const currentWordRef = useRef(null)
  const timeLeftRef = useRef(0)

  useEffect(() => {
    setMemberTeams(prev => {
      let changed = false
      const next = {}
      for (const [id, idx] of Object.entries(prev)) {
        if (idx < teamCount) next[id] = idx
        else changed = true
      }
      return changed ? next : prev
    })
    setGuests(prev => prev.map(g => (g.teamIndex != null && g.teamIndex >= teamCount) ? { ...g, teamIndex: null } : g))
  }, [teamCount])

  const memberById = id => members.find(m => m.id === id)

  const teamsPreview = Array.from({ length: teamCount }, (_, i) => ({
    index: i,
    label: `Équipe ${i + 1}`,
    color: PLAYER_COLORS[i % PLAYER_COLORS.length],
    members: [
      ...members
        .filter(m => memberTeams[m.id] === i)
        .map(m => ({ name: `${m.firstName} ${m.lastName}`, memberId: m.id, isGuest: false })),
      ...guests
        .filter(g => g.teamIndex === i)
        .map(g => ({ name: g.name, memberId: null, isGuest: true, guestId: g.id })),
    ],
  }))
  const canContinueTeams = teamsPreview.every(t => t.members.length > 0)

  function cycleMemberTeam(id) {
    setMemberTeams(prev => {
      const current = prev[id] ?? null
      const next = current == null ? 0 : (current + 1 >= teamCount ? null : current + 1)
      if (next == null) {
        const { [id]: _removed, ...rest } = prev
        return rest
      }
      return { ...prev, [id]: next }
    })
  }

  function cycleGuestTeam(id) {
    setGuests(prev => prev.map(g => {
      if (g.id !== id) return g
      const current = g.teamIndex
      const next = current == null ? 0 : (current + 1 >= teamCount ? null : current + 1)
      return { ...g, teamIndex: next }
    }))
  }

  function handleAddGuest() {
    const name = guestInput.trim()
    if (!name) return
    guestIdRef.current += 1
    setGuests(prev => [...prev, { id: `guest-${guestIdRef.current}`, name, teamIndex: null }])
    setGuestInput('')
  }

  function removeGuest(id) {
    setGuests(prev => prev.filter(g => g.id !== id))
  }

  function toggleTheme(key) {
    setSelectedThemes(prev => prev.includes(key) ? prev.filter(k => k !== key) : [...prev, key])
  }

  function handleStartGame() {
    const finalTeams = teamsPreview.map(t => ({ ...t, score: 0 }))
    wordPoolRef.current = buildWordPool(selectedThemes)
    setTeams(finalTeams)
    setTurnOrder(buildTurnOrder(finalTeams, totalRounds))
    setTurnIndex(0)
    startTimeRef.current = Date.now()
    setStep('ready')
  }

  async function handleStartTurn() {
    if (tilt.needsPermissionRequest && tilt.permissionState === 'unknown') {
      await tilt.requestPermission()
    }
    setStep('playing')
  }

  function setWord(w) {
    currentWordRef.current = w
    setCurrentWord(w)
  }

  function drawNext(excludeWord) {
    if (queueRef.current.length === 0) {
      const refill = shuffle(wordPoolRef.current)
      if (refill.length > 1 && refill[0] === excludeWord) {
        [refill[0], refill[1]] = [refill[1], refill[0]]
      }
      queueRef.current = refill
    }
    return queueRef.current.shift()
  }

  function handleResult(result) {
    if (timeLeftRef.current <= 0) return
    const wordJustShown = currentWordRef.current
    if (wordJustShown == null) return
    setTurnLog(prev => [...prev, { word: wordJustShown, result }])
    setWord(drawNext(wordJustShown))
  }

  useEffect(() => {
    if (step !== 'playing') return
    timeLeftRef.current = roundDuration
    setTimeLeft(roundDuration)
    setTurnLog([])
    queueRef.current = shuffle(wordPoolRef.current)
    setWord(queueRef.current.shift())
    tilt.start(handleResult)
    return () => tilt.stop()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [step, turnIndex])

  useEffect(() => {
    if (step !== 'playing') return
    const id = setInterval(() => {
      setTimeLeft(t => {
        const next = t - 1
        timeLeftRef.current = next
        if (next <= 0) {
          clearInterval(id)
          tilt.stop()
          setStep('turn-review')
          return 0
        }
        return next
      })
    }, 1000)
    return () => clearInterval(id)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [step, turnIndex])

  function toggleLogResult(i) {
    setTurnLog(prev => prev.map((e, idx) => idx === i ? { ...e, result: e.result === 'correct' ? 'pass' : 'correct' } : e))
  }

  function handleConfirmTurn() {
    const correctCount = turnLog.filter(e => e.result === 'correct').length
    const finishedTeamIndex = turnOrder[turnIndex].teamIndex
    setTeams(prev => prev.map((t, i) => i === finishedTeamIndex ? { ...t, score: t.score + correctCount } : t))
    if (turnIndex + 1 >= turnOrder.length) {
      setStep('results')
    } else {
      setTurnIndex(i => i + 1)
      setStep('ready')
    }
  }

  function handleExit() {
    navigate('/games')
  }

  if (step === 'setup-teams') {
    return (
      <div className="overflow-y-auto h-full bg-gray-50 pb-24">
        <GameHeader title="Sur le Front" onBack={handleExit} />
        <div className="px-4 mt-5 pb-4 space-y-6">
          <OptionPicker label="Nombre d'équipes" options={TEAM_COUNT_OPTIONS} value={teamCount} onChange={setTeamCount} />

          <div>
            <h2 className="text-xs font-bold text-gray-400 uppercase tracking-wide mb-2.5">Membres — tape pour assigner une équipe</h2>
            <div className="flex flex-wrap gap-2">
              {members.map(m => {
                const teamIndex = memberTeams[m.id] ?? null
                const color = teamIndex != null ? PLAYER_COLORS[teamIndex % PLAYER_COLORS.length] : null
                return (
                  <MemberTeamChip key={m.id} member={m} teamIndex={teamIndex} color={color} onTap={() => cycleMemberTeam(m.id)} />
                )
              })}
            </div>
          </div>

          <div>
            <h2 className="text-xs font-bold text-gray-400 uppercase tracking-wide mb-2.5">Invités</h2>
            <div className="flex items-center gap-2 mb-2.5">
              <input
                value={guestInput}
                onChange={e => setGuestInput(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && handleAddGuest()}
                placeholder="Nom de l'invité·e"
                className="flex-1 min-w-0 rounded-xl border border-gray-200 bg-white px-3.5 py-2.5 text-sm font-semibold focus:outline-none focus:border-primary"
              />
              <button onClick={handleAddGuest} className="shrink-0 rounded-xl bg-primary px-4 py-2.5 text-sm font-bold text-white active:bg-primary-dark">
                Ajouter
              </button>
            </div>
            {guests.length > 0 && (
              <div className="flex flex-wrap gap-2">
                {guests.map(g => {
                  const color = g.teamIndex != null ? PLAYER_COLORS[g.teamIndex % PLAYER_COLORS.length] : null
                  return (
                    <GuestTeamChip key={g.id} guest={g} teamIndex={g.teamIndex} color={color} onTap={() => cycleGuestTeam(g.id)} onRemove={() => removeGuest(g.id)} />
                  )
                })}
              </div>
            )}
          </div>

          <div className="space-y-2.5">
            {teamsPreview.map(t => <TeamPreviewCard key={t.index} team={t} />)}
          </div>

          <button
            onClick={() => setStep('setup-themes')}
            disabled={!canContinueTeams}
            className="w-full rounded-2xl bg-dark py-4 text-base font-black text-white shadow-lg shadow-dark/30 active:opacity-90 disabled:opacity-40"
          >
            {canContinueTeams ? 'Continuer' : 'Chaque équipe doit avoir au moins un joueur'}
          </button>
        </div>
      </div>
    )
  }

  if (step === 'setup-themes') {
    return (
      <div className="overflow-y-auto h-full bg-gray-50 pb-24">
        <GameHeader title="Sur le Front" subtitle="Choisis les thèmes" onBack={() => setStep('setup-teams')} />
        <div className="px-4 mt-5 pb-4 space-y-6">
          <div className="grid grid-cols-2 gap-3">
            {THEMES.map(theme => {
              const selected = selectedThemes.includes(theme.key)
              return (
                <button
                  key={theme.key}
                  onClick={() => toggleTheme(theme.key)}
                  className={`rounded-2xl p-4 text-center transition-all ${selected ? 'bg-primary shadow-lg shadow-primary/30 scale-[1.03]' : 'bg-white shadow-sm'}`}
                >
                  <div className="text-2xl">{theme.emoji}</div>
                  <p className={`mt-1.5 font-extrabold text-sm ${selected ? 'text-white' : 'text-gray-800'}`}>{theme.label}</p>
                  <p className={`mt-0.5 text-[11px] font-bold ${selected ? 'text-white/75' : 'text-gray-400'}`}>{theme.words.length} mots</p>
                </button>
              )
            })}
          </div>

          <button
            onClick={() => setStep('setup-rounds')}
            disabled={selectedThemes.length === 0}
            className="w-full rounded-2xl bg-dark py-4 text-base font-black text-white shadow-lg shadow-dark/30 active:opacity-90 disabled:opacity-40"
          >
            {selectedThemes.length === 0 ? 'Choisis au moins un thème' : 'Continuer'}
          </button>
        </div>
      </div>
    )
  }

  if (step === 'setup-rounds') {
    return (
      <div className="overflow-y-auto h-full bg-gray-50 pb-24">
        <GameHeader title="Sur le Front" subtitle="Réglages" onBack={() => setStep('setup-themes')} />
        <div className="px-4 mt-5 pb-4 space-y-6">
          <OptionPicker label="Durée par joueur" options={DURATION_OPTIONS} value={roundDuration} onChange={setRoundDuration} formatLabel={s => `${s}s`} />
          <OptionPicker label="Nombre de manches" options={ROUNDS_OPTIONS} value={totalRounds} onChange={setTotalRounds} />

          <p className="text-xs text-gray-400 text-center">
            {teamCount} équipes · {totalRounds} manches · {teamCount * totalRounds} tours au total
          </p>

          <button
            onClick={handleStartGame}
            className="w-full rounded-2xl bg-dark py-4 text-base font-black text-white shadow-lg shadow-dark/30 active:opacity-90"
          >
            C'est parti !
          </button>
        </div>
      </div>
    )
  }

  if (step === 'ready') {
    const currentTurn = turnOrder[turnIndex]
    const currentTeam = teams[currentTurn.teamIndex]
    const manche = Math.floor(turnIndex / teamCount) + 1
    const player = currentTurn.player

    return (
      <div className="h-full flex flex-col bg-gray-50">
        <GameHeader title="Sur le Front" subtitle={`Manche ${manche}/${totalRounds}`} onBack={handleExit} />
        <div className="flex-1 flex flex-col items-center justify-center px-6 text-center">
          <Avatar member={player.memberId ? memberById(player.memberId) : null} name={player.name} size="lg" className="mb-3" />
          <span className={`text-[11px] font-bold uppercase tracking-wide rounded-full px-3 py-1 mb-2 ${currentTeam.color.text} bg-gray-100`}>
            {currentTeam.label}
          </span>
          <p className="text-2xl font-black text-gray-800 mb-4">{player.name}</p>
          <p className="text-sm text-gray-500 max-w-xs mb-1">
            Pose le téléphone sur ton front, écran face à ton équipe.
          </p>
          <p className="text-sm text-gray-500 max-w-xs mb-8">
            Baisse la tête pour valider ✅, relève-la pour passer ⏭️.
          </p>
          {tilt.supported === false && (
            <p className="text-xs text-amber-600 max-w-xs mb-4">
              Capteur non détecté sur cet appareil — utilise les boutons ✅ / ⏭️ pendant la manche.
            </p>
          )}
          <button
            onClick={handleStartTurn}
            className="w-full max-w-xs rounded-2xl bg-primary py-4 text-sm font-bold text-white shadow-lg active:bg-primary-dark"
          >
            Je suis prêt·e !
          </button>
        </div>
      </div>
    )
  }

  if (step === 'playing') {
    const currentTurn = turnOrder[turnIndex]
    const currentTeam = teams[currentTurn.teamIndex]
    const correctCount = turnLog.filter(e => e.result === 'correct').length

    return (
      <div className="h-full flex flex-col bg-gray-50">
        <GameHeader title={currentTeam.label} subtitle={`${correctCount} trouvé${correctCount > 1 ? 's' : ''}`} onBack={handleExit} />
        <div className="flex-1 flex flex-col items-center justify-center px-6 text-center">
          <p className={`text-4xl font-black mb-8 ${timeLeft <= 10 ? 'text-red-500' : 'text-gray-800'}`}>{timeLeft}s</p>
          <div className="w-full max-w-xs rounded-3xl bg-white shadow-lg p-8 mb-10">
            <p className="text-3xl font-black text-gray-800">{currentWord}</p>
          </div>
          <div className="w-full max-w-xs flex gap-3">
            <button
              onClick={() => handleResult('pass')}
              className="flex-1 rounded-2xl bg-white shadow-sm py-5 text-2xl active:bg-gray-100"
            >
              ⏭️
            </button>
            <button
              onClick={() => handleResult('correct')}
              className="flex-1 rounded-2xl bg-primary shadow-lg shadow-primary/30 py-5 text-2xl active:bg-primary-dark"
            >
              ✅
            </button>
          </div>
        </div>
      </div>
    )
  }

  if (step === 'turn-review') {
    const currentTurn = turnOrder[turnIndex]
    const currentTeam = teams[currentTurn.teamIndex]
    const correctCount = turnLog.filter(e => e.result === 'correct').length

    return (
      <div className="overflow-y-auto h-full bg-gray-50 pb-24">
        <GameHeader title="Récap du tour" subtitle={currentTeam.label} onBack={handleExit} />
        <div className="px-4 mt-5 pb-4 space-y-6">
          <p className="text-xs text-gray-400">Tape sur un mot pour corriger le résultat si le capteur s'est trompé.</p>
          <div className="rounded-2xl bg-white shadow-sm divide-y divide-gray-50 overflow-hidden">
            {turnLog.length === 0 && (
              <p className="px-4 py-4 text-sm text-gray-400 text-center">Aucun mot proposé pendant ce tour.</p>
            )}
            {turnLog.map((entry, i) => (
              <button
                key={i}
                onClick={() => toggleLogResult(i)}
                className="w-full flex items-center justify-between px-4 py-3 active:bg-gray-50"
              >
                <span className="text-sm font-semibold text-gray-800">{entry.word}</span>
                <span className={`text-xs font-bold rounded-full px-2.5 py-1 ${entry.result === 'correct' ? 'bg-primary/10 text-primary' : 'bg-gray-100 text-gray-500'}`}>
                  {entry.result === 'correct' ? '✅ Trouvé' : '⏭️ Passé'}
                </span>
              </button>
            ))}
          </div>

          <button
            onClick={handleConfirmTurn}
            className="w-full rounded-2xl bg-dark py-4 text-base font-black text-white shadow-lg shadow-dark/30 active:opacity-90"
          >
            Valider · {correctCount} pt{correctCount > 1 ? 's' : ''}
          </button>
        </div>
      </div>
    )
  }

  // step === 'results'
  return (
    <ForeheadResultsScreen
      teams={teams}
      totalRounds={totalRounds}
      durationSeconds={startTimeRef.current ? Math.floor((Date.now() - startTimeRef.current) / 1000) : null}
      onReplay={() => setStep('setup-teams')}
      onExit={handleExit}
    />
  )
}

function OptionPicker({ label, options, value, onChange, formatLabel = String }) {
  return (
    <div>
      <h2 className="text-xs font-bold text-gray-400 uppercase tracking-wide mb-2.5">{label}</h2>
      <div className="flex gap-2.5">
        {options.map(opt => (
          <button
            key={opt}
            onClick={() => onChange(opt)}
            className={`flex-1 rounded-2xl py-3 text-sm font-black transition-colors ${
              value === opt ? 'bg-primary text-white shadow-md shadow-primary/30' : 'bg-white text-gray-600 shadow-sm'
            }`}
          >
            {formatLabel(opt)}
          </button>
        ))}
      </div>
    </div>
  )
}

function MemberTeamChip({ member, teamIndex, color, onTap }) {
  return (
    <button
      type="button"
      onClick={onTap}
      className={`flex items-center gap-2 rounded-2xl px-2.5 py-2 border-2 transition-colors ${
        teamIndex != null ? `${color.border} bg-white` : 'border-transparent bg-white shadow-sm'
      }`}
    >
      <Avatar member={member} size="xs" className={teamIndex != null ? `ring-2 ${color.ring}` : ''} />
      <span className="text-xs font-semibold text-gray-700 truncate max-w-[80px]">{member.firstName}</span>
      <span className={`text-[10px] font-bold ${teamIndex != null ? color.text : 'text-gray-300'}`}>
        {teamIndex != null ? `É${teamIndex + 1}` : '—'}
      </span>
    </button>
  )
}

function GuestTeamChip({ guest, teamIndex, color, onTap, onRemove }) {
  return (
    <div className={`flex items-center gap-1.5 rounded-2xl pl-2.5 pr-1.5 py-2 border-2 transition-colors ${
      teamIndex != null ? `${color.border} bg-white` : 'border-transparent bg-white shadow-sm'
    }`}>
      <button type="button" onClick={onTap} className="flex items-center gap-2 min-w-0">
        <Avatar name={guest.name} size="xs" className={teamIndex != null ? `ring-2 ${color.ring}` : ''} />
        <span className="text-xs font-semibold text-gray-700 truncate max-w-[80px]">{guest.name}</span>
        <span className={`text-[10px] font-bold shrink-0 ${teamIndex != null ? color.text : 'text-gray-300'}`}>
          {teamIndex != null ? `É${teamIndex + 1}` : '—'}
        </span>
      </button>
      <button type="button" onClick={onRemove} className="shrink-0 h-5 w-5 rounded-full bg-gray-100 text-gray-400 text-xs flex items-center justify-center active:bg-gray-200">
        ×
      </button>
    </div>
  )
}

function TeamPreviewCard({ team }) {
  return (
    <div className="rounded-2xl bg-white shadow-sm p-3">
      <p className={`text-xs font-extrabold uppercase tracking-wide mb-2 ${team.color.text}`}>{team.label} ({team.members.length})</p>
      {team.members.length === 0 ? (
        <p className="text-xs text-gray-400">Aucun membre — tape sur un membre ou un invité ci-dessus pour l'ajouter</p>
      ) : (
        <div className="flex flex-wrap gap-1.5">
          {team.members.map((m, i) => (
            <div key={m.memberId ?? m.guestId ?? i} className="flex items-center gap-1 bg-gray-50 rounded-full pl-1 pr-2 py-1">
              <Avatar name={m.name} size="xs" />
              <span className="text-[11px] font-semibold text-gray-600 truncate max-w-[70px]">{m.name.split(' ')[0]}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

function ForeheadResultsScreen({ teams, totalRounds, durationSeconds, onReplay, onExit }) {
  const submitted = useRef(false)
  const ranked = [...teams].sort((a, b) => b.score - a.score)
  const topScore = ranked[0]?.score ?? 0
  const winners = ranked.filter(t => t.score === topScore)
  const winnerTeam = winners.length === 1 ? winners[0] : null

  useEffect(() => {
    if (submitted.current) return
    submitted.current = true
    gamesApi.submitResult({
      gameType: 'surlefront',
      pairsCount: totalRounds,
      players: teams.flatMap(t => t.members.map(m => ({ name: m.name, score: t.score, memberId: m.memberId ?? null, isGuest: !!m.isGuest }))),
      winnerName: winnerTeam?.label ?? null,
      durationSeconds,
    }).catch(() => {})
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return (
    <div className="overflow-y-auto h-full bg-gray-50 pb-24">
      <div className="bg-dark px-5 pt-8 pb-9 text-center rounded-b-[32px]">
        <p className="text-3xl">{winnerTeam ? '🏆' : '🤝'}</p>
        <h2 className="text-xl font-black text-white mt-1.5">
          {winnerTeam ? `${winnerTeam.label} gagne !` : 'Égalité !'}
        </h2>
        <p className="text-xs font-semibold text-white/70 mt-1">
          Sur le Front · {totalRounds} manches{durationSeconds != null ? ` · ${formatDuration(durationSeconds)}` : ''}
        </p>
      </div>

      <div className="px-4 -mt-5 grid grid-cols-2 gap-3">
        {ranked.map(t => (
          <TeamResultCard key={t.index} label={t.label} color={t.color} score={t.score} roster={t.members} winner={winnerTeam?.index === t.index} />
        ))}
      </div>

      <div className="px-4 mt-6 flex gap-2.5">
        <button onClick={onReplay} className="flex-1 rounded-2xl bg-primary py-3.5 text-sm font-bold text-white active:bg-primary-dark">
          Rejouer
        </button>
        <button onClick={onExit} className="flex-1 rounded-2xl bg-white shadow-sm py-3.5 text-sm font-bold text-gray-600 active:bg-gray-50">
          Quitter
        </button>
      </div>
    </div>
  )
}

function TeamResultCard({ label, color, score, roster, winner }) {
  return (
    <div className={`rounded-2xl bg-white shadow-sm p-4 ${winner ? 'ring-2 ring-primary' : ''}`}>
      <p className={`text-xs font-extrabold uppercase tracking-wide ${color?.text ?? 'text-gray-400'}`}>{label} {winner && '🏆'}</p>
      <p className="text-2xl font-black text-primary mt-1">{score}</p>
      <div className="flex flex-wrap gap-1 mt-2">
        {roster.map((p, i) => <Avatar key={p.memberId ?? p.guestId ?? i} name={p.name} size="xs" />)}
      </div>
    </div>
  )
}
