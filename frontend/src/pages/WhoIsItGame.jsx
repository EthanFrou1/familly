import { useState, useRef, useEffect, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { useMembers } from '../store/MembersContext'
import { useUiChrome } from '../store/UiChromeContext'
import { membersWithPhoto, formatDuration } from '../utils/memoryGame'
import { QUESTION_COUNT_PRESETS, buildWhoIsItRounds } from '../utils/whoIsItGame'
import GameConfigScreen from '../components/games/GameConfigScreen'
import TurnOrderWheel from '../components/games/TurnOrderWheel'
import QuizRoundScreen from '../components/games/QuizRoundScreen'
import GameResultsScreen from '../components/games/GameResultsScreen'
import GameHeader from '../components/games/GameHeader'
import DotsIcon from '../components/games/DotsIcon'
import PlayerScoreBar from '../components/games/PlayerScoreBar'

const REVEAL_DELAY = 1100
const ANSWER_TIME_LIMIT = 15
const TIMEOUT_KEY = '__timeout__'

export default function WhoIsItGame() {
  const { members } = useMembers()
  const navigate = useNavigate()
  const { setHideChrome } = useUiChrome()
  const photoCount = membersWithPhoto(members).length
  const memberById = useMemo(() => new Map(members.map(m => [m.id, m])), [members])

  const [step, setStep] = useState('setup')
  const [players, setPlayers] = useState([])
  const [questionCount, setQuestionCount] = useState(null)
  const [rounds, setRounds] = useState([])
  const [roundIndex, setRoundIndex] = useState(0)
  const [currentPlayer, setCurrentPlayer] = useState(0)
  const [selectedMemberId, setSelectedMemberId] = useState(null)
  const [timeLeft, setTimeLeft] = useState(ANSWER_TIME_LIMIT)
  const [paused, setPaused] = useState(false)
  const [gameDuration, setGameDuration] = useState(null)
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
    const interval = setInterval(() => setElapsedSeconds(getElapsedSeconds()), 1000)
    return () => clearInterval(interval)
  }, [step, paused])

  useEffect(() => {
    if (step !== 'playing') return
    setTimeLeft(ANSWER_TIME_LIMIT)
  }, [step, roundIndex])

  useEffect(() => {
    if (step !== 'playing' || paused || selectedMemberId != null) return
    const interval = setInterval(() => setTimeLeft(t => Math.max(0, t - 0.1)), 100)
    return () => clearInterval(interval)
  }, [step, paused, selectedMemberId, roundIndex])

  useEffect(() => {
    if (step !== 'playing' || paused || selectedMemberId != null) return
    if (timeLeft <= 0) handleTimeout()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [timeLeft])

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
    setRounds(buildWhoIsItRounds(members, questionCount, players.map(p => p.memberId)))
    setRoundIndex(0)
    setCurrentPlayer(0)
    setSelectedMemberId(null)
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

  function resolveRound(correct) {
    const answeringPlayer = currentPlayer
    if (correct) {
      setPlayers(prev => prev.map((p, i) => i === answeringPlayer ? { ...p, score: p.score + 1 } : p))
    }

    setTimeout(() => {
      setSelectedMemberId(null)
      if (roundIndex + 1 >= rounds.length) {
        setGameDuration(getElapsedSeconds())
        setStep('results')
      } else {
        setRoundIndex(i => i + 1)
        setCurrentPlayer(p => (p + 1) % players.length)
      }
    }, REVEAL_DELAY)
  }

  function handleAnswer(memberId) {
    if (paused || selectedMemberId != null) return
    setSelectedMemberId(memberId)
    resolveRound(memberId === rounds[roundIndex].targetMemberId)
  }

  function handleTimeout() {
    if (paused || selectedMemberId != null) return
    setSelectedMemberId(TIMEOUT_KEY)
    resolveRound(false)
  }

  if (step === 'setup') {
    return (
      <div className="overflow-y-auto h-full bg-gray-50 pb-24">
        <GameHeader title="Prêts ? 🎯" subtitle="Qui est-ce ?" onBack={() => navigate('/games')} />
        <GameConfigScreen
          photoCount={photoCount}
          onStart={handleConfigReady}
          presets={QUESTION_COUNT_PRESETS}
          sectionLabel="Nombre de questions"
          unitLabel="questions"
        />
      </div>
    )
  }

  if (step === 'order') {
    return (
      <div className="overflow-y-auto h-full bg-gray-50 pb-24">
        <GameHeader title="Qui est-ce ?" onBack={() => setStep('setup')} />
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
          gameType="quiwho"
          gameLabel="Qui est-ce"
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
            <div className="flex items-center gap-2">
              <span className="text-xs font-mono font-semibold text-gray-400 bg-white rounded-full px-3 py-1 shadow-sm">
                ⏱ {formatDuration(elapsedSeconds)}
              </span>
              <span className="text-xs font-bold text-primary bg-white rounded-full px-3 py-1 shadow-sm">
                {roundIndex + 1}/{rounds.length}
              </span>
            </div>
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
          prompt={<PhotoPrompt url={round.photoUrl} />}
          correctKey={round.targetMemberId}
          options={round.options.map(o => ({ key: o.memberId, label: o.name }))}
          selectedKey={selectedMemberId}
          onAnswer={handleAnswer}
          disabled={paused}
          timeLeft={timeLeft}
          timeLimit={ANSWER_TIME_LIMIT}
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

function PhotoPrompt({ url }) {
  return (
    <div className="rounded-3xl overflow-hidden shadow-lg shadow-black/10 bg-white p-2 max-h-[42vh] aspect-square">
      <img src={url} alt="Qui est-ce ?" className="h-full w-full rounded-2xl object-cover" />
    </div>
  )
}
