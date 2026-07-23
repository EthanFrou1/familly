import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'
import { useMembers } from '../store/MembersContext'
import { useUiChrome } from '../store/UiChromeContext'
import useTiltDetector from '../hooks/useTiltDetector'
import { gamesApi } from '../services/api'
import { matchesSearch } from '../utils/normalize'
import { PLAYER_COLORS, formatDuration } from '../utils/memoryGame'
import { shuffle } from '../utils/shuffle'
import { THEMES, buildWordPool } from '../utils/foreheadThemes'
import GameHeader from '../components/games/GameHeader'
import Avatar from '../components/shared/Avatar'

const TEAM_COUNT_OPTIONS = [2, 3, 4]
const DURATION_OPTIONS = [30, 45, 60]
const ROUNDS_OPTIONS = [2, 3, 4]
const IN_ROUND_STEPS = ['ready', 'countdown', 'playing', 'turn-review']
const MIN_PER_TEAM = 1
const MAX_PER_TEAM = 8
const COUNTDOWN_SECONDS = 5

function lockLandscape() {
  return screen.orientation?.lock?.('landscape').catch(() => {})
}

function unlockOrientation() {
  try { screen.orientation?.unlock?.() } catch { /* pas supporté (iOS...) */ }
}

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
  const { setHideChrome } = useUiChrome()
  const tilt = useTiltDetector()

  const [step, setStep] = useState('setup-teams')

  // --- Configuration (équipes, thèmes, manches) ---
  const [teamCount, setTeamCount] = useState(2)
  const [teamsSlots, setTeamsSlots] = useState(() => [
    [{ mode: 'member', search: `${user.firstName} ${user.lastName}`, memberId: user.memberId }],
    [{ mode: 'guest', search: '', memberId: null }],
  ])
  const [selectedThemeIndex, setSelectedThemeIndex] = useState(0)
  const [roundDuration, setRoundDuration] = useState(45)
  const [totalRounds, setTotalRounds] = useState(3)

  // --- Partie en cours ---
  const [teams, setTeams] = useState([])
  const [turnOrder, setTurnOrder] = useState([])
  const [turnIndex, setTurnIndex] = useState(0)
  const [countdownValue, setCountdownValue] = useState(COUNTDOWN_SECONDS)
  const [timeLeft, setTimeLeft] = useState(0)
  const [currentWord, setCurrentWord] = useState(null)
  const [turnLog, setTurnLog] = useState([])
  const [paused, setPaused] = useState(false)
  const [flash, setFlash] = useState(null)
  const startTimeRef = useRef(null)
  const wordPoolRef = useRef([])
  const queueRef = useRef([])
  const currentWordRef = useRef(null)
  const timeLeftRef = useRef(0)
  const flashTimeoutRef = useRef(null)

  useEffect(() => {
    setTeamsSlots(prev => {
      if (prev.length === teamCount) return prev
      if (prev.length < teamCount) {
        const additions = Array.from({ length: teamCount - prev.length }, () => [{ mode: 'guest', search: '', memberId: null }])
        return [...prev, ...additions]
      }
      return prev.slice(0, teamCount)
    })
  }, [teamCount])

  useEffect(() => {
    setHideChrome(IN_ROUND_STEPS.includes(step))
    return () => setHideChrome(false)
  }, [step, setHideChrome])

  const memberById = id => members.find(m => m.id === id)

  function addSlot(teamIndex) {
    setTeamsSlots(prev => prev.map((slots, ti) => (ti === teamIndex && slots.length < MAX_PER_TEAM)
      ? [...slots, { mode: 'guest', search: '', memberId: null }]
      : slots))
  }

  function removeSlot(teamIndex) {
    setTeamsSlots(prev => prev.map((slots, ti) => (ti === teamIndex && slots.length > MIN_PER_TEAM)
      ? slots.slice(0, -1)
      : slots))
  }

  function updateSlot(teamIndex, slotIndex, patch) {
    setTeamsSlots(prev => prev.map((slots, ti) => ti !== teamIndex ? slots : slots.map((s, si) => si === slotIndex ? { ...s, ...patch } : s)))
  }

  // Un membre déjà lié dans une équipe ne doit pas pouvoir être lié une seconde fois ailleurs.
  function candidatesFor(teamIndex, slotIndex) {
    const usedIds = new Set()
    teamsSlots.forEach((slots, ti) => slots.forEach((s, si) => {
      if (ti === teamIndex && si === slotIndex) return
      if (s.mode === 'member' && s.memberId) usedIds.add(s.memberId)
    }))
    return members.filter(m => !usedIds.has(m.id))
  }

  function buildFinalTeams() {
    return teamsSlots.map((slots, i) => ({
      index: i,
      label: `Équipe ${i + 1}`,
      color: PLAYER_COLORS[i % PLAYER_COLORS.length],
      score: 0,
      members: slots.map((slot, si) => {
        if (slot.mode === 'member' && slot.memberId) {
          const m = memberById(slot.memberId)
          return { name: `${m.firstName} ${m.lastName}`, memberId: m.id, isGuest: false }
        }
        return { name: slot.search.trim() || `Joueur ${si + 1}`, memberId: null, isGuest: true }
      }),
    }))
  }

  function handleStartGame() {
    const finalTeams = buildFinalTeams()
    wordPoolRef.current = buildWordPool([THEMES[selectedThemeIndex].key])
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
    await lockLandscape()
    setStep('countdown')
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
    if (paused || timeLeftRef.current <= 0) return
    const wordJustShown = currentWordRef.current
    if (wordJustShown == null) return
    setTurnLog(prev => [...prev, { word: wordJustShown, result }])
    setWord(drawNext(wordJustShown))
    setFlash(result)
    if (flashTimeoutRef.current) clearTimeout(flashTimeoutRef.current)
    flashTimeoutRef.current = setTimeout(() => setFlash(null), 350)
  }

  useEffect(() => {
    if (step !== 'countdown') return
    setCountdownValue(COUNTDOWN_SECONDS)
    const id = setInterval(() => {
      setCountdownValue(v => {
        if (v <= 1) {
          clearInterval(id)
          setStep('playing')
          return 0
        }
        return v - 1
      })
    }, 1000)
    return () => clearInterval(id)
  }, [step, turnIndex])

  // Prépare le mot et le chrono une seule fois à l'entrée fraîche dans le tour.
  useEffect(() => {
    if (step !== 'playing') return
    setPaused(false)
    timeLeftRef.current = roundDuration
    setTimeLeft(roundDuration)
    setTurnLog([])
    queueRef.current = shuffle(wordPoolRef.current)
    setWord(queueRef.current.shift())
    return () => { if (flashTimeoutRef.current) clearTimeout(flashTimeoutRef.current) }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [step, turnIndex])

  // Capteur actif seulement hors pause : se recalibre naturellement à la reprise.
  useEffect(() => {
    if (step !== 'playing' || paused) return
    tilt.start(handleResult)
    return () => tilt.stop()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [step, turnIndex, paused])

  useEffect(() => {
    if (step !== 'playing' || paused) return
    const id = setInterval(() => {
      setTimeLeft(t => {
        const next = t - 1
        timeLeftRef.current = next
        if (next <= 0) {
          clearInterval(id)
          tilt.stop()
          unlockOrientation()
          setStep('turn-review')
          return 0
        }
        return next
      })
    }, 1000)
    return () => clearInterval(id)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [step, turnIndex, paused])

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
    unlockOrientation()
    navigate('/games')
  }

  if (step === 'setup-teams') {
    return (
      <div className="overflow-y-auto h-full bg-gray-50 pb-24">
        <GameHeader title="Sur le Front" onBack={handleExit} />
        <div className="px-4 mt-5 pb-4 space-y-6">
          <OptionPicker label="Nombre d'équipes" options={TEAM_COUNT_OPTIONS} value={teamCount} onChange={setTeamCount} />

          <div className="space-y-5">
            {teamsSlots.map((slots, ti) => {
              const color = PLAYER_COLORS[ti % PLAYER_COLORS.length]
              return (
                <div key={ti}>
                  <div className="flex items-center justify-between mb-2.5">
                    <h2 className={`text-xs font-extrabold uppercase tracking-wide ${color.text}`}>
                      Équipe {ti + 1} ({slots.length})
                    </h2>
                    <div className="flex gap-1.5">
                      <button onClick={() => removeSlot(ti)} disabled={slots.length <= MIN_PER_TEAM} className="h-7 w-7 rounded-full bg-white shadow-sm text-gray-500 font-black disabled:opacity-30">−</button>
                      <button onClick={() => addSlot(ti)} disabled={slots.length >= MAX_PER_TEAM} className="h-7 w-7 rounded-full bg-white shadow-sm text-gray-500 font-black disabled:opacity-30">+</button>
                    </div>
                  </div>
                  <div className="space-y-2.5">
                    {slots.map((slot, si) => (
                      <ForeheadPlayerSlot
                        key={si}
                        index={si}
                        isSelf={ti === 0 && si === 0}
                        slot={slot}
                        member={slot.memberId ? memberById(slot.memberId) : null}
                        candidates={candidatesFor(ti, si)}
                        color={color}
                        onChange={patch => updateSlot(ti, si, patch)}
                      />
                    ))}
                  </div>
                </div>
              )
            })}
          </div>

          <button
            onClick={() => setStep('setup-themes')}
            className="w-full rounded-2xl bg-dark py-4 text-base font-black text-white shadow-lg shadow-dark/30 active:opacity-90"
          >
            Continuer
          </button>
        </div>
      </div>
    )
  }

  if (step === 'setup-themes') {
    return (
      <div className="h-full flex flex-col bg-gray-50">
        <GameHeader title="Sur le Front" subtitle="Choisis un thème" onBack={() => setStep('setup-teams')} />
        <div className="flex-1 flex flex-col justify-center overflow-hidden py-6">
          <ThemeCarousel themes={THEMES} index={selectedThemeIndex} onChange={setSelectedThemeIndex} />
        </div>
        <div className="px-4 pb-4">
          <button
            onClick={() => setStep('setup-rounds')}
            className="w-full rounded-2xl bg-dark py-4 text-base font-black text-white shadow-lg shadow-dark/30 active:opacity-90"
          >
            Continuer
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
        <div className="flex-1 overflow-y-auto flex flex-col items-center justify-center px-6 landscape:px-10 py-4 text-center">
          <Avatar member={player.memberId ? memberById(player.memberId) : null} name={player.name} size="lg" className="mb-3 landscape:mb-2 landscape:h-14 landscape:w-14" />
          <span className={`text-[11px] font-bold uppercase tracking-wide rounded-full px-3 py-1 mb-2 ${currentTeam.color.text} bg-gray-100`}>
            {currentTeam.label}
          </span>
          <p className="text-2xl landscape:text-xl font-black text-gray-800 mb-4 landscape:mb-2">{player.name}</p>
          <p className="text-sm text-gray-500 max-w-xs landscape:max-w-sm mb-1">
            📱 Tourne le téléphone à l'horizontale et pose-le sur ton front, écran face à ton équipe.
          </p>
          <p className="text-sm text-gray-500 max-w-xs landscape:max-w-sm mb-8 landscape:mb-4">
            Baisse la tête pour valider ✅, relève-la pour passer ⏭️.
          </p>
          {tilt.supported === false && (
            <p className="text-xs text-amber-600 max-w-xs landscape:max-w-sm mb-4 landscape:mb-2">
              Capteur non détecté sur cet appareil — utilise les boutons ✅ / ⏭️ pendant la manche.
            </p>
          )}
          <button
            onClick={handleStartTurn}
            className="w-full max-w-xs landscape:max-w-sm rounded-2xl bg-primary py-4 landscape:py-3 text-sm font-bold text-white shadow-lg active:bg-primary-dark"
          >
            Je suis prêt·e !
          </button>
        </div>
      </div>
    )
  }

  if (step === 'countdown') {
    const currentTurn = turnOrder[turnIndex]
    const currentTeam = teams[currentTurn.teamIndex]

    return (
      <div className="h-full flex flex-col bg-gray-50">
        <GameHeader title={currentTeam.label} onBack={handleExit} />
        <div className="flex-1 flex flex-col items-center justify-center">
          <p key={countdownValue} className="text-8xl font-black text-primary animate-[ping_0.5s_ease-out_1]">{countdownValue}</p>
          <p className="text-sm text-gray-400 mt-4">Prépare-toi...</p>
        </div>
      </div>
    )
  }

  if (step === 'playing') {
    const currentTurn = turnOrder[turnIndex]
    const currentTeam = teams[currentTurn.teamIndex]
    const correctCount = turnLog.filter(e => e.result === 'correct').length
    const bgClass = flash === 'correct' ? 'bg-green-400' : flash === 'pass' ? 'bg-red-400' : 'bg-gray-50'

    return (
      <div className={`h-full flex flex-col transition-colors duration-300 ${bgClass}`}>
        <div className="pt-8 landscape:pt-3 pb-1 flex items-center justify-center shrink-0 safe-top">
          <button
            onClick={() => setPaused(true)}
            className="flex items-center gap-1.5 rounded-full bg-black/10 px-4 py-2.5 active:bg-black/20"
          >
            <span className="h-1.5 w-1.5 rounded-full bg-gray-600" />
            <span className="h-1.5 w-1.5 rounded-full bg-gray-600" />
            <span className="h-1.5 w-1.5 rounded-full bg-gray-600" />
          </button>
        </div>
        <div className="flex-1 flex flex-col items-center justify-center px-6 landscape:px-10 text-center">
          <p className={`text-4xl landscape:text-2xl font-black mb-8 landscape:mb-2 ${timeLeft <= 10 ? 'text-red-500' : 'text-gray-800'}`}>{timeLeft}s</p>
          <div className="w-full max-w-xs landscape:max-w-md rounded-3xl bg-white shadow-lg p-8 landscape:p-4 mb-10 landscape:mb-4">
            <p className="text-3xl landscape:text-4xl font-black text-gray-800">{currentWord}</p>
          </div>
          <div className="w-full max-w-xs landscape:max-w-md flex gap-3">
            <button
              onClick={() => handleResult('pass')}
              className="flex-1 rounded-2xl bg-white shadow-sm py-5 landscape:py-3 text-2xl active:bg-gray-100"
            >
              ⏭️
            </button>
            <button
              onClick={() => handleResult('correct')}
              className="flex-1 rounded-2xl bg-primary shadow-lg shadow-primary/30 py-5 landscape:py-3 text-2xl active:bg-primary-dark"
            >
              ✅
            </button>
          </div>
        </div>

        {paused && (
          <div className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-dark/95 px-6 text-center">
            <p className="text-4xl mb-3">⏸️</p>
            <h2 className="text-xl font-black text-white mb-1">Pause</h2>
            <p className="text-sm text-white/60 mb-8">{currentTeam.label} · {timeLeft}s restantes</p>
            <button
              onClick={() => setPaused(false)}
              className="w-full max-w-xs rounded-2xl bg-primary py-4 text-sm font-bold text-white shadow-lg active:bg-primary-dark mb-3"
            >
              Reprendre
            </button>
            <button onClick={handleExit} className="w-full max-w-xs rounded-2xl bg-white/10 py-4 text-sm font-bold text-white active:bg-white/20">
              Abandonner la partie
            </button>
          </div>
        )}
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

const CAROUSEL_CARD_WIDTH = 200
const CAROUSEL_GAP = 20
const CAROUSEL_STEP = CAROUSEL_CARD_WIDTH + CAROUSEL_GAP

// Carrousel "roue" : la carte au centre est nette et à taille pleine, celles sur les côtés
// sont visibles en aperçu, réduites et estompées selon leur distance au centre. `progress`
// suit le scroll en continu (pas juste l'index arrondi) pour un effet fluide pendant le drag.
function ThemeCarousel({ themes, index, onChange }) {
  const scrollRef = useRef(null)
  const settleTimeoutRef = useRef(null)
  const [progress, setProgress] = useState(index)

  useEffect(() => {
    const el = scrollRef.current
    if (!el) return
    el.scrollTo({ left: index * CAROUSEL_STEP, behavior: 'auto' })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  function handleScroll() {
    const el = scrollRef.current
    if (!el) return
    setProgress(el.scrollLeft / CAROUSEL_STEP)

    if (settleTimeoutRef.current) clearTimeout(settleTimeoutRef.current)
    settleTimeoutRef.current = setTimeout(() => {
      const nearest = Math.max(0, Math.min(themes.length - 1, Math.round(el.scrollLeft / CAROUSEL_STEP)))
      onChange(nearest)
    }, 120)
  }

  function scrollToIndex(i) {
    scrollRef.current?.scrollTo({ left: i * CAROUSEL_STEP, behavior: 'smooth' })
  }

  const sidePadding = `calc(50% - ${CAROUSEL_CARD_WIDTH / 2}px)`
  // Suit `progress` (continu) plutôt que `index` (mis à jour avec un debounce de 120ms après
  // l'arrêt du scroll) pour que les points bougent en même temps que les cartes, pas après coup.
  const liveIndex = Math.max(0, Math.min(themes.length - 1, Math.round(progress)))

  return (
    <div>
      <div
        ref={scrollRef}
        onScroll={handleScroll}
        className="flex overflow-x-auto snap-x snap-mandatory scrollbar-none select-none"
        style={{ scrollPaddingLeft: sidePadding, scrollPaddingRight: sidePadding }}
      >
        <div style={{ flex: `0 0 ${sidePadding}` }} />
        {themes.map((theme, i) => {
          const distance = Math.abs(progress - i)
          const scale = Math.max(0.75, 1 - distance * 0.25)
          const opacity = Math.max(0.35, 1 - distance * 0.55)
          return (
            <button
              key={theme.key}
              onClick={() => scrollToIndex(i)}
              style={{ flex: `0 0 ${CAROUSEL_CARD_WIDTH}px`, marginRight: CAROUSEL_GAP, transform: `scale(${scale})`, opacity, scrollSnapAlign: 'center' }}
              className="shrink-0 rounded-3xl bg-white shadow-xl p-6 text-center"
            >
              <div className="text-5xl mb-3">{theme.emoji}</div>
              <p className="font-extrabold text-gray-800">{theme.label}</p>
              <p className="text-xs text-gray-400 mt-1">{theme.words.length} mots</p>
            </button>
          )
        })}
        <div style={{ flex: `0 0 ${sidePadding}` }} />
      </div>

      <div className="flex justify-center gap-1.5 mt-5">
        {themes.map((theme, i) => (
          <div
            key={theme.key}
            className={`h-1.5 rounded-full transition-all ${i === liveIndex ? 'w-4 bg-primary' : 'w-1.5 bg-gray-300'}`}
          />
        ))}
      </div>
    </div>
  )
}

function ForeheadPlayerSlot({ index, isSelf, slot, member, candidates, color, onChange }) {
  const linked = isSelf || (slot.mode === 'member' && !!slot.memberId)
  const searching = !isSelf && slot.mode === 'member' && !slot.memberId

  const filtered = searching && slot.search.trim()
    ? candidates.filter(m => matchesSearch(`${m.firstName} ${m.lastName}`, slot.search))
    : []

  function toggleLink() {
    if (linked) onChange({ mode: 'guest', memberId: null, search: '' })
    else if (searching) onChange({ mode: 'guest' })
    else onChange({ mode: 'member', memberId: null, search: '' })
  }

  return (
    <div className="space-y-1.5">
      <div className={`flex items-center gap-3 bg-white rounded-2xl shadow-sm py-2.5 pl-2.5 pr-3 border-l-4 ${linked ? color.border : 'border-gray-200'}`}>
        <Avatar member={member} name={slot.search} size="sm" className={linked ? `ring-2 ${color.ring}` : ''} />
        <div className="flex-1 min-w-0">
          {linked ? (
            <p className="font-bold text-sm text-gray-800 truncate">{slot.search}</p>
          ) : (
            <input
              value={slot.search}
              onChange={e => onChange({ search: e.target.value, memberId: null })}
              placeholder={`Joueur ${index + 1} — nom libre`}
              className="w-full bg-transparent text-sm font-semibold text-gray-800 focus:outline-none placeholder:font-medium placeholder:text-gray-400"
            />
          )}
        </div>
        {isSelf ? (
          <span className="shrink-0 text-[11px] font-bold text-gray-400 bg-gray-100 rounded-full px-3 py-1.5">Vous</span>
        ) : linked ? (
          <button type="button" onClick={toggleLink} className="shrink-0 text-[11px] font-bold text-primary bg-primary/10 rounded-full px-3 py-1.5 active:bg-primary/20">
            Lié ✓
          </button>
        ) : (
          <button
            type="button"
            onClick={toggleLink}
            className={`shrink-0 text-[11px] font-bold rounded-full px-3 py-1.5 ${searching ? 'bg-gray-200 text-gray-600' : 'bg-primary/10 text-primary'}`}
          >
            {searching ? 'Annuler' : 'Lier'}
          </button>
        )}
      </div>

      {searching && (
        slot.search.trim() ? (
          filtered.length > 0 ? (
            <ul className="ml-2 rounded-xl border border-gray-200 bg-white overflow-hidden max-h-40 overflow-y-auto">
              {filtered.map(m => (
                <li key={m.id}>
                  <button
                    type="button"
                    onClick={() => onChange({ memberId: m.id, search: `${m.firstName} ${m.lastName}` })}
                    className="w-full px-4 py-2.5 text-left text-sm text-gray-700 hover:bg-gray-50 active:bg-primary/10"
                  >
                    {m.firstName} {m.lastName}
                  </button>
                </li>
              ))}
            </ul>
          ) : (
            <p className="pl-3 text-xs text-gray-400">Aucun membre trouvé</p>
          )
        ) : (
          <p className="pl-3 text-xs text-gray-400">Tapez un nom pour rechercher un membre à lier</p>
        )
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
