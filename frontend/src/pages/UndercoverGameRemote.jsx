import { useEffect, useRef, useState } from 'react'
import { useLocation, useNavigate, useSearchParams } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'
import { useUiChrome } from '../store/UiChromeContext'
import { connectHub, gameHub, onHubEvent } from '../services/gameHub'
import { formatDuration } from '../utils/memoryGame'
import { maxUndercoverCount } from '../utils/undercoverGame'
import GameHeader from '../components/games/GameHeader'
import DotsIcon from '../components/games/DotsIcon'
import Avatar from '../components/shared/Avatar'
import ChallengeButton from '../components/games/ChallengeButton'

const ROLE_LABELS = { Civilian: 'Civil', Undercover: 'Undercover', MrWhite: 'Mr. White' }
const MIN_PLAYERS = 4

export default function UndercoverGameRemote() {
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
  const [undercoverCount, setUndercoverCount] = useState(1)
  const [mrWhiteCount, setMrWhiteCount] = useState(0)

  const [myRole, setMyRole] = useState(null)
  const [myWord, setMyWord] = useState(null)
  const [aliveMemberIds, setAliveMemberIds] = useState([])
  const [phase, setPhase] = useState('clue')
  const [currentSpeakerMemberId, setCurrentSpeakerMemberId] = useState(null)
  const [voteProgress, setVoteProgress] = useState({ voted: 0, total: 0 })
  const [myVote, setMyVote] = useState(null)
  const [lastElimination, setLastElimination] = useState(null)
  const [mrWhiteGuessInput, setMrWhiteGuessInput] = useState('')
  const [mrWhiteGuessResult, setMrWhiteGuessResult] = useState(null)
  const [paused, setPaused] = useState(false)
  const [pausedByName, setPausedByName] = useState(null)
  const [pausedByColorIndex, setPausedByColorIndex] = useState(null)
  const [finalPlayers, setFinalPlayers] = useState([])
  const [finalWinnerName, setFinalWinnerName] = useState(null)
  const [gameDuration, setGameDuration] = useState(null)
  const [elapsedSeconds, setElapsedSeconds] = useState(0)
  const startTimeRef = useRef(null)

  const me = players.find(p => p.memberId === user?.memberId)
  const myColorIndex = me?.colorIndex
  const isHost = me?.isHost ?? false
  const amAlive = aliveMemberIds.includes(user?.memberId)
  const alivePlayers = players.filter(p => aliveMemberIds.includes(p.memberId))
  const awaitingMyGuess = lastElimination?.awaitingMrWhiteGuess && lastElimination?.eliminatedMemberId === user?.memberId

  useEffect(() => {
    setHideChrome(step === 'playing' || step === 'reveal')
    return () => setHideChrome(false)
  }, [step, setHideChrome])

  useEffect(() => {
    connectHub()
      .then(() => { if (autoJoinCode) handleJoinRoom(autoJoinCode) })
      .catch(() => setError('Connexion impossible.'))
    return () => { gameHub.leaveRoom().catch(() => {}) }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    if (step !== 'playing' && step !== 'reveal') return
    if (paused) return
    const interval = setInterval(() => {
      setElapsedSeconds(Math.floor((Date.now() - startTimeRef.current) / 1000))
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
      onHubEvent('YourUndercoverRole', ({ role, word }) => {
        setMyRole(role)
        setMyWord(word)
      }),
      onHubEvent('UndercoverGameStarting', (payload) => {
        setPlayers(payload.players)
        setAliveMemberIds(payload.aliveMemberIds)
        setCurrentSpeakerMemberId(payload.currentSpeakerMemberId)
        setPhase('clue')
        setMyVote(null)
        setLastElimination(null)
        setMrWhiteGuessResult(null)
        setVoteProgress({ voted: 0, total: payload.players.length })
        setElapsedSeconds(0)
        startTimeRef.current = Date.now()
        setPaused(false)
        setStep('reveal')
      }),
      onHubEvent('GamePaused', ({ byColorIndex, byName }) => {
        setPausedByName(byName ?? null)
        setPausedByColorIndex(byColorIndex)
        setPaused(true)
      }),
      onHubEvent('GameResumed', () => {
        setPausedByName(null)
        setPausedByColorIndex(null)
        setPaused(false)
      }),
      onHubEvent('UndercoverTurnAdvanced', (payload) => {
        if (payload.phase === 'vote') {
          setPhase('vote')
          setMyVote(null)
          setVoteProgress(prev => ({ voted: 0, total: prev.total }))
        } else {
          setCurrentSpeakerMemberId(payload.currentSpeakerMemberId)
        }
      }),
      onHubEvent('UndercoverVoteProgress', setVoteProgress),
      onHubEvent('UndercoverVoteResolved', (payload) => {
        setLastElimination(payload)
        setMrWhiteGuessResult(null)
        if (!payload.tie) setAliveMemberIds(prev => prev.filter(id => id !== payload.eliminatedMemberId))
        setPhase('eliminated')
      }),
      onHubEvent('UndercoverMrWhiteGuessResolved', (payload) => setMrWhiteGuessResult(payload)),
      onHubEvent('UndercoverNextRound', (payload) => {
        setAliveMemberIds(payload.aliveMemberIds)
        setCurrentSpeakerMemberId(payload.currentSpeakerMemberId)
        setPhase('clue')
        setMyVote(null)
        setLastElimination(null)
        setMrWhiteGuessResult(null)
        setVoteProgress({ voted: 0, total: payload.aliveMemberIds.length })
        setStep('playing')
      }),
      onHubEvent('GameFinished', ({ players: finished, durationSeconds, winnerName }) => {
        setFinalPlayers(finished)
        setGameDuration(durationSeconds)
        setFinalWinnerName(winnerName ?? null)
        setStep('results')
      }),
      onHubEvent('BackToDifficulty', () => setStep('config')),
    ]
    return () => offs.forEach(off => off())
  }, [])

  async function handleCreateRoom() {
    setConnecting(true)
    setError('')
    try {
      await connectHub()
      const res = await gameHub.createRoom('undercover')
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

  function handleStartGame() {
    gameHub.startUndercoverGame(undercoverCount, mrWhiteCount).catch(() => {})
  }

  function handleVote(memberId) {
    if (myVote || paused) return
    setMyVote(memberId)
    gameHub.submitUndercoverVote(memberId).catch(() => {})
  }

  function handleSubmitMrWhiteGuess(e) {
    e.preventDefault()
    if (!mrWhiteGuessInput.trim()) return
    gameHub.submitMrWhiteGuess(mrWhiteGuessInput.trim()).catch(() => {})
  }

  function handleContinue() {
    if (!isHost) return
    gameHub.continueUndercoverRound().catch(() => {})
  }

  function handleExit() {
    gameHub.leaveRoom().catch(() => {})
    navigate('/games')
  }

  if (step === 'menu') {
    return (
      <div className="overflow-y-auto h-full bg-gray-50 pb-24">
        <GameHeader title="Undercover" onBack={() => navigate('/games')} />
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

          {isHost && <ChallengeButton gameType="undercover" roomCode={roomCode} excludedMemberIds={players.map(p => p.memberId)} />}

          {isHost ? (
            <button
              onClick={() => setStep('config')}
              disabled={players.length < MIN_PLAYERS}
              className="w-full rounded-xl bg-primary py-3.5 text-sm font-semibold text-white active:bg-primary-dark disabled:opacity-40"
            >
              {players.length < MIN_PLAYERS ? `En attente de joueurs (min. ${MIN_PLAYERS})…` : 'Continuer'}
            </button>
          ) : (
            <p className="text-sm text-gray-400 text-center">En attente que l'hôte lance la partie…</p>
          )}
        </div>
      </div>
    )
  }

  if (step === 'config') {
    const maxUndercover = maxUndercoverCount(players.length)
    return (
      <div className="overflow-y-auto h-full bg-gray-50 pb-24">
        <GameHeader title="Répartition des rôles" onBack={() => setStep('lobby')} />
        <div className="px-4 mt-5 space-y-6">
          <RemoteCountPicker label="Nombre d'undercover" value={undercoverCount} min={1} max={maxUndercover} onChange={setUndercoverCount} />
          <RemoteCountPicker label="Nombre de Mr. White" value={mrWhiteCount} min={0} max={1} onChange={setMrWhiteCount} />
          {isHost ? (
            <button onClick={handleStartGame} className="w-full rounded-2xl bg-dark py-4 text-base font-black text-white shadow-lg shadow-dark/30 active:opacity-90">
              Lancer la partie
            </button>
          ) : (
            <p className="text-sm text-gray-400 text-center">En attente que l'hôte lance la partie…</p>
          )}
        </div>
      </div>
    )
  }

  if (step === 'reveal') {
    return (
      <div className="h-full flex flex-col bg-gray-50">
        <GameHeader title="Ton rôle" onBack={handleExit} />
        <div className="flex-1 flex flex-col items-center justify-center px-6 text-center">
          {myRole === null ? (
            <p className="text-sm text-gray-400">Chargement…</p>
          ) : myRole === 'MrWhite' ? (
            <>
              <p className="text-3xl mb-3">🎭</p>
              <p className="text-lg font-extrabold text-gray-800 mb-1">Tu es Mr. White !</p>
              <p className="text-sm text-gray-500 max-w-xs">Tu n'as aucun mot. Bluffe en donnant un indice crédible sans te faire démasquer.</p>
            </>
          ) : (
            <>
              <p className="text-xs font-bold text-gray-400 uppercase tracking-wide mb-2">Ton mot secret</p>
              <p className="text-3xl font-black text-gray-800 mb-1">{myWord}</p>
              <p className="text-xs text-gray-400 mt-2">Donne un indice à voix haute sans jamais le répéter.</p>
            </>
          )}
          <button
            onClick={() => setStep('playing')}
            className="mt-8 w-full max-w-xs rounded-2xl bg-primary py-4 text-sm font-bold text-white shadow-lg active:bg-primary-dark"
          >
            J'ai compris
          </button>
        </div>
      </div>
    )
  }

  if (step === 'results') {
    return (
      <div className="overflow-y-auto h-full bg-gray-50 pb-24">
        <div className="bg-dark px-5 pt-8 pb-9 text-center rounded-b-[32px]">
          <p className="text-3xl">🎉</p>
          <h2 className="text-xl font-black text-white mt-1.5">{finalWinnerName} gagne{finalWinnerName?.startsWith('Les') ? 'nt' : ''} !</h2>
          <p className="text-xs font-semibold text-white/70 mt-1">Undercover{gameDuration != null ? ` · ${formatDuration(gameDuration)}` : ''}</p>
        </div>

        <div className="px-4 mt-6 space-y-4">
          <div className="rounded-2xl bg-white shadow-sm divide-y divide-gray-50 overflow-hidden">
            {finalPlayers.map(p => (
              <div key={p.memberId} className="flex items-center gap-3 px-4 py-3">
                <Avatar name={p.name} size="sm" />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-bold text-gray-800 truncate">{p.name}</p>
                  {p.word && <p className="text-xs text-gray-400">{p.word}</p>}
                </div>
                <span className="text-xs font-bold text-primary bg-primary/10 rounded-full px-2.5 py-1">{ROLE_LABELS[p.role] ?? p.role}</span>
              </div>
            ))}
          </div>

          <div className="flex gap-2.5">
            {isHost && (
              <button onClick={() => gameHub.playAgain().catch(() => {})} className="flex-1 rounded-2xl bg-primary py-3.5 text-sm font-bold text-white active:bg-primary-dark">
                Rejouer
              </button>
            )}
            <button onClick={handleExit} className={`${isHost ? 'flex-1' : 'w-full'} rounded-2xl bg-white shadow-sm py-3.5 text-sm font-bold text-gray-600 active:bg-gray-50`}>
              Quitter
            </button>
          </div>
        </div>
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
              {alivePlayers.length} en vie
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
        </div>

        <div className="flex-1 overflow-y-auto px-4 py-4">
          {phase === 'clue' && (
            <div className="text-center mb-6">
              <p className="text-xs font-semibold text-gray-400 mb-3">Indice à voix haute, sans dire le mot</p>
              <Avatar src={players.find(p => p.memberId === currentSpeakerMemberId)?.profilePictureUrl} name={players.find(p => p.memberId === currentSpeakerMemberId)?.name} size="lg" className="mx-auto mb-2" />
              <p className="text-lg font-black text-gray-800">{players.find(p => p.memberId === currentSpeakerMemberId)?.name}</p>
              {isHost && (
                <button
                  onClick={() => gameHub.advanceUndercoverTurn().catch(() => {})}
                  className="mt-4 w-full max-w-xs mx-auto block rounded-2xl bg-primary py-3.5 text-sm font-bold text-white shadow-lg active:bg-primary-dark"
                >
                  Joueur suivant
                </button>
              )}
            </div>
          )}

          {phase === 'vote' && (
            <div>
              <p className="text-center text-sm font-bold text-gray-700 mb-1">Qui est démasqué comme suspect ?</p>
              <p className="text-center text-xs text-gray-400 mb-4">{voteProgress.voted}/{voteProgress.total} ont voté</p>
              <div className="grid grid-cols-3 gap-3">
                {alivePlayers.map(p => (
                  <button
                    key={p.memberId}
                    onClick={() => handleVote(p.memberId)}
                    disabled={!!myVote || !amAlive}
                    className={`flex flex-col items-center gap-1.5 rounded-2xl p-3 transition-all disabled:opacity-100 ${
                      myVote === p.memberId ? 'bg-primary/15 ring-2 ring-primary' : 'bg-white shadow-sm active:opacity-80'
                    }`}
                  >
                    <Avatar src={p.profilePictureUrl} name={p.name} size="md" />
                    <span className="text-xs font-semibold text-gray-700 truncate max-w-full">{p.name.split(' ')[0]}</span>
                  </button>
                ))}
              </div>
              {isHost && (
                <button
                  onClick={() => gameHub.forceResolveUndercoverVote().catch(() => {})}
                  className="w-full mt-5 rounded-xl bg-white shadow-sm py-2.5 text-sm font-semibold text-gray-500 active:bg-gray-50"
                >
                  Forcer la résolution du vote
                </button>
              )}
            </div>
          )}
        </div>
      </div>

      {phase === 'eliminated' && lastElimination && (
        <div className="fixed inset-0 z-30 bg-black/40 flex items-center justify-center px-6 py-10">
          <div className="w-full max-w-xs max-h-full overflow-y-auto rounded-3xl bg-white shadow-xl p-6 text-center space-y-4">
            {lastElimination.tie ? (
              <>
                <p className="text-3xl">🤝</p>
                <p className="text-lg font-extrabold text-gray-800">Égalité, personne n'est éliminé</p>
              </>
            ) : (
              <>
                <Avatar name={players.find(p => p.memberId === lastElimination.eliminatedMemberId)?.name} size="lg" className="mx-auto" />
                <p className="text-lg font-extrabold text-gray-800">
                  {players.find(p => p.memberId === lastElimination.eliminatedMemberId)?.name} était...
                </p>
                <p className="text-2xl font-black text-primary">{ROLE_LABELS[lastElimination.role] ?? lastElimination.role}</p>
                {lastElimination.word && <p className="text-sm text-gray-400">Mot : {lastElimination.word}</p>}
              </>
            )}

            {awaitingMyGuess && !mrWhiteGuessResult && (
              <form onSubmit={handleSubmitMrWhiteGuess} className="space-y-2">
                <p className="text-xs font-semibold text-gray-500">Dernière chance : devine le mot des civils pour gagner quand même !</p>
                <div className="flex items-center gap-2">
                  <input
                    value={mrWhiteGuessInput}
                    onChange={e => setMrWhiteGuessInput(e.target.value)}
                    placeholder="Mot des civils..."
                    className="flex-1 min-w-0 rounded-xl border border-gray-200 bg-white px-3.5 py-2.5 text-sm font-semibold focus:outline-none focus:border-primary"
                  />
                  <button type="submit" className="shrink-0 rounded-xl bg-primary px-4 py-2.5 text-sm font-bold text-white active:bg-primary-dark">
                    Tenter
                  </button>
                </div>
              </form>
            )}
            {lastElimination.awaitingMrWhiteGuess && !mrWhiteGuessResult && !awaitingMyGuess && (
              <p className="text-xs text-gray-400">En attente de la tentative de Mr. White…</p>
            )}

            {mrWhiteGuessResult && (
              <p className={`text-sm font-bold ${mrWhiteGuessResult.correct ? 'text-green-600' : 'text-red-500'}`}>
                {mrWhiteGuessResult.correct ? `C'était "${mrWhiteGuessResult.civilianWord}" ! Mr. White gagne !` : `Raté, c'était "${mrWhiteGuessResult.civilianWord}".`}
              </p>
            )}

            {(lastElimination.tie || !lastElimination.awaitingMrWhiteGuess || mrWhiteGuessResult) && (
              isHost ? (
                <button onClick={handleContinue} className="w-full rounded-xl bg-primary py-3.5 text-sm font-semibold text-white active:bg-primary-dark">
                  {lastElimination.finished || mrWhiteGuessResult?.correct ? 'Voir les résultats' : 'Manche suivante'}
                </button>
              ) : (
                <p className="text-xs text-gray-400">En attente de l'hôte pour continuer…</p>
              )
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

function RemoteCountPicker({ label, value, min, max, onChange }) {
  const options = []
  for (let n = min; n <= max; n++) options.push(n)
  return (
    <div>
      <h2 className="text-xs font-bold text-gray-400 uppercase tracking-wide mb-2.5">{label}</h2>
      <div className="flex gap-2.5">
        {options.map(n => (
          <button
            key={n}
            onClick={() => onChange(n)}
            className={`flex-1 rounded-2xl py-3 text-sm font-black transition-colors ${
              value === n ? 'bg-primary text-white shadow-md shadow-primary/30' : 'bg-white text-gray-600 shadow-sm'
            }`}
          >
            {n}
          </button>
        ))}
      </div>
    </div>
  )
}
