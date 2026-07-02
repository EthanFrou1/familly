import { useEffect, useMemo, useRef } from 'react'
import { useMembers } from '../../store/MembersContext'
import { gamesApi } from '../../services/api'
import { formatDuration } from '../../utils/memoryGame'
import Avatar from '../shared/Avatar'
import Podium from './Podium'

export default function GameResultsScreen({ players, pairsCount, durationSeconds, movesCount, onReplay, onExit, alreadySubmitted = false, canReplay = true }) {
  const { members } = useMembers()
  const memberById = useMemo(() => new Map(members.map(m => [m.id, m])), [members])
  const submitted = useRef(alreadySubmitted)
  const ranked = [...players].sort((a, b) => b.score - a.score)
  const topScore = ranked[0]?.score ?? 0
  const winners = ranked.filter(p => p.score === topScore)
  const winnerName = winners.length === 1 ? winners[0].name : null

  useEffect(() => {
    if (submitted.current) return
    submitted.current = true
    gamesApi.submitResult({
      gameType: 'memory',
      pairsCount,
      players: players.map(p => ({ name: p.name, score: p.score, memberId: p.memberId ?? null, isGuest: !!p.isGuest })),
      winnerName,
      durationSeconds,
    }).catch(() => {})
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const podiumEntries = ranked.slice(0, 3).map(p => ({
    memberId: p.memberId,
    name: p.name,
    badge: p.score,
  }))

  return (
    <div className="pb-4">
      <div className="bg-dark px-5 pt-8 pb-9 text-center rounded-b-[32px]">
        <p className="text-3xl">{winnerName ? '🎉' : '🤝'}</p>
        <h2 className="text-xl font-black text-white mt-1.5">
          {winnerName ? `${winnerName} gagne !` : 'Égalité !'}
        </h2>
        <p className="text-xs font-semibold text-white/70 mt-1">
          Memory · {pairsCount} paires{durationSeconds != null ? ` · ${formatDuration(durationSeconds)}` : ''}
        </p>
      </div>

      <div className="px-4 -mt-5">
        <Podium entries={podiumEntries} memberById={memberById} showRankInBar />
      </div>

      <div className="px-4 mt-6 space-y-4">
        <div className="rounded-2xl bg-white shadow-sm p-4 flex items-center justify-around">
          {durationSeconds != null && <ResultStat value={formatDuration(durationSeconds)} label="Durée" color="text-primary" />}
          {durationSeconds != null && <div className="h-8 w-px bg-gray-100" />}
          <ResultStat value={pairsCount} label="Paires" color="text-dark" />
          {movesCount != null && <div className="h-8 w-px bg-gray-100" />}
          {movesCount != null && <ResultStat value={movesCount} label="Coups" color="text-violet-500" />}
        </div>

        <div className="rounded-2xl bg-white shadow-sm divide-y divide-gray-50 overflow-hidden">
          {ranked.map((p, i) => (
            <div key={p.name + i} className="flex items-center gap-3 px-4 py-3">
              <span className="w-4 text-sm font-bold text-gray-400">{i + 1}</span>
              <Avatar member={memberById.get(p.memberId)} name={p.name} size="sm" />
              <span className="flex-1 text-sm font-semibold text-gray-800 truncate flex items-center gap-2">
                {p.name}
                {p.isGuest && <span className="text-[10px] font-semibold text-gray-400 bg-gray-100 rounded-full px-2 py-0.5">invité</span>}
              </span>
              <span className="text-sm font-black text-primary">{p.score}</span>
            </div>
          ))}
        </div>

        <div className="flex gap-2.5">
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
    </div>
  )
}

function ResultStat({ value, label, color }) {
  return (
    <div className="text-center">
      <p className={`text-lg font-black ${color}`}>{value}</p>
      <p className="text-[11px] font-semibold text-gray-400 mt-0.5">{label}</p>
    </div>
  )
}
