import { useEffect, useRef, useState } from 'react'
import { useLocation, useNavigate, useSearchParams } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'
import { useMembers } from '../store/MembersContext'
import { useUiChrome } from '../store/UiChromeContext'
import { connectHub, gameHub, onHubEvent, setReconnectHandler } from '../services/gameHub'
import { membersWithPhoto, PLAYER_COLORS, formatDuration } from '../utils/memoryGame'
import { QUESTION_COUNT_PRESETS } from '../utils/whoIsItGame'
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

export default function WhoIsItGameRemote() {
  const navigate = useNavigate()
  const location = useLocation()
  const [searchParams] = useSearchParams()
  const autoJoinCode = location.state?.autoJoinCode || searchParams.get('code')
  const { user } = useAuth()
  const { members } = useMembers()
  const { setHideChrome } = useUiChrome()
  const photoCount = membersWithPhoto(members).length

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
  const [disconnectedPlayers, setDisconnectedPlayers] = useState([])
  const [now, setNow] = useState(Date.now())
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
    // La connexion doit être établie avant toute tentative de join automatique
    // (deux useEffect séparés se battaient pour la même connexion encore en
    // cours d'établissement sur un démarrage à froid, ex: lien de notification).
    connectHub()
      .then(() => { if (autoJoinCode) handleJoinRoom(autoJoinCode) })
      .catch(() => setError('Connexion impossible.'))
    // SignalR reconnecte le transport tout seul après une coupure réseau (nouveau
    // ConnectionId) : il faut rappeler JoinRoom pour que le serveur relie ça au
    // joueur — uniquement si une partie était en cours, sinon rien à faire.
    setReconnectHandler(() => {
      if (roomCodeRef.current && (stepRef.current === 'order' || stepRef.current === 'playing')) {
        // La reco SignalR seule ne rejoue pas les événements manqués pendant la coupure
        // (AnswerResolved) : on applique l'instantané renvoyé par JoinRoom pour rattraper la
        // question/le tour réels plutôt que de rester bloqué sur le dernier état connu.
        gameHub.joinRoom(roomCodeRef.current).then(res => {
          if (res?.state) applyReconnectState(res.state)
        }).catch(() => {})
      }
    })
    return () => {
      gameHub.leaveRoom().catch(() => {})
      setReconnectHandler(null)
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
      onHubEvent('PlayerKicked', ({ memberId, players: updated, nextPlayerColorIndex }) => {
        setDisconnectedPlayers(prev => prev.filter(p => p.memberId !== memberId))
        setPlayers(updated)
        if (nextPlayerColorIndex != null) {
          myPickRef.current = null
          setRevealKey(null)
          setCorrectKey(null)
          setCurrentColorIndex(nextPlayerColorIndex)
          setTimeLeft(ANSWER_TIME_LIMIT)
        }
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
      const res = await gameHub.createRoom('quiwho')
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

  function applyReconnectState(state) {
    myPickRef.current = null
    setRevealKey(null)
    setCorrectKey(null)
    setCurrentQuestion(state.currentQuestion)
    setQuestionIndex(state.questionIndex)
    setQuestionCount(state.questionCount)
    if (state.currentPlayerColorIndex != null) setCurrentColorIndex(state.currentPlayerColorIndex)
    setTimeLeft(ANSWER_TIME_LIMIT)
    setStep('playing')
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
        <GameHeader title="Qui est-ce à distance" onBack={() => navigate('/games/quiwho')} />
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

          {isHost && <ChallengeButton gameType="quiwho" roomCode={roomCode} excludedMemberIds={players.map(p => p.memberId)} />}

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
        <GameHeader title="Qui est-ce à distance" onBack={() => setStep('lobby')} />
        <DifficultySetupStep
          photoCount={photoCount}
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
          gameType="quiwho"
          gameLabel="Qui est-ce"
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
            prompt={<PhotoPrompt url={currentQuestion.photoUrl} />}
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

function PhotoPrompt({ url }) {
  return (
    <div className="rounded-3xl overflow-hidden shadow-lg shadow-black/10 bg-white p-2 max-h-[42vh] aspect-square">
      <img src={url} alt="Qui est-ce ?" className="h-full w-full rounded-2xl object-cover" />
    </div>
  )
}
