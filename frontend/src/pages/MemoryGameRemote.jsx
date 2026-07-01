import { useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'
import { useMembers } from '../store/MembersContext'
import { useUiChrome } from '../store/UiChromeContext'
import { connectHub, disconnectHub, gameHub, onHubEvent } from '../services/gameHub'
import { membersWithPhoto, PLAYER_COLORS } from '../utils/memoryGame'
import GameHeader from '../components/games/GameHeader'
import DifficultySetupStep from '../components/games/DifficultySetupStep'
import SpinWheel from '../components/games/SpinWheel'
import MemoryBoard from '../components/games/MemoryBoard'
import GameResultsScreen from '../components/games/GameResultsScreen'
import Avatar from '../components/shared/Avatar'

const FLIP_BACK_DELAY = 900
const MATCH_DELAY = 300

export default function MemoryGameRemote() {
  const navigate = useNavigate()
  const { user } = useAuth()
  const { members } = useMembers()
  const { setHideChrome } = useUiChrome()
  const photoCount = membersWithPhoto(members).length
  const deckRef = useRef([])

  const [step, setStep] = useState('menu')
  const [joinCodeInput, setJoinCodeInput] = useState('')
  const [error, setError] = useState('')
  const [connecting, setConnecting] = useState(false)

  const [code, setCode] = useState('')
  const [players, setPlayers] = useState([])
  const [pairsCount, setPairsCount] = useState(null)
  const [deck, setDeck] = useState([])
  const [flipped, setFlipped] = useState([])
  const [matchedBy, setMatchedBy] = useState(new Map())
  const [currentColorIndex, setCurrentColorIndex] = useState(0)
  const [locked, setLocked] = useState(false)
  const [remainingColorIndexes, setRemainingColorIndexes] = useState([])
  const [pendingWinnerId, setPendingWinnerId] = useState(null)
  const [finalPlayers, setFinalPlayers] = useState([])
  const [gameDuration, setGameDuration] = useState(null)
  const [codeCopied, setCodeCopied] = useState(false)

  const me = players.find(p => p.memberId === user?.memberId)
  const myColorIndex = me?.colorIndex
  const isHost = me?.isHost ?? false

  useEffect(() => {
    setHideChrome(step === 'playing')
    return () => setHideChrome(false)
  }, [step, setHideChrome])

  useEffect(() => {
    if (flipped.length >= 2) setLocked(true)
  }, [flipped])

  useEffect(() => {
    connectHub().catch(() => setError('Connexion impossible.'))
    return () => {
      gameHub.leaveRoom().catch(() => {})
      disconnectHub()
    }
  }, [])

  useEffect(() => {
    const offs = [
      onHubEvent('PlayerJoined', setPlayers),
      onHubEvent('PlayerLeft', setPlayers),
      onHubEvent('GameCancelled', () => {
        setError('La partie a été annulée (un joueur a quitté).')
        setStep('menu')
      }),
      onHubEvent('GameStarting', (payload) => {
        deckRef.current = payload.deck
        setDeck(payload.deck)
        setPlayers(payload.players)
        setPairsCount(payload.pairsCount)
        setFlipped([])
        setMatchedBy(new Map())
        setRemainingColorIndexes(payload.players.map(p => p.colorIndex))
        setStep('order')
      }),
      onHubEvent('WheelSpun', ({ winnerColorIndex }) => {
        setPendingWinnerId(winnerColorIndex)
      }),
      onHubEvent('TurnOrderReady', ({ orderedColorIndexes }) => {
        setRemainingColorIndexes([])
        setCurrentColorIndex(orderedColorIndexes[0])
        setTimeout(() => setStep('playing'), 900)
      }),
      onHubEvent('CardFlipped', ({ cardId }) => {
        setFlipped(prev => prev.includes(cardId) ? prev : [...prev, cardId])
      }),
      onHubEvent('TurnResolved', ({ matched, cardIds, scorerColorIndex, nextPlayerColorIndex }) => {
        setTimeout(() => {
          if (matched) {
            const memberId = deckRef.current.find(c => c.cardId === cardIds[0])?.memberId
            if (memberId) setMatchedBy(prev => new Map(prev).set(memberId, scorerColorIndex))
            setPlayers(prev => prev.map(p => p.colorIndex === scorerColorIndex ? { ...p, score: p.score + 1 } : p))
          }
          setFlipped([])
          setCurrentColorIndex(nextPlayerColorIndex)
          setLocked(false)
        }, matched ? MATCH_DELAY : FLIP_BACK_DELAY)
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
      const res = await gameHub.createRoom('memory')
      if (!res.success) { setError(res.error); return }
      setCode(res.code)
      setPlayers(res.players)
      setStep('lobby')
    } catch {
      setError('Impossible de créer la partie.')
    } finally {
      setConnecting(false)
    }
  }

  async function handleJoinRoom() {
    if (!joinCodeInput.trim()) return
    setConnecting(true)
    setError('')
    try {
      await connectHub()
      const res = await gameHub.joinRoom(joinCodeInput.trim().toUpperCase())
      if (!res.success) { setError(res.error); return }
      setCode(res.code)
      setPlayers(res.players)
      setStep('lobby')
    } catch {
      setError('Impossible de rejoindre la partie.')
    } finally {
      setConnecting(false)
    }
  }

  function handleChooseDifficulty(count) {
    gameHub.startGame(count).catch(() => {})
  }

  function handleWheelSpinEnd(item) {
    setRemainingColorIndexes(prev => prev.filter(ci => ci !== item.id))
    setPendingWinnerId(null)
  }

  function handleCardClick(card) {
    if (locked || currentColorIndex !== myColorIndex) return
    if (flipped.includes(card.cardId) || matchedBy.has(card.memberId)) return
    gameHub.flipCard(card.cardId).catch(() => {})
  }

  async function handleCopyCode() {
    await navigator.clipboard.writeText(code)
    setCodeCopied(true)
    setTimeout(() => setCodeCopied(false), 2000)
  }

  function handleExit() {
    gameHub.leaveRoom().catch(() => {})
    navigate('/games')
  }

  if (step === 'menu') {
    return (
      <div className="overflow-y-auto h-full bg-gray-50 pb-24">
        <GameHeader title="Memory à distance" onBack={() => navigate('/games/memory')} />
        <div className="px-4 mt-6 space-y-5">
          {error && <p className="rounded-xl bg-red-50 px-4 py-3 text-sm text-red-600 text-center">{error}</p>}

          <button
            onClick={handleCreateRoom}
            disabled={connecting}
            className="w-full rounded-xl bg-primary py-3.5 text-sm font-semibold text-white active:bg-primary-dark disabled:opacity-50"
          >
            Créer une partie
          </button>

          <div className="rounded-2xl bg-white shadow-sm p-4 space-y-3">
            <p className="text-sm font-semibold text-gray-600">Rejoindre avec un code</p>
            <input
              value={joinCodeInput}
              onChange={e => setJoinCodeInput(e.target.value.toUpperCase())}
              placeholder="ABCDE"
              maxLength={5}
              className="w-full rounded-xl bg-gray-50 border border-gray-200 px-4 py-3 text-center text-lg font-bold tracking-[0.3em] uppercase focus:outline-none focus:ring-2 focus:ring-primary"
            />
            <button
              onClick={handleJoinRoom}
              disabled={connecting || !joinCodeInput.trim()}
              className="w-full rounded-xl bg-primary/10 py-3 text-sm font-semibold text-primary active:bg-primary/20 disabled:opacity-50"
            >
              Rejoindre
            </button>
          </div>
        </div>
      </div>
    )
  }

  if (step === 'lobby') {
    return (
      <div className="overflow-y-auto h-full bg-gray-50 pb-24">
        <GameHeader title="Salon d'attente" onBack={handleExit} />
        <div className="px-4 mt-6 flex flex-col items-center">
          <p className="text-sm text-gray-500 mb-2">Code de la partie</p>
          <p className="text-4xl font-black tracking-[0.3em] text-primary mb-3">{code}</p>
          <button
            onClick={handleCopyCode}
            className="mb-6 flex items-center gap-1.5 rounded-full bg-white shadow-sm px-4 py-2 text-xs font-semibold text-gray-600 active:bg-gray-50"
          >
            {codeCopied ? (
              'Copié !'
            ) : (
              <>
                <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                </svg>
                Copier le code
              </>
            )}
          </button>

          <div className="w-full rounded-2xl bg-white shadow-sm divide-y divide-gray-50 overflow-hidden mb-6">
            {players.map(p => (
              <div key={p.memberId} className="flex items-center gap-3 px-4 py-3">
                <Avatar src={p.profilePictureUrl} name={p.name} size="sm" />
                <span className="flex-1 text-sm font-medium text-gray-800">{p.name}</span>
                {p.isHost && <span className="text-[10px] font-semibold text-primary bg-primary/10 rounded-full px-2 py-0.5">Hôte</span>}
              </div>
            ))}
          </div>

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
        <GameHeader title="Memory à distance" onBack={() => setStep('lobby')} />
        <DifficultySetupStep photoCount={photoCount} onBack={() => setStep('lobby')} onStart={handleChooseDifficulty} />
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
        <GameHeader title="Résultats" onBack={handleExit} />
        <GameResultsScreen
          players={finalPlayers.map(p => ({ name: p.name, score: p.score, memberId: p.memberId, isGuest: false }))}
          pairsCount={pairsCount}
          durationSeconds={gameDuration}
          alreadySubmitted
          canReplay={isHost}
          onReplay={() => gameHub.playAgain().catch(() => {})}
          onExit={handleExit}
        />
      </div>
    )
  }

  // step === 'playing'
  const activePlayer = players.find(p => p.colorIndex === currentColorIndex)
  return (
    <div className="h-full bg-gray-50 overflow-hidden flex flex-col">
      <div className="px-4 pt-10 pb-2 shrink-0">
        <p className="text-center text-sm font-semibold text-gray-500 mb-2">
          {currentColorIndex === myColorIndex ? 'À vous de jouer !' : `Au tour de ${activePlayer?.name ?? ''}`}
        </p>
        <div className="flex gap-2">
          {players.map(p => {
            const isActive = p.colorIndex === currentColorIndex
            const color = PLAYER_COLORS[p.colorIndex % PLAYER_COLORS.length]
            return (
              <div
                key={p.memberId}
                className={`flex-1 flex items-center gap-2 rounded-2xl py-1.5 px-2 transition-all duration-200 ${
                  isActive ? 'bg-primary shadow-md scale-105' : 'bg-white shadow-sm'
                }`}
              >
                <Avatar
                  src={p.profilePictureUrl}
                  name={p.name}
                  size="xs"
                  className={`ring-2 shrink-0 ${isActive ? 'ring-white' : color.ring}`}
                />
                <div className="min-w-0 flex-1">
                  <p className={`text-[11px] font-semibold truncate ${isActive ? 'text-white' : 'text-gray-600'}`}>
                    {p.name.split(' ')[0]}
                  </p>
                  <p className={`text-xs font-bold ${isActive ? 'text-white' : color.text}`}>{p.score}</p>
                </div>
              </div>
            )
          })}
        </div>
      </div>

      <div className="flex-1 min-h-0 px-4 pb-4">
        <MemoryBoard
          deck={deck}
          flippedIds={flipped}
          matchedBy={matchedBy}
          onCardClick={handleCardClick}
          disabled={locked || currentColorIndex !== myColorIndex}
        />
      </div>
    </div>
  )
}
