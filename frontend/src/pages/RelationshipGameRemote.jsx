import { useEffect, useMemo, useRef, useState } from 'react'
import { useLocation, useNavigate, useSearchParams } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'
import { useMembers } from '../store/MembersContext'
import { useUiChrome } from '../store/UiChromeContext'
import { connectHub, gameHub, onHubEvent } from '../services/gameHub'
import { PLAYER_COLORS, formatDuration } from '../utils/memoryGame'
import { QUESTION_COUNT_PRESETS } from '../utils/relationshipGame'
import GameHeader from '../components/games/GameHeader'
import DifficultySetupStep from '../components/games/DifficultySetupStep'
import SpinWheel from '../components/games/SpinWheel'
import QuizRoundScreen from '../components/games/QuizRoundScreen'
import GameResultsScreen from '../components/games/GameResultsScreen'
import DotsIcon from '../components/games/DotsIcon'
import PlayerScoreBar from '../components/games/PlayerScoreBar'
import Avatar from '../components/shared/Avatar'
import ChallengeButton from '../components/games/ChallengeButton'

const REVEAL_DELAY = 1100
const ANSWER_TIME_LIMIT = 15

export default function RelationshipGameRemote() {
  const navigate = useNavigate()
  const location = useLocation()
  const [searchParams] = useSearchParams()
  const autoJoinCode = location.state?.autoJoinCode || searchParams.get('code')
  const { user } = useAuth()
  const { members } = useMembers()
  const { setHideChrome } = useUiChrome()
  const memberById = useMemo(() => new Map(members.map(m => [m.id, m])), [members])

  const [step, setStep] = useState('menu')
  const [error, setError] = useState('')
  const [connecting, setConnecting] = useState(false)

  const [roomCode, setRoomCode] = useState('')
  const [players, setPlayers] = useState([])
  const [questionCount, setQuestionCount] = useState(0)
  const [questionIndex, setQuestionIndex] = useState(0)
  const [currentQuestion, setCurrentQuestion] = useState(null)
  const [correctKey, setCorrectKey] = useState(null)
  const [revealKey, setRevealKey] = useState(null)
  const [timeLeft, setTimeLeft] = useState(ANSWER_TIME_LIMIT)
  const [currentColorIndex, setCurrentColorIndex] = useState(0)
  const [paused, setPaused] = useState(false)
  const [pausedByName, setPausedByName] = useState(null)
  const [pausedByColorIndex, setPausedByColorIndex] = useState(null)
  const [remainingColorIndexes, setRemainingColorIndexes] = useState([])
  const [pendingWinnerId, setPendingWinnerId] = useState(null)
  const [finalPlayers, setFinalPlayers] = useState([])
  const [gameDuration, setGameDuration] = useState(null)
  const [elapsedSeconds, setElapsedSeconds] = useState(0)
  const pendingFinalOrderRef = useRef(null)
  const myPickRef = useRef(null)
  const startTimeRef = useRef(null)
  const pausedAtRef = useRef(null)
  const pausedDurationRef = useRef(0)

  const me = players.find(p => p.memberId === user?.memberId)
  const myColorIndex = me?.colorIndex
  const isHost = me?.isHost ?? false

  useEffect(() => {
    setHideChrome(step === 'playing')
    return () => setHideChrome(false)
  }, [step, setHideChrome])

  useEffect(() => {
    // La connexion doit être établie avant toute tentative de join automatique
    // (deux useEffect séparés se battaient pour la même connexion encore en
    // cours d'établissement sur un démarrage à froid, ex: lien de notification).
    connectHub()
      .then(() => { if (autoJoinCode) handleJoinRoom(autoJoinCode) })
      .catch(() => setError('Connexion impossible.'))
    return () => {
      gameHub.leaveRoom().catch(() => {})
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    if (step !== 'playing') return
    setTimeLeft(ANSWER_TIME_LIMIT)
  }, [step, questionIndex])

  useEffect(() => {
    if (step !== 'playing' || paused) return
    const interval = setInterval(() => {
      setElapsedSeconds(Math.floor((Date.now() - startTimeRef.current - pausedDurationRef.current) / 1000))
    }, 1000)
    return () => clearInterval(interval)
  }, [step, paused])

  useEffect(() => {
    if (step !== 'playing' || paused || revealKey != null) return
    const interval = setInterval(() => setTimeLeft(t => Math.max(0, t - 0.1)), 100)
    return () => clearInterval(interval)
  }, [step, paused, revealKey, questionIndex])

  useEffect(() => {
    if (step !== 'playing' || paused || revealKey != null) return
    if (timeLeft <= 0 && currentColorIndex === myColorIndex) handleTimeout()
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
      onHubEvent('QuizStarting', (payload) => {
        setPlayers(payload.players)
        setQuestionCount(payload.questionCount)
        setQuestionIndex(0)
        setCurrentQuestion(payload.firstQuestion)
        setCorrectKey(null)
        setRevealKey(null)
        myPickRef.current = null
        setElapsedSeconds(0)
        startTimeRef.current = Date.now()
        pausedAtRef.current = null
        pausedDurationRef.current = 0
        setPaused(false)
        setPausedByName(null)
        setPausedByColorIndex(null)
        setRemainingColorIndexes(payload.players.map(p => p.colorIndex))
        setStep('order')
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
      onHubEvent('WheelSpun', ({ winnerColorIndex }) => {
        setPendingWinnerId(winnerColorIndex)
      }),
      onHubEvent('TurnOrderReady', ({ orderedColorIndexes }) => {
        // Ne pas basculer sur 'playing' tout de suite : la roue doit finir son animation
        // (voir handleWheelSpinEnd), même bug déjà rencontré et corrigé sur le Memory.
        pendingFinalOrderRef.current = orderedColorIndexes
      }),
      onHubEvent('AnswerResolved', ({ correctKey: revealed, scorerColorIndex, nextPlayerColorIndex, nextQuestion }) => {
        setCorrectKey(revealed)
        setRevealKey(myPickRef.current ?? revealed)
        if (scorerColorIndex != null) {
          setPlayers(prev => prev.map(p => p.colorIndex === scorerColorIndex ? { ...p, score: p.score + 1 } : p))
        }
        setTimeout(() => {
          myPickRef.current = null
          setRevealKey(null)
          setCorrectKey(null)
          setCurrentColorIndex(nextPlayerColorIndex)
          if (nextQuestion) {
            setCurrentQuestion(nextQuestion)
            setQuestionIndex(i => i + 1)
          }
        }, REVEAL_DELAY)
      }),
      onHubEvent('GameFinished', ({ players: finished, durationSeconds }) => {
        setFinalPlayers(finished)
        setGameDuration(durationSeconds)
        setStep('results')
      }),
      onHubEvent('BackToDifficulty', () => setStep('difficulty')),
    ]
    return () => offs.forEach(off => off())
  }, [])

  async function handleCreateRoom() {
    setConnecting(true)
    setError('')
    try {
      await connectHub()
      const res = await gameHub.createRoom('relationship')
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

  function handleChooseQuestionCount(count) {
    gameHub.startQuiz(count).catch(() => {})
  }

  function handleWheelSpinEnd(item) {
    setRemainingColorIndexes(prev => prev.filter(ci => ci !== item.id))
    setPendingWinnerId(null)
    if (pendingFinalOrderRef.current) {
      const order = pendingFinalOrderRef.current
      pendingFinalOrderRef.current = null
      setCurrentColorIndex(order[0])
      setPlayers(prev => {
        const byColor = new Map(prev.map(p => [p.colorIndex, p]))
        return order.map(ci => byColor.get(ci)).filter(Boolean)
      })
      setStep('playing')
    }
  }

  function handleAnswer(key) {
    if (paused || revealKey != null || currentColorIndex !== myColorIndex) return
    myPickRef.current = key
    gameHub.answerQuestion(key).catch(() => {})
  }

  function handleTimeout() {
    if (paused || revealKey != null || currentColorIndex !== myColorIndex) return
    gameHub.answerQuestion(null).catch(() => {})
  }

  function handleExit() {
    gameHub.leaveRoom().catch(() => {})
    navigate('/games')
  }

  if (step === 'menu') {
    return (
      <div className="overflow-y-auto h-full bg-gray-50 pb-24">
        <GameHeader title="Quel est le lien à distance" onBack={() => navigate('/games/relationship')} />
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
              Visible par ta famille dans l'onglet Parties ouvertes.
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

          {isHost && <ChallengeButton gameType="relationship" roomCode={roomCode} />}

          {isHost ? (
            <button
              onClick={() => setStep('difficulty')}
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

  if (step === 'difficulty') {
    return (
      <div className="overflow-y-auto h-full bg-gray-50 pb-24">
        <GameHeader title="Quel est le lien à distance" onBack={() => setStep('lobby')} />
        <DifficultySetupStep
          photoCount={members.length}
          onStart={handleChooseQuestionCount}
          presets={QUESTION_COUNT_PRESETS}
          unitLabel="questions"
          sectionLabel="Nombre de questions"
        />
      </div>
    )
  }

  if (step === 'order') {
    const items = remainingColorIndexes.map(ci => ({
      id: ci,
      label: players.find(p => p.colorIndex === ci)?.name.split(' ')[0] ?? '',
      color: PLAYER_COLORS[ci % PLAYER_COLORS.length]?.hex,
    }))
    return (
      <div className="overflow-y-auto h-full bg-gray-50 pb-24">
        <GameHeader title="Qui commence ?" onBack={handleExit} />
        <div className="px-4 mt-6 flex flex-col items-center">
          <SpinWheel
            items={items}
            onSpinEnd={handleWheelSpinEnd}
            pendingWinnerId={pendingWinnerId}
            showButton={isHost}
            onRequestSpin={() => gameHub.spinWheel().catch(() => {})}
            spinLabel="Tourner la roue"
          />
          {!isHost && <p className="text-sm text-gray-400 mt-8">En attente que l'hôte lance la roue…</p>}
        </div>
      </div>
    )
  }

  if (step === 'results') {
    return (
      <div className="overflow-y-auto h-full bg-gray-50 pb-24">
        <GameResultsScreen
          players={finalPlayers.map(p => ({ name: p.name, score: p.score, memberId: p.memberId, isGuest: false }))}
          pairsCount={questionCount}
          durationSeconds={gameDuration}
          alreadySubmitted
          canReplay={isHost}
          onReplay={() => gameHub.playAgain().catch(() => {})}
          onExit={handleExit}
          gameType="relationship"
          gameLabel="Quel est le lien"
          unitLabel="questions"
          countLabel="Questions"
        />
      </div>
    )
  }

  // step === 'playing'
  const activePlayer = players.find(p => p.colorIndex === currentColorIndex)
  return (
    <div className="relative h-full bg-gray-50 overflow-hidden">
      <div className={`h-full flex flex-col transition-opacity duration-200 ${paused ? 'opacity-30 pointer-events-none' : ''}`}>
        <div className="px-4 pt-10 pb-2 shrink-0">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2 min-w-0">
              <span className="text-xs font-mono font-semibold text-gray-400 bg-white rounded-full px-3 py-1 shadow-sm truncate">
                {currentColorIndex === myColorIndex ? 'À vous de jouer !' : `Au tour de ${activePlayer?.name ?? ''}`}
              </span>
              <span className="text-xs font-bold text-primary bg-white rounded-full px-3 py-1 shadow-sm shrink-0">
                {questionIndex + 1}/{questionCount}
              </span>
            </div>
            <span className="shrink-0 text-xs font-mono font-semibold text-gray-400 bg-white rounded-full px-2.5 py-1 shadow-sm">
              ⏱ {formatDuration(elapsedSeconds)}
            </span>
            <button
              onClick={() => gameHub.pauseGame().catch(() => {})}
              className="shrink-0 min-h-touch min-w-touch flex items-center justify-center text-gray-400 bg-white rounded-full shadow-sm"
            >
              <DotsIcon />
            </button>
          </div>
          <PlayerScoreBar players={players} isActive={p => p.colorIndex === currentColorIndex} />
        </div>

        {currentQuestion && (
          <QuizRoundScreen
            prompt={<RelationshipPrompt question={currentQuestion} memberById={memberById} />}
            correctKey={correctKey}
            options={currentQuestion.options}
            selectedKey={revealKey}
            onAnswer={handleAnswer}
            disabled={paused || currentColorIndex !== myColorIndex}
            timeLeft={timeLeft}
            timeLimit={ANSWER_TIME_LIMIT}
          />
        )}
      </div>

      {paused && (
        <div className="fixed inset-0 z-40 flex items-center justify-center px-10">
          <div className="w-full max-w-xs space-y-3">
            <div className="rounded-2xl bg-white shadow-lg px-5 py-4 text-center">
              <p className="text-sm font-bold text-gray-800">⏸ Partie mise en pause</p>
              {pausedByName && <p className="text-xs text-gray-400 mt-1">par {pausedByName}</p>}
            </div>
            {pausedByColorIndex === myColorIndex ? (
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
            )}
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

function RelationshipPrompt({ question, memberById }) {
  const a = memberById.get(question.memberAId)
  const b = memberById.get(question.memberBId)

  return (
    <div className="flex flex-col items-center gap-6">
      <p className="text-sm font-bold text-gray-500">Quel est leur lien de parenté ?</p>
      <div className="flex items-center gap-5">
        <div className="flex flex-col items-center gap-2">
          <Avatar member={a} size="xl" className="ring-4 ring-primary/30" />
          <p className="font-extrabold text-gray-800 text-sm text-center">{a?.firstName} {a?.lastName}</p>
        </div>
        <span className="text-2xl">🤔</span>
        <div className="flex flex-col items-center gap-2">
          <Avatar member={b} size="xl" className="ring-4 ring-dark/30" />
          <p className="font-extrabold text-gray-800 text-sm text-center">{b?.firstName} {b?.lastName}</p>
        </div>
      </div>
      <p className="text-sm font-bold text-gray-500 text-center">
        {b?.firstName} {b?.lastName} est le/la <span className="text-primary">…</span> de {a?.firstName} {a?.lastName} ?
      </p>
    </div>
  )
}
