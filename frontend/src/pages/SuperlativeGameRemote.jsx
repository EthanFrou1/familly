import { useEffect, useRef, useState } from 'react'
import { useLocation, useNavigate, useSearchParams } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'
import { useUiChrome } from '../store/UiChromeContext'
import { connectHub, gameHub, onHubEvent } from '../services/gameHub'
import { formatDuration } from '../utils/memoryGame'
import GameHeader from '../components/games/GameHeader'
import DifficultySetupStep from '../components/games/DifficultySetupStep'
import GameResultsScreen from '../components/games/GameResultsScreen'
import DotsIcon from '../components/games/DotsIcon'
import PlayerScoreBar from '../components/games/PlayerScoreBar'
import Avatar from '../components/shared/Avatar'
import ChallengeButton from '../components/games/ChallengeButton'

const ROUND_PRESETS = [
  { label: 'Court', value: 8, emoji: '🌱', minRequired: 2 },
  { label: 'Moyen', value: 12, emoji: '🌳', minRequired: 2 },
  { label: 'Long', value: 16, emoji: '🔥', minRequired: 2 },
]

export default function SuperlativeGameRemote() {
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
  const [roundCount, setRoundCount] = useState(0)
  const [roundIndex, setRoundIndex] = useState(0)
  const [currentRound, setCurrentRound] = useState(null)
  const [myVote, setMyVote] = useState(null)
  const [answerProgress, setAnswerProgress] = useState({ answered: 0, total: 0 })
  const [reveal, setReveal] = useState(null)
  const [paused, setPaused] = useState(false)
  const [pausedByName, setPausedByName] = useState(null)
  const [pausedByColorIndex, setPausedByColorIndex] = useState(null)
  const [finalPlayers, setFinalPlayers] = useState([])
  const [gameDuration, setGameDuration] = useState(null)
  const [elapsedSeconds, setElapsedSeconds] = useState(0)
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
    if (step !== 'playing' || paused) return
    const interval = setInterval(() => {
      setElapsedSeconds(Math.floor((Date.now() - startTimeRef.current - pausedDurationRef.current) / 1000))
    }, 1000)
    return () => clearInterval(interval)
  }, [step, paused])

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
        setMyVote(null)
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
      onHubEvent('AnswerProgress', setAnswerProgress),
      onHubEvent('RoundResolved', ({ votes, winnerMemberIds, answers, isLastRound }) => {
        setReveal({ votes, winnerMemberIds, answers, isLastRound })
        if (winnerMemberIds?.length) {
          setPlayers(prev => prev.map(p => winnerMemberIds.includes(p.memberId) ? { ...p, score: p.score + 1 } : p))
        }
      }),
      onHubEvent('NextRound', ({ round }) => {
        setCurrentRound(round)
        setRoundIndex(i => i + 1)
        setMyVote(null)
        setAnswerProgress(prev => ({ answered: 0, total: prev.total }))
        setReveal(null)
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
      const res = await gameHub.createRoom('superlative')
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

  function handleChooseRoundCount(count) {
    gameHub.startSimultaneousGame(count).catch(() => {})
  }

  function handleVote(memberId) {
    if (paused || myVote || reveal) return
    setMyVote(memberId)
    gameHub.submitAnswer(memberId).catch(() => {})
  }

  function handleContinue() {
    if (!isHost) return
    gameHub.continueRound().catch(() => {})
  }

  function handleExit() {
    gameHub.leaveRoom().catch(() => {})
    navigate('/games')
  }

  if (step === 'menu') {
    return (
      <div className="overflow-y-auto h-full bg-gray-50 pb-24">
        <GameHeader title="Le plus susceptible" onBack={() => navigate('/games')} />
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

          {isHost && <ChallengeButton gameType="superlative" roomCode={roomCode} />}

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
        <GameHeader title="Le plus susceptible" onBack={() => setStep('lobby')} />
        <DifficultySetupStep
          photoCount={players.length}
          onStart={handleChooseRoundCount}
          presets={ROUND_PRESETS}
          unitLabel="rounds"
          sectionLabel="Nombre de rounds"
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
          gameType="superlative"
          gameLabel="Le plus susceptible"
          unitLabel="titres"
          countLabel="Rounds"
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

        <div className="flex-1 overflow-y-auto px-4 py-5">
          <p className="text-center text-lg font-extrabold text-gray-800 mb-1.5">{currentRound?.prompt}</p>
          <p className="text-center text-xs font-semibold text-gray-400 mb-3">
            {answerProgress.answered}/{answerProgress.total} ont voté
          </p>

          {isHost && !reveal && (
            <button
              onClick={() => gameHub.forceResolveRound().catch(() => {})}
              className="w-full mb-4 rounded-xl bg-white shadow-sm py-2.5 text-sm font-semibold text-gray-500 active:bg-gray-50"
            >
              Forcer la révélation
            </button>
          )}

          <div className="grid grid-cols-3 gap-3">
            {players.map(p => {
              const isWinner = reveal?.winnerMemberIds?.includes(p.memberId)
              const voteCount = reveal?.votes?.[p.memberId] ?? 0
              const isMine = myVote === p.memberId
              return (
                <button
                  key={p.memberId}
                  onClick={() => handleVote(p.memberId)}
                  disabled={!!myVote || !!reveal}
                  className={`flex flex-col items-center gap-1.5 rounded-2xl p-3 transition-all disabled:opacity-100 ${
                    isWinner ? 'bg-primary/15 ring-2 ring-primary' : isMine ? 'bg-primary/10 ring-2 ring-primary/40' : 'bg-white shadow-sm active:opacity-80'
                  }`}
                >
                  <Avatar src={p.profilePictureUrl} name={p.name} size="md" />
                  <span className="text-xs font-semibold text-gray-700 truncate max-w-full">{p.name.split(' ')[0]}</span>
                  {reveal && <span className="text-[11px] font-bold text-primary">{voteCount} vote{voteCount > 1 ? 's' : ''}</span>}
                </button>
              )
            })}
          </div>
        </div>
      </div>

      {reveal && (
        <div className="fixed inset-0 z-30 bg-black/40 flex items-center justify-center px-6 py-10">
          <div className="w-full max-w-xs max-h-full overflow-y-auto rounded-3xl bg-white shadow-xl p-6 text-center space-y-4">
            <p className="text-sm font-bold text-gray-500">{currentRound?.prompt}</p>
            <WinnerReveal players={players} reveal={reveal} />
            <div>
              <p className="text-[11px] font-bold text-gray-400 uppercase tracking-wide mb-1.5 text-left">Détail des votes</p>
              <VoteBreakdown players={players} reveal={reveal} />
            </div>
            {isHost ? (
              <button
                onClick={handleContinue}
                className="w-full rounded-xl bg-primary py-3.5 text-sm font-semibold text-white active:bg-primary-dark"
              >
                {reveal.isLastRound ? 'Voir les résultats' : 'Round suivant'}
              </button>
            ) : (
              <p className="text-xs text-gray-400">En attente de l'hôte pour continuer…</p>
            )}
          </div>
        </div>
      )}

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

// Évite les lignes interminables quand beaucoup de joueurs votent pour la même personne ou
// sont ex-æquo : au-delà de maxShown, on regroupe le reste dans "+N autres".
function formatNameList(names, maxShown = 4) {
  if (names.length <= maxShown) return names.join(', ')
  const rest = names.length - maxShown
  return `${names.slice(0, maxShown).join(', ')} +${rest} autre${rest > 1 ? 's' : ''}`
}

function WinnerReveal({ players, reveal }) {
  const winners = (reveal.winnerMemberIds ?? []).map(id => players.find(p => p.memberId === id)).filter(Boolean)
  const voteCount = id => reveal.votes?.[id] ?? 0

  if (winners.length === 0) {
    return <p className="text-sm text-gray-400 py-4">Personne n'a voté à temps</p>
  }

  if (winners.length === 2 && winners[0].profilePictureUrl && winners[1].profilePictureUrl) {
    const [a, b] = winners
    return (
      <div className="flex flex-col items-center gap-2">
        <div className="relative h-28 w-28 rounded-full overflow-hidden ring-4 ring-primary/30">
          <img src={a.profilePictureUrl} alt="" className="absolute inset-0 h-full w-full object-cover" style={{ clipPath: 'inset(0 50% 0 0)' }} />
          <img src={b.profilePictureUrl} alt="" className="absolute inset-0 h-full w-full object-cover" style={{ clipPath: 'inset(0 0 0 50%)' }} />
        </div>
        <p className="font-extrabold text-gray-800">Égalité : {a.name.split(' ')[0]} & {b.name.split(' ')[0]} 😄</p>
        <p className="text-xs text-primary font-bold">{voteCount(a.memberId)} vote{voteCount(a.memberId) > 1 ? 's' : ''} chacun</p>
      </div>
    )
  }

  const shownWinners = winners.slice(0, 6)
  const extraWinners = winners.length - shownWinners.length

  return (
    <div className="flex flex-col items-center gap-2">
      <div className="flex flex-wrap justify-center gap-1.5">
        {shownWinners.map(w => (
          <Avatar
            key={w.memberId}
            src={w.profilePictureUrl}
            name={w.name}
            size={winners.length > 3 ? 'md' : 'lg'}
            className="ring-2 ring-white shadow"
          />
        ))}
        {extraWinners > 0 && (
          <div className="h-12 w-12 rounded-full bg-gray-100 ring-2 ring-white shadow flex items-center justify-center text-xs font-bold text-gray-500">
            +{extraWinners}
          </div>
        )}
      </div>
      <p className="font-extrabold text-gray-800 px-2">{formatNameList(winners.map(w => w.name.split(' ')[0]), 4)}</p>
      <p className="text-xs text-primary font-bold">
        {voteCount(winners[0].memberId)} vote{voteCount(winners[0].memberId) > 1 ? 's' : ''}{winners.length > 1 ? ' chacun' : ''}
      </p>
    </div>
  )
}

function VoteBreakdown({ players, reveal }) {
  const rows = players
    .map(p => ({
      player: p,
      count: reveal.votes?.[p.memberId] ?? 0,
      voters: Object.entries(reveal.answers ?? {})
        .filter(([, votedFor]) => votedFor === p.memberId)
        .map(([voterId]) => players.find(v => v.memberId === voterId))
        .filter(Boolean),
    }))
    .sort((a, b) => b.count - a.count)

  return (
    <div className="space-y-1.5 max-h-56 overflow-y-auto">
      {rows.map(({ player, count, voters }) => (
        <div key={player.memberId} className="flex items-start gap-2 rounded-xl bg-gray-50 px-3 py-2">
          <Avatar src={player.profilePictureUrl} name={player.name} size="xs" className="mt-0.5 shrink-0" />
          <div className="flex-1 min-w-0 text-left">
            <p className="text-xs font-bold text-gray-700 truncate">{player.name.split(' ')[0]}</p>
            {voters.length > 0 && (
              <p className="text-[10px] text-gray-400 leading-snug break-words">
                voté par {formatNameList(voters.map(v => v.name.split(' ')[0]), 4)}
              </p>
            )}
          </div>
          <span className="text-xs font-black text-primary shrink-0">{count}</span>
        </div>
      ))}
    </div>
  )
}
