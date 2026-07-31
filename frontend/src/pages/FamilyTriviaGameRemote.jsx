import { useEffect, useRef, useState } from 'react'
import { useLocation, useNavigate, useSearchParams } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'
import { useUiChrome } from '../store/UiChromeContext'
import { connectHub, gameHub, onHubEvent, setReconnectHandler } from '../services/gameHub'
import { formatDuration } from '../utils/memoryGame'
import { DEFAULT_CATEGORY_KEYS } from '../utils/familyTriviaGame'
import GameHeader from '../components/games/GameHeader'
import DifficultySetupStep from '../components/games/DifficultySetupStep'
import TriviaCategoryStep from '../components/games/TriviaCategoryStep'
import GameResultsScreen from '../components/games/GameResultsScreen'
import DotsIcon from '../components/games/DotsIcon'
import PlayerScoreBar from '../components/games/PlayerScoreBar'
import QuizRoundScreen from '../components/games/QuizRoundScreen'
import Avatar from '../components/shared/Avatar'
import ChallengeButton from '../components/games/ChallengeButton'

const ROUND_TIME_LIMIT = 15
const ROUND_PRESETS = [
  { label: 'Court', value: 6, emoji: '🌱', minRequired: 2 },
  { label: 'Moyen', value: 10, emoji: '🌳', minRequired: 2 },
  { label: 'Long', value: 15, emoji: '🔥', minRequired: 2 },
]

export default function FamilyTriviaGameRemote() {
  const navigate = useNavigate()
  const location = useLocation()
  const [searchParams] = useSearchParams()
  const autoJoinCode = location.state?.autoJoinCode || searchParams.get('code')
  const { user } = useAuth()
  const { setHideChrome } = useUiChrome()

  const [step, setStep] = useState('menu')
  const [error, setError] = useState('')
  const [connecting, setConnecting] = useState(false)

  const [roomCode, setRoomCode] = useState('')
  const [players, setPlayers] = useState([])
  const [categories, setCategories] = useState(DEFAULT_CATEGORY_KEYS)
  const [roundCount, setRoundCount] = useState(0)
  const [roundIndex, setRoundIndex] = useState(0)
  const [currentRound, setCurrentRound] = useState(null)
  const [myAnswer, setMyAnswer] = useState(null)
  const [submitted, setSubmitted] = useState(false)
  const [timeLeft, setTimeLeft] = useState(ROUND_TIME_LIMIT)
  const [answerProgress, setAnswerProgress] = useState({ answered: 0, total: 0 })
  const [reveal, setReveal] = useState(null)
  const [paused, setPaused] = useState(false)
  const [pausedByName, setPausedByName] = useState(null)
  const [pausedByColorIndex, setPausedByColorIndex] = useState(null)
  const [disconnectedPlayers, setDisconnectedPlayers] = useState([])
  const [now, setNow] = useState(Date.now())
  const [finalPlayers, setFinalPlayers] = useState([])
  const [gameDuration, setGameDuration] = useState(null)
  const [elapsedSeconds, setElapsedSeconds] = useState(0)
  const startTimeRef = useRef(null)
  const pausedAtRef = useRef(null)
  const pausedDurationRef = useRef(0)
  const stepRef = useRef(step)
  const roomCodeRef = useRef(roomCode)

  const me = players.find(p => p.memberId === user?.memberId)
  const myColorIndex = me?.colorIndex
  const isHost = me?.isHost ?? false

  useEffect(() => {
    setHideChrome(step === 'playing')
    return () => setHideChrome(false)
  }, [step, setHideChrome])

  useEffect(() => { stepRef.current = step }, [step])
  useEffect(() => { roomCodeRef.current = roomCode }, [roomCode])

  useEffect(() => {
    if (disconnectedPlayers.length === 0) return
    const interval = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(interval)
  }, [disconnectedPlayers.length])

  useEffect(() => {
    connectHub()
      .then(() => { if (autoJoinCode) handleJoinRoom(autoJoinCode) })
      .catch(() => setError('Connexion impossible.'))
    setReconnectHandler(() => {
      if (roomCodeRef.current && stepRef.current === 'playing') {
        gameHub.joinRoom(roomCodeRef.current).catch(() => {})
      }
    })
    return () => {
      gameHub.leaveRoom().catch(() => {})
      setReconnectHandler(null)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    if (step !== 'playing' || paused) return
    const interval = setInterval(() => {
      setElapsedSeconds(Math.floor((Date.now() - startTimeRef.current - pausedDurationRef.current) / 1000))
    }, 1000)
    return () => clearInterval(interval)
  }, [step, paused])

  useEffect(() => {
    if (step !== 'playing') return
    setTimeLeft(ROUND_TIME_LIMIT)
  }, [step, roundIndex])

  useEffect(() => {
    if (step !== 'playing' || paused || reveal) return
    const interval = setInterval(() => setTimeLeft(t => Math.max(0, t - 0.1)), 100)
    return () => clearInterval(interval)
  }, [step, paused, reveal, roundIndex])

  useEffect(() => {
    if (step !== 'playing' || paused || reveal || !isHost) return
    if (timeLeft <= 0) gameHub.forceResolveRound().catch(() => {})
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [timeLeft])

  useEffect(() => {
    const offs = [
      onHubEvent('PlayerJoined', setPlayers),
      onHubEvent('PlayerLeft', setPlayers),
      onHubEvent('GameCancelled', () => {
        setError('La partie a été annulée (un joueur a quitté).')
        setStep('menu')
      }),
      onHubEvent('SimRoundStarting', (payload) => {
        setPlayers(payload.players)
        setRoundCount(payload.roundCount)
        setRoundIndex(0)
        setCurrentRound(payload.firstRound)
        setMyAnswer(null)
        setSubmitted(false)
        setAnswerProgress({ answered: 0, total: payload.players.length })
        setReveal(null)
        setElapsedSeconds(0)
        startTimeRef.current = Date.now()
        pausedAtRef.current = null
        pausedDurationRef.current = 0
        setPaused(false)
        setPausedByName(null)
        setPausedByColorIndex(null)
        setStep('playing')
      }),
      onHubEvent('GamePaused', ({ byColorIndex, byName }) => {
        pausedAtRef.current = Date.now()
        setPausedByName(byName ?? null)
        setPausedByColorIndex(byColorIndex)
        setPaused(true)
      }),
      onHubEvent('GameResumed', () => {
        if (pausedAtRef.current) {
          pausedDurationRef.current += Date.now() - pausedAtRef.current
          pausedAtRef.current = null
        }
        setPausedByName(null)
        setPausedByColorIndex(null)
        setPaused(false)
      }),
      onHubEvent('PlayerDisconnected', ({ memberId, colorIndex, name, graceSeconds }) => {
        if (!pausedAtRef.current) pausedAtRef.current = Date.now()
        setPaused(true)
        setDisconnectedPlayers(prev => prev.some(p => p.memberId === memberId)
          ? prev
          : [...prev, { memberId, colorIndex, name, deadline: Date.now() + graceSeconds * 1000 }])
      }),
      onHubEvent('PlayerReconnected', ({ memberId, players: updated }) => {
        setDisconnectedPlayers(prev => prev.filter(p => p.memberId !== memberId))
        if (updated) setPlayers(updated)
      }),
      onHubEvent('PlayerKicked', ({ memberId, players: updated }) => {
        setDisconnectedPlayers(prev => prev.filter(p => p.memberId !== memberId))
        setPlayers(updated)
      }),
      onHubEvent('AnswerProgress', setAnswerProgress),
      onHubEvent('RoundResolved', ({ correctKey, scorerMemberIds, scorerPoints, answers, isLastRound }) => {
        setReveal({ correctKey, scorerMemberIds, scorerPoints, answers, isLastRound })
        if (scorerPoints) {
          setPlayers(prev => prev.map(p => scorerPoints[p.memberId] ? { ...p, score: p.score + scorerPoints[p.memberId] } : p))
        }
      }),
      onHubEvent('NextRound', ({ round }) => {
        setCurrentRound(round)
        setRoundIndex(i => i + 1)
        setMyAnswer(null)
        setSubmitted(false)
        setAnswerProgress(prev => ({ answered: 0, total: prev.total }))
        setReveal(null)
      }),
      onHubEvent('GameFinished', ({ players: finished, durationSeconds }) => {
        setFinalPlayers(finished)
        setGameDuration(durationSeconds)
        setStep('results')
      }),
      onHubEvent('BackToDifficulty', () => setStep('categories')),
    ]
    return () => offs.forEach(off => off())
  }, [])

  async function handleCreateRoom() {
    setConnecting(true)
    setError('')
    try {
      await connectHub()
      const res = await gameHub.createRoom('familytrivia')
      if (!res.success) { setError(res.error); return }
      setPlayers(res.players)
      setRoomCode(res.code)
      setStep('lobby')
    } catch {
      setError('Impossible de créer la partie.')
    } finally {
      setConnecting(false)
    }
  }

  async function handleJoinRoom(joinCode) {
    const codeToJoin = joinCode.trim()
    if (!codeToJoin) return
    setConnecting(true)
    setError('')
    try {
      await connectHub()
      const res = await gameHub.joinRoom(codeToJoin.toUpperCase())
      if (!res.success) { setError(res.error); return }
      setPlayers(res.players)
      setRoomCode(res.code)
      setStep('lobby')
    } catch {
      setError('Impossible de rejoindre la partie.')
    } finally {
      setConnecting(false)
    }
  }

  function handleToggleCategory(key) {
    setCategories(prev => prev.includes(key) ? prev.filter(c => c !== key) : [...prev, key])
  }

  function handleChooseRoundCount(count) {
    gameHub.startFamilyTriviaGame(count, categories).catch(() => {})
  }

  function handleAnswer(key) {
    if (paused || submitted || reveal) return
    setMyAnswer(key)
    setSubmitted(true)
    gameHub.submitAnswer(key).catch(() => {})
  }

  function handleContinue() {
    if (!isHost) return
    gameHub.continueRound().catch(() => {})
  }

  function handleExit() {
    gameHub.leaveRoom().catch(() => {})
    navigate('/games')
  }

  const scorerLines = reveal
    ? players
        .filter(p => reveal.scorerMemberIds?.includes(p.memberId))
        .map(p => `${p.name.split(' ')[0]} (+${reveal.scorerPoints?.[p.memberId] ?? 1})`)
    : []

  if (step === 'menu') {
    return (
      <div className="overflow-y-auto h-full bg-gray-50 pb-24">
        <GameHeader title="Quiz Famille" onBack={() => navigate('/games')} />
        <div className="px-4 mt-6 space-y-5">
          {error && <p className="rounded-xl bg-red-50 px-4 py-3 text-sm text-red-600 text-center">{error}</p>}

          <button
            onClick={handleCreateRoom}
            disabled={connecting}
            className="w-full rounded-xl bg-primary py-3.5 text-sm font-semibold text-white active:bg-primary-dark disabled:opacity-50"
          >
            Créer une partie
          </button>

          <p className="text-center text-xs text-gray-400">
            Pour rejoindre une partie d'un proche, retrouve-la dans l'onglet <span className="font-semibold text-gray-500">Parties ouvertes</span>.
          </p>
        </div>
      </div>
    )
  }

  if (step === 'lobby') {
    return (
      <div className="overflow-y-auto h-full bg-gray-50 pb-24">
        <GameHeader title="Salon d'attente" onBack={handleExit} />
        <div className="px-4 mt-6 flex flex-col items-center">
          {isHost && (
            <p className="text-sm text-gray-500 mb-4 text-center">
              Visible par ta famille dans l'onglet Parties ouvertes. Jusqu'à 10 joueurs.
            </p>
          )}

          <div className="w-full rounded-2xl bg-white shadow-sm divide-y divide-gray-50 overflow-hidden mb-6">
            {players.map(p => (
              <div key={p.memberId} className="flex items-center gap-3 px-4 py-3">
                <Avatar src={p.profilePictureUrl} name={p.name} size="sm" />
                <span className="flex-1 text-sm font-medium text-gray-800">{p.name}</span>
                {p.isHost && <span className="text-[10px] font-semibold text-primary bg-primary/10 rounded-full px-2 py-0.5">Hôte</span>}
              </div>
            ))}
          </div>

          {isHost && <ChallengeButton gameType="familytrivia" roomCode={roomCode} excludedMemberIds={players.map(p => p.memberId)} />}

          {isHost ? (
            <button
              onClick={() => setStep('categories')}
              disabled={players.length < 2}
              className="w-full rounded-xl bg-primary py-3.5 text-sm font-semibold text-white active:bg-primary-dark disabled:opacity-40"
            >
              {players.length < 2 ? 'En attente d\'un 2ᵉ joueur…' : 'Lancer la partie'}
            </button>
          ) : (
            <p className="text-sm text-gray-400 text-center">En attente que l'hôte lance la partie…</p>
          )}
        </div>
      </div>
    )
  }

  if (step === 'categories') {
    return (
      <div className="overflow-y-auto h-full bg-gray-50 pb-24">
        <GameHeader title="Quiz Famille" onBack={() => setStep('lobby')} />
        <TriviaCategoryStep
          selected={categories}
          onToggle={handleToggleCategory}
          onContinue={() => setStep('difficulty')}
        />
      </div>
    )
  }

  if (step === 'difficulty') {
    return (
      <div className="overflow-y-auto h-full bg-gray-50 pb-24">
        <GameHeader title="Quiz Famille" onBack={() => setStep('categories')} />
        <DifficultySetupStep
          photoCount={players.length}
          onStart={handleChooseRoundCount}
          presets={ROUND_PRESETS}
          unitLabel="questions"
          sectionLabel="Nombre de questions"
        />
      </div>
    )
  }

  if (step === 'results') {
    return (
      <div className="overflow-y-auto h-full bg-gray-50 pb-24">
        <GameResultsScreen
          players={finalPlayers.map(p => ({ name: p.name, score: p.score, memberId: p.memberId, isGuest: false }))}
          pairsCount={roundCount}
          durationSeconds={gameDuration}
          alreadySubmitted
          canReplay={isHost}
          onReplay={() => gameHub.playAgain().catch(() => {})}
          onExit={handleExit}
          gameType="familytrivia"
          gameLabel="Quiz Famille"
          unitLabel="questions"
          countLabel="Questions"
        />
      </div>
    )
  }

  // step === 'playing'
  return (
    <div className="relative h-full bg-gray-50 overflow-hidden">
      <div className={`h-full flex flex-col transition-opacity duration-200 ${paused ? 'opacity-30 pointer-events-none' : ''}`}>
        <div className="px-4 pt-10 pb-2 shrink-0">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-bold text-primary bg-white rounded-full px-3 py-1 shadow-sm">
              {roundIndex + 1}/{roundCount}
            </span>
            <span className="text-xs font-mono font-semibold text-gray-400 bg-white rounded-full px-2.5 py-1 shadow-sm">
              ⏱ {formatDuration(elapsedSeconds)}
            </span>
            <button
              onClick={() => gameHub.pauseGame().catch(() => {})}
              className="shrink-0 min-h-touch min-w-touch flex items-center justify-center text-gray-400 bg-white rounded-full shadow-sm"
            >
              <DotsIcon />
            </button>
          </div>
          <PlayerScoreBar players={players} isActive={() => false} />
        </div>

        <p className="text-center text-xs font-semibold text-gray-400 mt-2 mb-1 shrink-0">
          {answerProgress.answered}/{answerProgress.total} ont répondu
        </p>

        {currentRound && (
          <QuizRoundScreen
            prompt={<TriviaPrompt prompt={currentRound.prompt} />}
            correctKey={reveal?.correctKey ?? null}
            options={currentRound.options ?? []}
            selectedKey={reveal ? myAnswer : null}
            pendingKey={myAnswer}
            onAnswer={handleAnswer}
            disabled={paused || submitted}
            timeLeft={timeLeft}
            timeLimit={ROUND_TIME_LIMIT}
          />
        )}
      </div>

      {reveal && (
        <div className="fixed inset-x-0 bottom-0 z-30 px-4 pb-safe-lg pb-6">
          <div className="rounded-2xl bg-white shadow-xl p-4 space-y-3">
            <p className="text-xs text-gray-500 text-center">
              {scorerLines.length > 0 ? `Trouvé par ${scorerLines.join(', ')}` : 'Personne n\'a trouvé'}
            </p>
            {isHost ? (
              <button
                onClick={handleContinue}
                className="w-full rounded-xl bg-primary py-3.5 text-sm font-semibold text-white active:bg-primary-dark"
              >
                {reveal.isLastRound ? 'Voir les résultats' : 'Question suivante'}
              </button>
            ) : (
              <p className="text-xs text-gray-400 text-center">En attente de l'hôte pour continuer…</p>
            )}
          </div>
        </div>
      )}

      {paused && (
        <div className="fixed inset-0 z-40 flex items-center justify-center px-10">
          <div className="w-full max-w-xs space-y-3">
            <div className="rounded-2xl bg-white shadow-lg px-5 py-4 text-center space-y-2">
              {disconnectedPlayers.length === 0 ? (
                <>
                  <p className="text-sm font-bold text-gray-800">⏸ Partie mise en pause</p>
                  {pausedByName && <p className="text-xs text-gray-400 mt-1">par {pausedByName}</p>}
                </>
              ) : (
                disconnectedPlayers.map(dp => (
                  <p key={dp.memberId} className="text-sm font-bold text-gray-800">
                    🔌 {dp.name} s'est déconnecté·e
                    <span className="block text-xs font-normal text-gray-400 mt-1">
                      Reconnexion possible pendant encore {Math.max(0, Math.ceil((dp.deadline - now) / 1000))}s…
                    </span>
                  </p>
                ))
              )}
            </div>

            {disconnectedPlayers.length === 0 && (
              pausedByColorIndex === myColorIndex ? (
                <button
                  onClick={() => gameHub.resumeGame().catch(() => {})}
                  className="w-full rounded-xl bg-primary py-3.5 text-sm font-semibold text-white shadow-lg active:bg-primary-dark"
                >
                  Reprendre
                </button>
              ) : (
                <p className="text-xs text-gray-400 text-center">
                  Seul{pausedByName ? ` ${pausedByName}` : ''} peut reprendre la partie.
                </p>
              )
            )}

            {isHost && disconnectedPlayers.map(dp => (
              <button
                key={dp.memberId}
                onClick={() => gameHub.kickDisconnectedPlayer(dp.memberId).catch(() => {})}
                className="w-full rounded-xl bg-white py-3.5 text-sm font-semibold text-gray-600 shadow-lg active:bg-gray-50"
              >
                Continuer sans {dp.name.split(' ')[0]}
              </button>
            ))}

            <button
              onClick={handleExit}
              className="w-full rounded-xl bg-white py-3.5 text-sm font-semibold text-red-500 shadow-lg active:bg-gray-50"
            >
              Quitter la partie
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

function TriviaPrompt({ prompt }) {
  return (
    <div className="flex flex-col items-center gap-3 text-center px-4">
      <span className="text-3xl">🧠</span>
      <p className="text-base font-extrabold text-gray-800">{prompt}</p>
    </div>
  )
}
