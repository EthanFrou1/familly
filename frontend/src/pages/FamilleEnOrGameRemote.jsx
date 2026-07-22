import { useEffect, useRef, useState } from 'react'
import { useLocation, useNavigate, useSearchParams } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'
import { useUiChrome } from '../store/UiChromeContext'
import { connectHub, gameHub, onHubEvent } from '../services/gameHub'
import { gamesApi } from '../services/api'
import { formatDuration } from '../utils/memoryGame'
import GameHeader from '../components/games/GameHeader'
import DifficultySetupStep from '../components/games/DifficultySetupStep'
import DotsIcon from '../components/games/DotsIcon'
import Avatar from '../components/shared/Avatar'
import ChallengeButton from '../components/games/ChallengeButton'

const ROUND_PRESETS = [
  { label: 'Court', value: 4, emoji: '🌱', minRequired: 4 },
  { label: 'Moyen', value: 6, emoji: '🌳', minRequired: 4 },
  { label: 'Long', value: 8, emoji: '🔥', minRequired: 4 },
]

const MIN_PER_TEAM = 2

export default function FamilleEnOrGameRemote() {
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
  const [faceOffMemberIds, setFaceOffMemberIds] = useState([])
  const [phase, setPhase] = useState('faceoff')
  const [controllingTeamIndex, setControllingTeamIndex] = useState(null)
  const [stealingTeamIndex, setStealingTeamIndex] = useState(null)
  const [strikes, setStrikes] = useState(0)
  const [pot, setPot] = useState(0)
  const [answerDraft, setAnswerDraft] = useState('')
  const [reveal, setReveal] = useState(null)
  const [finalPlayers, setFinalPlayers] = useState([])
  const [finalWinnerName, setFinalWinnerName] = useState(null)
  const [gameDuration, setGameDuration] = useState(null)
  const [elapsedSeconds, setElapsedSeconds] = useState(0)
  const startTimeRef = useRef(null)

  const me = players.find(p => p.memberId === user?.memberId)
  const isHost = me?.isHost ?? false
  const team0 = players.filter(p => p.teamIndex === 0)
  const team1 = players.filter(p => p.teamIndex === 1)
  const team0Score = team0[0]?.score ?? 0
  const team1Score = team1[0]?.score ?? 0
  const canStart = team0.length >= MIN_PER_TEAM && team1.length >= MIN_PER_TEAM

  const iAmFaceOff = !!me && faceOffMemberIds.includes(me.memberId)
  const myAnswerTurn = phase === 'control'
    ? me?.teamIndex === controllingTeamIndex
    : phase === 'steal'
      ? me?.teamIndex === stealingTeamIndex
      : false

  useEffect(() => {
    setHideChrome(step === 'playing')
    return () => setHideChrome(false)
  }, [step, setHideChrome])

  useEffect(() => {
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
    const interval = setInterval(() => {
      setElapsedSeconds(Math.floor((Date.now() - startTimeRef.current) / 1000))
    }, 1000)
    return () => clearInterval(interval)
  }, [step])

  useEffect(() => {
    const offs = [
      onHubEvent('PlayerJoined', setPlayers),
      onHubEvent('PlayerLeft', setPlayers),
      onHubEvent('GameCancelled', () => {
        setError('La partie a été annulée (un joueur a quitté).')
        setStep('menu')
      }),
      onHubEvent('FamilleEnOrRoundStarting', (payload) => {
        setPlayers(payload.players)
        setRoundCount(payload.roundCount)
        setRoundIndex(0)
        setCurrentRound(payload.round)
        setFaceOffMemberIds(payload.faceOffMemberIds)
        setPhase('faceoff')
        setControllingTeamIndex(null)
        setStealingTeamIndex(null)
        setStrikes(0)
        setPot(0)
        setAnswerDraft('')
        setReveal(null)
        setElapsedSeconds(0)
        startTimeRef.current = Date.now()
        setStep('playing')
      }),
      onHubEvent('BuzzWon', ({ teamIndex }) => {
        setControllingTeamIndex(teamIndex)
        setPhase('control')
      }),
      onHubEvent('AnswerRevealed', ({ slotIndex, label, points }) => {
        setCurrentRound(prev => {
          if (!prev) return prev
          const slots = [...prev.slots]
          slots[slotIndex] = { ...slots[slotIndex], label, points, revealed: true }
          return { ...prev, slots }
        })
      }),
      onHubEvent('StrikeAdded', ({ strikes }) => setStrikes(strikes)),
      onHubEvent('StealPhase', ({ stealingTeamIndex }) => {
        setPhase('steal')
        setStealingTeamIndex(stealingTeamIndex)
      }),
      onHubEvent('FamilleEnOrRoundResolved', ({ winningTeamIndex, pointsAwarded, slots, isLastRound }) => {
        setReveal({ winningTeamIndex, pointsAwarded, slots, isLastRound })
        setCurrentRound(prev => prev ? { ...prev, slots: slots.map(s => ({ ...s, revealed: true })) } : prev)
        setPlayers(prev => prev.map(p => p.teamIndex === winningTeamIndex ? { ...p, score: p.score + pointsAwarded } : p))
      }),
      onHubEvent('FamilleEnOrNextRound', ({ round, faceOffMemberIds }) => {
        setCurrentRound(round)
        setRoundIndex(i => i + 1)
        setFaceOffMemberIds(faceOffMemberIds)
        setPhase('faceoff')
        setControllingTeamIndex(null)
        setStealingTeamIndex(null)
        setStrikes(0)
        setPot(0)
        setAnswerDraft('')
        setReveal(null)
      }),
      onHubEvent('GameFinished', ({ players: finished, durationSeconds, winnerName }) => {
        setFinalPlayers(finished)
        setGameDuration(durationSeconds)
        setFinalWinnerName(winnerName ?? null)
        setStep('results')
      }),
      onHubEvent('BackToDifficulty', () => setStep('teams')),
    ]
    return () => offs.forEach(off => off())
  }, [])

  // Le pot affiché est simplement la somme des points des slots révélés du round en cours :
  // pas besoin de le suivre séparément côté client, moins de risque de désynchro avec le serveur.
  useEffect(() => {
    if (!currentRound) { setPot(0); return }
    setPot(currentRound.slots.filter(s => s.revealed).reduce((sum, s) => sum + (s.points ?? 0), 0))
  }, [currentRound])

  async function handleCreateRoom() {
    setConnecting(true)
    setError('')
    try {
      await connectHub()
      const res = await gameHub.createRoom('famillenor')
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

  function handleAssignTeam(memberId, teamIndex) {
    if (!isHost) return
    gameHub.assignTeam(memberId, teamIndex).catch(() => {})
  }

  function handleChooseRoundCount(count) {
    gameHub.startFamilleEnOrGame(count).catch(() => {})
  }

  function handleBuzz() {
    gameHub.buzz().catch(() => {})
  }

  function handleSubmitAnswer(e) {
    e.preventDefault()
    const text = answerDraft.trim()
    if (!text) return
    setAnswerDraft('')
    gameHub.submitTeamAnswer(text).catch(() => {})
  }

  function handleContinue() {
    if (!isHost) return
    gameHub.continueFamilleEnOrRound().catch(() => {})
  }

  function handleExit() {
    gameHub.leaveRoom().catch(() => {})
    navigate('/games')
  }

  if (step === 'menu') {
    return (
      <div className="overflow-y-auto h-full bg-gray-50 pb-24">
        <GameHeader title="Une Famille en Or" onBack={() => navigate('/games')} />
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
              Visible par ta famille dans l'onglet Parties ouvertes. Jusqu'à 8 joueurs (2 équipes).
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

          {isHost && <ChallengeButton gameType="famillenor" roomCode={roomCode} excludedMemberIds={players.map(p => p.memberId)} />}

          {isHost ? (
            <button
              onClick={() => setStep('teams')}
              disabled={players.length < 2 * MIN_PER_TEAM}
              className="w-full rounded-xl bg-primary py-3.5 text-sm font-semibold text-white active:bg-primary-dark disabled:opacity-40"
            >
              {players.length < 2 * MIN_PER_TEAM ? `En attente de joueurs (min. ${2 * MIN_PER_TEAM})…` : 'Former les équipes'}
            </button>
          ) : (
            <p className="text-sm text-gray-400 text-center">En attente que l'hôte lance la partie…</p>
          )}
        </div>
      </div>
    )
  }

  if (step === 'teams') {
    return (
      <div className="overflow-y-auto h-full bg-gray-50 pb-24">
        <GameHeader title="Former les équipes" onBack={() => setStep('lobby')} subtitle={isHost ? 'Tape sur un joueur pour l\'assigner' : undefined} />
        <div className="px-4 mt-6 space-y-4">
          {!isHost && <p className="text-sm text-gray-400 text-center">En attente que l'hôte forme les équipes…</p>}

          <div className="grid grid-cols-2 gap-3">
            <TeamColumn label="Équipe 1" color="primary" roster={team0} />
            <TeamColumn label="Équipe 2" color="dark" roster={team1} />
          </div>

          {isHost && (
            <div className="rounded-2xl bg-white shadow-sm divide-y divide-gray-50 overflow-hidden">
              {players.map(p => (
                <div key={p.memberId} className="flex items-center gap-3 px-4 py-3">
                  <Avatar src={p.profilePictureUrl} name={p.name} size="sm" />
                  <span className="flex-1 text-sm font-medium text-gray-800 truncate">{p.name}</span>
                  <div className="flex gap-1.5 shrink-0">
                    <button
                      onClick={() => handleAssignTeam(p.memberId, 0)}
                      className={`text-[11px] font-bold rounded-full px-2.5 py-1 ${p.teamIndex === 0 ? 'bg-primary text-white' : 'bg-gray-100 text-gray-500'}`}
                    >
                      Équipe 1
                    </button>
                    <button
                      onClick={() => handleAssignTeam(p.memberId, 1)}
                      className={`text-[11px] font-bold rounded-full px-2.5 py-1 ${p.teamIndex === 1 ? 'bg-dark text-white' : 'bg-gray-100 text-gray-500'}`}
                    >
                      Équipe 2
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}

          {isHost && (
            <button
              onClick={() => setStep('difficulty')}
              disabled={!canStart}
              className="w-full rounded-xl bg-primary py-3.5 text-sm font-semibold text-white active:bg-primary-dark disabled:opacity-40"
            >
              {canStart ? 'Continuer' : `Il faut au moins ${MIN_PER_TEAM} joueurs par équipe`}
            </button>
          )}
        </div>
      </div>
    )
  }

  if (step === 'difficulty') {
    return (
      <div className="overflow-y-auto h-full bg-gray-50 pb-24">
        <GameHeader title="Une Famille en Or" onBack={() => setStep('teams')} />
        <DifficultySetupStep
          photoCount={players.length}
          onStart={handleChooseRoundCount}
          presets={ROUND_PRESETS}
          unitLabel="manches"
          sectionLabel="Nombre de manches"
        />
      </div>
    )
  }

  if (step === 'results') {
    return (
      <FamilleEnOrResultsScreen
        finalPlayers={finalPlayers}
        roundCount={roundCount}
        durationSeconds={gameDuration}
        winnerName={finalWinnerName}
        canReplay={isHost}
        onReplay={() => gameHub.playAgain().catch(() => {})}
        onExit={handleExit}
      />
    )
  }

  // step === 'playing'
  const controllingLabel = controllingTeamIndex === 0 ? 'Équipe 1' : controllingTeamIndex === 1 ? 'Équipe 2' : null
  const stealingLabel = stealingTeamIndex === 0 ? 'Équipe 1' : stealingTeamIndex === 1 ? 'Équipe 2' : null

  return (
    <div className="relative h-full bg-gray-50 overflow-hidden">
      <div className="h-full flex flex-col">
        <div className="px-4 pt-10 pb-2 shrink-0">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-bold text-primary bg-white rounded-full px-3 py-1 shadow-sm">
              Manche {roundIndex + 1}/{roundCount}
            </span>
            <span className="text-xs font-mono font-semibold text-gray-400 bg-white rounded-full px-2.5 py-1 shadow-sm">
              ⏱ {formatDuration(elapsedSeconds)}
            </span>
          </div>
          <div className="flex items-center gap-2">
            <TeamScoreChip label="Équipe 1" score={team0Score} active={controllingTeamIndex === 0} />
            <span className="text-xs font-bold text-gray-300">VS</span>
            <TeamScoreChip label="Équipe 2" score={team1Score} active={controllingTeamIndex === 1} />
          </div>
        </div>

        <div className="flex-1 overflow-y-auto px-4 py-4">
          <p className="text-center text-lg font-extrabold text-gray-800 mb-3">{currentRound?.prompt}</p>

          <div className="space-y-1.5 mb-4">
            {currentRound?.slots.map((s, i) => (
              <div
                key={i}
                className={`flex items-center justify-between rounded-xl px-4 py-2.5 ${s.revealed ? 'bg-primary/10' : 'bg-white shadow-sm'}`}
              >
                <span className="text-sm font-bold text-gray-700">
                  {s.revealed ? s.label : `Réponse #${i + 1}`}
                </span>
                {s.revealed && <span className="text-sm font-black text-primary">{s.points} pt{s.points > 1 ? 's' : ''}</span>}
              </div>
            ))}
          </div>

          <div className="flex items-center justify-center gap-4 mb-4">
            <span className="text-sm font-bold text-gray-500">Pot : {pot} pt{pot > 1 ? 's' : ''}</span>
            <span className="flex gap-1">
              {[0, 1, 2].map(i => (
                <span key={i} className={`text-lg font-black ${i < strikes ? 'text-red-500' : 'text-gray-200'}`}>✗</span>
              ))}
            </span>
          </div>

          {phase === 'faceoff' && (
            <div className="text-center">
              <p className="text-xs font-semibold text-gray-400 mb-3">Face-off : le premier à buzzer prend la main pour son équipe</p>
              {iAmFaceOff ? (
                <button
                  onClick={handleBuzz}
                  className="mx-auto h-28 w-28 rounded-full bg-primary text-white text-lg font-black shadow-lg active:scale-95 transition-transform"
                >
                  BUZZ !
                </button>
              ) : (
                <p className="text-sm text-gray-400">En attente du face-off entre {faceOffMemberIds
                  .map(id => players.find(p => p.memberId === id)?.name?.split(' ')[0])
                  .filter(Boolean).join(' et ')}…</p>
              )}
            </div>
          )}

          {phase === 'control' && (
            <div className="text-center">
              <p className="text-xs font-semibold text-gray-400 mb-3">{controllingLabel} a la main</p>
              {myAnswerTurn ? (
                <form onSubmit={handleSubmitAnswer} className="flex items-center gap-2">
                  <input
                    value={answerDraft}
                    onChange={e => setAnswerDraft(e.target.value)}
                    placeholder="Votre réponse..."
                    className="flex-1 min-w-0 rounded-xl border border-gray-200 bg-white px-3.5 py-2.5 text-sm font-semibold focus:outline-none focus:border-primary"
                  />
                  <button type="submit" className="shrink-0 rounded-xl bg-primary px-4 py-2.5 text-sm font-bold text-white active:bg-primary-dark">
                    Valider
                  </button>
                </form>
              ) : (
                <p className="text-sm text-gray-400">En attente d'une réponse de {controllingLabel}…</p>
              )}
            </div>
          )}

          {phase === 'steal' && (
            <div className="text-center">
              <p className="text-xs font-semibold text-red-500 mb-3">3 fautes ! {stealingLabel} peut voler la banque</p>
              {myAnswerTurn ? (
                <form onSubmit={handleSubmitAnswer} className="flex items-center gap-2">
                  <input
                    value={answerDraft}
                    onChange={e => setAnswerDraft(e.target.value)}
                    placeholder="Un seul essai pour l'équipe..."
                    className="flex-1 min-w-0 rounded-xl border border-gray-200 bg-white px-3.5 py-2.5 text-sm font-semibold focus:outline-none focus:border-red-400"
                  />
                  <button type="submit" className="shrink-0 rounded-xl bg-red-500 px-4 py-2.5 text-sm font-bold text-white active:bg-red-600">
                    Tenter
                  </button>
                </form>
              ) : (
                <p className="text-sm text-gray-400">En attente de la tentative de {stealingLabel}…</p>
              )}
            </div>
          )}

          {isHost && !reveal && (
            <button
              onClick={() => gameHub.forceResolveFamilleEnOrRound().catch(() => {})}
              className="w-full mt-5 rounded-xl bg-white shadow-sm py-2.5 text-sm font-semibold text-gray-500 active:bg-gray-50"
            >
              Forcer la résolution
            </button>
          )}
        </div>
      </div>

      {reveal && (
        <div className="fixed inset-0 z-30 bg-black/40 flex items-center justify-center px-6 py-10">
          <div className="w-full max-w-xs max-h-full overflow-y-auto rounded-3xl bg-white shadow-xl p-6 text-center space-y-4">
            <p className="text-3xl">{reveal.winningTeamIndex === 0 ? '🟦' : '🟥'}</p>
            <h2 className="text-lg font-black text-gray-800">
              {reveal.winningTeamIndex === 0 ? 'Équipe 1' : 'Équipe 2'} remporte {reveal.pointsAwarded} pt{reveal.pointsAwarded > 1 ? 's' : ''} !
            </h2>
            <div className="space-y-1.5 text-left">
              {reveal.slots.map((s, i) => (
                <div key={i} className="flex items-center justify-between rounded-xl bg-gray-50 px-3.5 py-2">
                  <span className="text-sm font-semibold text-gray-700">{s.label}</span>
                  <span className="text-sm font-black text-primary">{s.points}</span>
                </div>
              ))}
            </div>
            {isHost ? (
              <button
                onClick={handleContinue}
                className="w-full rounded-xl bg-primary py-3.5 text-sm font-semibold text-white active:bg-primary-dark"
              >
                {reveal.isLastRound ? 'Voir les résultats' : 'Manche suivante'}
              </button>
            ) : (
              <p className="text-xs text-gray-400">En attente de l'hôte pour continuer…</p>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

function TeamColumn({ label, color, roster }) {
  return (
    <div className="rounded-2xl bg-white shadow-sm p-3">
      <p className={`text-xs font-extrabold uppercase tracking-wide mb-2 text-${color}`}>{label} ({roster.length})</p>
      <div className="flex flex-wrap gap-1.5">
        {roster.map(p => (
          <Avatar key={p.memberId} src={p.profilePictureUrl} name={p.name} size="xs" />
        ))}
      </div>
    </div>
  )
}

function TeamScoreChip({ label, score, active }) {
  return (
    <div className={`flex-1 rounded-xl px-3 py-2 text-center ${active ? 'bg-primary text-white' : 'bg-white shadow-sm text-gray-700'}`}>
      <p className="text-[10px] font-bold uppercase tracking-wide opacity-80">{label}</p>
      <p className="text-lg font-black">{score}</p>
    </div>
  )
}

function FamilleEnOrResultsScreen({ finalPlayers, roundCount, durationSeconds, winnerName, canReplay, onReplay, onExit }) {
  const submitted = useRef(false)
  const team0 = finalPlayers.filter(p => p.teamIndex === 0)
  const team1 = finalPlayers.filter(p => p.teamIndex === 1)
  const team0Score = team0[0]?.score ?? 0
  const team1Score = team1[0]?.score ?? 0

  useEffect(() => {
    if (submitted.current) return
    submitted.current = true
    gamesApi.submitResult({
      gameType: 'famillenor',
      pairsCount: roundCount,
      players: finalPlayers.map(p => ({ name: p.name, score: p.score, memberId: p.memberId ?? null, isGuest: false })),
      winnerName,
      durationSeconds,
    }).catch(() => {})
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return (
    <div className="overflow-y-auto h-full bg-gray-50 pb-24">
      <div className="bg-dark px-5 pt-8 pb-9 text-center rounded-b-[32px]">
        <p className="text-3xl">{winnerName ? '🏆' : '🤝'}</p>
        <h2 className="text-xl font-black text-white mt-1.5">
          {winnerName ? `${winnerName} gagne !` : 'Égalité !'}
        </h2>
        <p className="text-xs font-semibold text-white/70 mt-1">
          Une Famille en Or · {roundCount} manches{durationSeconds != null ? ` · ${formatDuration(durationSeconds)}` : ''}
        </p>
      </div>

      <div className="px-4 -mt-5 grid grid-cols-2 gap-3">
        <TeamResultCard label="Équipe 1" score={team0Score} roster={team0} winner={team0Score > team1Score} />
        <TeamResultCard label="Équipe 2" score={team1Score} roster={team1} winner={team1Score > team0Score} />
      </div>

      <div className="px-4 mt-6 flex gap-2.5">
        {canReplay && (
          <button onClick={onReplay} className="flex-1 rounded-2xl bg-primary py-3.5 text-sm font-bold text-white active:bg-primary-dark">
            Rejouer
          </button>
        )}
        <button onClick={onExit} className={`${canReplay ? 'flex-1' : 'w-full'} rounded-2xl bg-white shadow-sm py-3.5 text-sm font-bold text-gray-600 active:bg-gray-50`}>
          Quitter
        </button>
      </div>
    </div>
  )
}

function TeamResultCard({ label, score, roster, winner }) {
  return (
    <div className={`rounded-2xl bg-white shadow-sm p-4 ${winner ? 'ring-2 ring-primary' : ''}`}>
      <p className="text-xs font-extrabold text-gray-400 uppercase tracking-wide">{label} {winner && '🏆'}</p>
      <p className="text-2xl font-black text-primary mt-1">{score}</p>
      <div className="flex flex-wrap gap-1 mt-2">
        {roster.map(p => (
          <Avatar key={p.memberId} name={p.name} size="xs" />
        ))}
      </div>
    </div>
  )
}
