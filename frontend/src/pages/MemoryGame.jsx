import { useState, useRef, useCallback, useEffect, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { useMembers } from '../store/MembersContext'
import { useUiChrome } from '../store/UiChromeContext'
import { buildDeck, preloadDeckImages, membersWithPhoto, formatDuration, PLAYER_COLORS } from '../utils/memoryGame'
import PlayerSetupStep from '../components/games/PlayerSetupStep'
import DifficultySetupStep from '../components/games/DifficultySetupStep'
import TurnOrderWheel from '../components/games/TurnOrderWheel'
import MemoryBoard from '../components/games/MemoryBoard'
import GameResultsScreen from '../components/games/GameResultsScreen'
import Avatar from '../components/shared/Avatar'

const FLIP_BACK_DELAY = 900
const MATCH_DELAY = 300

export default function MemoryGame() {
  const { members } = useMembers()
  const navigate = useNavigate()
  const { setHideChrome } = useUiChrome()
  const photoCount = membersWithPhoto(members).length
  const memberById = useMemo(() => new Map(members.map(m => [m.id, m])), [members])

  const [step, setStep] = useState('players')
  const [players, setPlayers] = useState([])
  const [pairsCount, setPairsCount] = useState(null)
  const [deck, setDeck] = useState([])
  const [currentPlayer, setCurrentPlayer] = useState(0)
  const [flipped, setFlipped] = useState([])
  const [matchedBy, setMatchedBy] = useState(new Map())
  const [locked, setLocked] = useState(false)
  const [paused, setPaused] = useState(false)
  const [gameDuration, setGameDuration] = useState(null)
  const [elapsedSeconds, setElapsedSeconds] = useState(0)
  const startTimeRef = useRef(null)

  useEffect(() => {
    setHideChrome(step === 'playing')
    return () => setHideChrome(false)
  }, [step, setHideChrome])

  useEffect(() => {
    if (step !== 'playing' || paused) return
    const interval = setInterval(() => {
      setElapsedSeconds(Math.floor((Date.now() - startTimeRef.current) / 1000))
    }, 1000)
    return () => clearInterval(interval)
  }, [step, paused])

  function handlePlayersChosen(chosenPlayers) {
    setPlayers(chosenPlayers.map(p => ({ ...p, score: 0 })))
    setStep('difficulty')
  }

  function chooseDifficulty(count) {
    setPairsCount(count)
    const newDeck = buildDeck(members, count)
    setDeck(newDeck)
    preloadDeckImages(newDeck)
    setStep('order')
  }

  function handleOrderReady(orderedPlayers) {
    setPlayers(orderedPlayers.map(p => ({ ...p, score: 0 })))
    beginPlay()
  }

  function beginPlay() {
    setCurrentPlayer(0)
    setFlipped([])
    setMatchedBy(new Map())
    setLocked(false)
    setPaused(false)
    setElapsedSeconds(0)
    startTimeRef.current = Date.now()
    setStep('playing')
  }

  function restartRound() {
    const newDeck = buildDeck(members, pairsCount)
    setDeck(newDeck)
    preloadDeckImages(newDeck)
    setPlayers(prev => prev.map(p => ({ ...p, score: 0 })))
    beginPlay()
  }

  function quitGame() {
    setPaused(false)
    navigate('/games')
  }

  const finishGame = useCallback(() => {
    setGameDuration(Math.round((Date.now() - startTimeRef.current) / 1000))
    setStep('results')
  }, [])

  const handleCardClick = useCallback((card) => {
    if (paused || locked || flipped.includes(card.cardId) || matchedBy.has(card.memberId)) return

    const nextFlipped = [...flipped, card.cardId]
    setFlipped(nextFlipped)
    if (nextFlipped.length < 2) return

    setLocked(true)
    const first = deck.find(c => c.cardId === nextFlipped[0])
    const second = deck.find(c => c.cardId === nextFlipped[1])

    if (first.memberId === second.memberId) {
      setTimeout(() => {
        const updatedMatches = new Map(matchedBy)
        updatedMatches.set(first.memberId, currentPlayer)
        setMatchedBy(updatedMatches)
        setPlayers(prev => prev.map((p, i) => i === currentPlayer ? { ...p, score: p.score + 1 } : p))
        setFlipped([])
        setLocked(false)
        if (updatedMatches.size === pairsCount) finishGame()
      }, MATCH_DELAY)
    } else {
      setTimeout(() => {
        setFlipped([])
        setLocked(false)
        setCurrentPlayer(prev => (prev + 1) % players.length)
      }, FLIP_BACK_DELAY)
    }
  }, [paused, locked, flipped, matchedBy, deck, pairsCount, currentPlayer, players.length, finishGame])

  if (step === 'players') {
    return (
      <div className="overflow-y-auto h-full bg-gray-50 pb-24">
        <Header title="Memory" onBack={() => navigate('/games')} />
        <PlayerSetupStep onContinue={handlePlayersChosen} />
      </div>
    )
  }

  if (step === 'difficulty') {
    return (
      <div className="overflow-y-auto h-full bg-gray-50 pb-24">
        <Header title="Memory" onBack={() => setStep('players')} />
        <DifficultySetupStep photoCount={photoCount} onBack={() => setStep('players')} onStart={chooseDifficulty} />
      </div>
    )
  }

  if (step === 'order') {
    return (
      <div className="overflow-y-auto h-full bg-gray-50 pb-24">
        <Header title="Memory" onBack={() => setStep('difficulty')} />
        <TurnOrderWheel players={players} onOrderReady={handleOrderReady} />
      </div>
    )
  }

  if (step === 'results') {
    return (
      <div className="overflow-y-auto h-full bg-gray-50 pb-24">
        <Header title="Résultats" onBack={() => navigate('/games')} />
        <GameResultsScreen
          players={players}
          pairsCount={pairsCount}
          durationSeconds={gameDuration}
          onReplay={() => setStep('difficulty')}
          onExit={() => navigate('/games')}
        />
      </div>
    )
  }

  return (
    <div className="relative h-full bg-gray-50 overflow-hidden">
      <div className={`h-full flex flex-col transition-opacity duration-200 ${paused ? 'opacity-30 pointer-events-none' : ''}`}>
        <div className="px-4 pt-12 pb-3 shrink-0">
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-mono font-semibold text-gray-400 bg-white rounded-full px-3 py-1.5 shadow-sm">
              ⏱ {formatDuration(elapsedSeconds)}
            </span>
            <button
              onClick={() => setPaused(true)}
              className="shrink-0 min-h-touch min-w-touch flex items-center justify-center text-gray-400 bg-white rounded-full shadow-sm"
            >
              <DotsIcon />
            </button>
          </div>

          <div className="flex gap-2">
            {players.map((p, i) => {
              const isActive = i === currentPlayer
              const color = PLAYER_COLORS[i % PLAYER_COLORS.length]
              return (
                <div
                  key={p.name + i}
                  className={`flex-1 flex flex-col items-center gap-1 rounded-2xl py-2.5 px-1 transition-all duration-200 ${
                    isActive ? 'bg-primary shadow-md scale-105' : 'bg-white shadow-sm'
                  }`}
                >
                  <Avatar
                    member={memberById.get(p.memberId)}
                    name={p.name}
                    size="sm"
                    className={`ring-2 ${isActive ? 'ring-white' : color.ring}`}
                  />
                  <span className={`text-[11px] font-semibold truncate max-w-full ${isActive ? 'text-white' : 'text-gray-600'}`}>
                    {p.name.split(' ')[0]}
                  </span>
                  <span className={`text-xs font-bold ${isActive ? 'text-white' : 'text-primary'}`}>{p.score}</span>
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
            disabled={locked || paused}
          />
        </div>
      </div>

      {paused && (
        <div className="fixed inset-0 z-40 flex items-center justify-center px-10">
          <div className="w-full max-w-xs space-y-3">
            <button
              onClick={() => setPaused(false)}
              className="w-full rounded-xl bg-primary py-3.5 text-sm font-semibold text-white shadow-lg active:bg-primary-dark"
            >
              Reprendre
            </button>
            <button
              onClick={restartRound}
              className="w-full rounded-xl bg-white py-3.5 text-sm font-semibold text-gray-700 shadow-lg active:bg-gray-50"
            >
              Recommencer
            </button>
            <button
              onClick={quitGame}
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

function Header({ title, onBack }) {
  return (
    <div className="bg-dark px-5 pt-12 pb-4 flex items-center gap-3">
      <button onClick={onBack} className="text-white/70">
        <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
        </svg>
      </button>
      <h1 className="text-xl font-bold text-white">{title}</h1>
    </div>
  )
}

function DotsIcon() {
  return (
    <svg className="h-5 w-5" fill="currentColor" viewBox="0 0 24 24">
      <circle cx="12" cy="5" r="2" />
      <circle cx="12" cy="12" r="2" />
      <circle cx="12" cy="19" r="2" />
    </svg>
  )
}
