import { useState, useRef, useCallback, useEffect, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { useMembers } from '../store/MembersContext'
import { useUiChrome } from '../store/UiChromeContext'
import { buildDeck, preloadDeckImages, membersWithPhoto, formatDuration } from '../utils/memoryGame'
import GameModeScreen from '../components/games/GameModeScreen'
import GameConfigScreen from '../components/games/GameConfigScreen'
import TurnOrderWheel from '../components/games/TurnOrderWheel'
import MemoryBoard from '../components/games/MemoryBoard'
import GameResultsScreen from '../components/games/GameResultsScreen'
import GameHeader from '../components/games/GameHeader'
import DotsIcon from '../components/games/DotsIcon'
import PlayerScoreBar from '../components/games/PlayerScoreBar'

const FLIP_BACK_DELAY = 900
const MATCH_DELAY = 300

export default function MemoryGame() {
  const { members } = useMembers()
  const navigate = useNavigate()
  const { setHideChrome } = useUiChrome()
  const photoCount = membersWithPhoto(members).length
  const memberById = useMemo(() => new Map(members.map(m => [m.id, m])), [members])

  const [step, setStep] = useState('mode')
  const [players, setPlayers] = useState([])
  const [pairsCount, setPairsCount] = useState(null)
  const [deck, setDeck] = useState([])
  const [currentPlayer, setCurrentPlayer] = useState(0)
  const [flipped, setFlipped] = useState([])
  const [matchedBy, setMatchedBy] = useState(new Map())
  const [locked, setLocked] = useState(false)
  const [paused, setPaused] = useState(false)
  const [gameDuration, setGameDuration] = useState(null)
  const [movesCount, setMovesCount] = useState(0)
  const [elapsedSeconds, setElapsedSeconds] = useState(0)
  const startTimeRef = useRef(null)
  const pausedAtRef = useRef(null)
  const pausedDurationRef = useRef(0)

  function getElapsedSeconds() {
    return Math.floor((Date.now() - startTimeRef.current - pausedDurationRef.current) / 1000)
  }

  function pauseGame() {
    pausedAtRef.current = Date.now()
    setPaused(true)
  }

  function resumeGame() {
    pausedDurationRef.current += Date.now() - pausedAtRef.current
    setPaused(false)
  }

  useEffect(() => {
    setHideChrome(step === 'playing')
    return () => setHideChrome(false)
  }, [step, setHideChrome])

  useEffect(() => {
    if (step !== 'playing' || paused) return
    const interval = setInterval(() => {
      setElapsedSeconds(getElapsedSeconds())
    }, 1000)
    return () => clearInterval(interval)
  }, [step, paused])

  function handleConfigReady(chosenPlayers, count) {
    setPlayers(chosenPlayers.map(p => ({ ...p, score: 0 })))
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
    setMovesCount(0)
    pausedDurationRef.current = 0
    pausedAtRef.current = null
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
    setGameDuration(getElapsedSeconds())
    setStep('results')
  }, [])

  const handleCardClick = useCallback((card) => {
    if (paused || locked || flipped.includes(card.cardId) || matchedBy.has(card.memberId)) return

    const nextFlipped = [...flipped, card.cardId]
    setFlipped(nextFlipped)
    if (nextFlipped.length < 2) return

    setMovesCount(m => m + 1)
    setLocked(true)
    const first = deck.find(c => c.cardId === nextFlipped[0])
    const second = deck.find(c => c.cardId === nextFlipped[1])

    if (first.memberId === second.memberId) {
      setTimeout(() => {
        const updatedMatches = new Map(matchedBy)
        updatedMatches.set(first.memberId, players[currentPlayer].colorIndex)
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
  }, [paused, locked, flipped, matchedBy, deck, pairsCount, currentPlayer, players, finishGame])

  if (step === 'mode') {
    return (
      <div className="overflow-y-auto h-full bg-gray-50 pb-24">
        <GameHeader title="Memory" onBack={() => navigate('/games')} />
        <GameModeScreen onLocal={() => setStep('setup')} onRemote={() => navigate('/games/memory/remote')} />
      </div>
    )
  }

  if (step === 'setup') {
    return (
      <div className="overflow-y-auto h-full bg-gray-50 pb-24">
        <GameHeader title="Prêts ? 🎯" subtitle="Memory des photos" onBack={() => setStep('mode')} />
        <GameConfigScreen photoCount={photoCount} onStart={handleConfigReady} />
      </div>
    )
  }

  if (step === 'order') {
    return (
      <div className="overflow-y-auto h-full bg-gray-50 pb-24">
        <GameHeader title="Memory" onBack={() => setStep('setup')} />
        <TurnOrderWheel players={players} onOrderReady={handleOrderReady} />
      </div>
    )
  }

  if (step === 'results') {
    return (
      <div className="overflow-y-auto h-full bg-gray-50 pb-24">
        <GameResultsScreen
          players={players}
          pairsCount={pairsCount}
          durationSeconds={gameDuration}
          movesCount={movesCount}
          onReplay={restartRound}
          onExit={() => navigate('/games')}
        />
      </div>
    )
  }

  return (
    <div className="relative h-full bg-gray-50 overflow-hidden">
      <div className={`h-full flex flex-col transition-opacity duration-200 ${paused ? 'opacity-30 pointer-events-none' : ''}`}>
        <div className="px-4 pt-10 pb-2 shrink-0">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-mono font-semibold text-gray-400 bg-white rounded-full px-3 py-1 shadow-sm">
              ⏱ {formatDuration(elapsedSeconds)}
            </span>
            <button
              onClick={pauseGame}
              className="shrink-0 min-h-touch min-w-touch flex items-center justify-center text-gray-400 bg-white rounded-full shadow-sm"
            >
              <DotsIcon />
            </button>
          </div>

          <PlayerScoreBar players={players} isActive={(_, i) => i === currentPlayer} memberById={memberById} />
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
              onClick={resumeGame}
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
