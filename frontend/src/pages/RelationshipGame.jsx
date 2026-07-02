import { useState, useRef, useEffect, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { useMembers } from '../store/MembersContext'
import { useUiChrome } from '../store/UiChromeContext'
import { relationsApi } from '../services/api'
import { formatDuration } from '../utils/memoryGame'
import { QUESTION_COUNT_PRESETS, buildRelationshipRounds } from '../utils/relationshipGame'
import GameConfigScreen from '../components/games/GameConfigScreen'
import TurnOrderWheel from '../components/games/TurnOrderWheel'
import QuizRoundScreen from '../components/games/QuizRoundScreen'
import GameResultsScreen from '../components/games/GameResultsScreen'
import GameHeader from '../components/games/GameHeader'
import DotsIcon from '../components/games/DotsIcon'
import PlayerScoreBar from '../components/games/PlayerScoreBar'
import Avatar from '../components/shared/Avatar'

const REVEAL_DELAY = 1100

export default function RelationshipGame() {
  const { members } = useMembers()
  const navigate = useNavigate()
  const { setHideChrome } = useUiChrome()
  const memberById = useMemo(() => new Map(members.map(m => [m.id, m])), [members])

  const [relations, setRelations] = useState(null)

  const [step, setStep] = useState('setup')
  const [players, setPlayers] = useState([])
  const [questionCount, setQuestionCount] = useState(null)
  const [rounds, setRounds] = useState([])
  const [roundIndex, setRoundIndex] = useState(0)
  const [currentPlayer, setCurrentPlayer] = useState(0)
  const [selectedKey, setSelectedKey] = useState(null)
  const [paused, setPaused] = useState(false)
  const [gameDuration, setGameDuration] = useState(null)
  const [elapsedSeconds, setElapsedSeconds] = useState(0)
  const startTimeRef = useRef(null)
  const pausedAtRef = useRef(null)
  const pausedDurationRef = useRef(0)

  useEffect(() => {
    relationsApi.getAll().then(({ data }) => setRelations(data)).catch(() => setRelations([]))
  }, [])

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
    const interval = setInterval(() => setElapsedSeconds(getElapsedSeconds()), 1000)
    return () => clearInterval(interval)
  }, [step, paused])

  function handleConfigReady(chosenPlayers, count) {
    setPlayers(chosenPlayers.map(p => ({ ...p, score: 0 })))
    setQuestionCount(count)
    setStep('order')
  }

  function handleOrderReady(orderedPlayers) {
    setPlayers(orderedPlayers.map(p => ({ ...p, score: 0 })))
    beginPlay()
  }

  function beginPlay() {
    setRounds(buildRelationshipRounds(members, relations, questionCount))
    setRoundIndex(0)
    setCurrentPlayer(0)
    setSelectedKey(null)
    setPaused(false)
    setElapsedSeconds(0)
    pausedDurationRef.current = 0
    pausedAtRef.current = null
    startTimeRef.current = Date.now()
    setStep('playing')
  }

  function restartRound() {
    setPlayers(prev => prev.map(p => ({ ...p, score: 0 })))
    beginPlay()
  }

  function quitGame() {
    setPaused(false)
    navigate('/games')
  }

  function handleAnswer(key) {
    if (paused || selectedKey != null) return
    setSelectedKey(key)
    const correct = key === rounds[roundIndex].correctTerm
    const answeringPlayer = currentPlayer
    if (correct) {
      setPlayers(prev => prev.map((p, i) => i === answeringPlayer ? { ...p, score: p.score + 1 } : p))
    }

    setTimeout(() => {
      setSelectedKey(null)
      if (roundIndex + 1 >= rounds.length) {
        setGameDuration(getElapsedSeconds())
        setStep('results')
      } else {
        setRoundIndex(i => i + 1)
        setCurrentPlayer(p => (p + 1) % players.length)
      }
    }, REVEAL_DELAY)
  }

  if (step === 'setup') {
    return (
      <div className="overflow-y-auto h-full bg-gray-50 pb-24">
        <GameHeader title="Prêts ? 🎯" subtitle="Quel est le lien ?" onBack={() => navigate('/games')} />
        {relations == null ? (
          <div className="flex justify-center py-10">
            <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
          </div>
        ) : (
          <GameConfigScreen
            photoCount={members.length}
            onStart={handleConfigReady}
            presets={QUESTION_COUNT_PRESETS}
            sectionLabel="Nombre de questions"
            unitLabel="questions"
          />
        )}
      </div>
    )
  }

  if (step === 'order') {
    return (
      <div className="overflow-y-auto h-full bg-gray-50 pb-24">
        <GameHeader title="Quel est le lien ?" onBack={() => setStep('setup')} />
        <TurnOrderWheel players={players} onOrderReady={handleOrderReady} />
      </div>
    )
  }

  if (step === 'results') {
    return (
      <div className="overflow-y-auto h-full bg-gray-50 pb-24">
        <GameResultsScreen
          players={players}
          pairsCount={questionCount}
          durationSeconds={gameDuration}
          onReplay={restartRound}
          onExit={() => navigate('/games')}
          gameType="relationship"
          gameLabel="Quel est le lien"
          unitLabel="questions"
          countLabel="Questions"
        />
      </div>
    )
  }

  const round = rounds[roundIndex]

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

        <QuizRoundScreen
          prompt={<RelationshipPrompt round={round} memberById={memberById} />}
          correctKey={round.correctTerm}
          options={round.options}
          selectedKey={selectedKey}
          onAnswer={handleAnswer}
          disabled={paused}
        />
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

function RelationshipPrompt({ round, memberById }) {
  const a = memberById.get(round.memberAId)
  const b = memberById.get(round.memberBId)

  return (
    <div className="flex flex-col items-center gap-6">
      <p className="text-sm font-bold text-gray-500">Quel est leur lien de parenté ?</p>
      <div className="flex items-center gap-5">
        <div className="flex flex-col items-center gap-2">
          <Avatar member={a} size="xl" className="ring-4 ring-primary/30" />
          <p className="font-extrabold text-gray-800 text-sm">{a?.firstName}</p>
        </div>
        <span className="text-2xl">🤔</span>
        <div className="flex flex-col items-center gap-2">
          <Avatar member={b} size="xl" className="ring-4 ring-dark/30" />
          <p className="font-extrabold text-gray-800 text-sm">{b?.firstName}</p>
        </div>
      </div>
    </div>
  )
}
