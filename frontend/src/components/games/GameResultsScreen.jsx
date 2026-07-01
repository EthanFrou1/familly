import { useEffect, useRef } from 'react'
import { gamesApi } from '../../services/api'

export default function GameResultsScreen({ players, pairsCount, durationSeconds, onReplay, onExit }) {
  const submitted = useRef(false)
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

  return (
    <div className="px-4 mt-5 space-y-4">
      <div className="rounded-2xl bg-white shadow-sm p-6 text-center">
        <p className="text-4xl">{winnerName ? '🏆' : '🤝'}</p>
        <h2 className="text-lg font-bold text-gray-800 mt-2">
          {winnerName ? `${winnerName} gagne !` : 'Égalité !'}
        </h2>
      </div>

      <div className="rounded-2xl bg-white shadow-sm divide-y divide-gray-50 overflow-hidden">
        {ranked.map((p, i) => (
          <div key={p.name + i} className="flex items-center justify-between px-4 py-3">
            <span className="text-sm font-medium text-gray-700 flex items-center gap-2">
              {i + 1}. {p.name}
              {p.isGuest && <span className="text-[10px] font-semibold text-gray-400 bg-gray-100 rounded-full px-2 py-0.5">invité</span>}
            </span>
            <span className="text-sm font-semibold text-primary">{p.score} paire{p.score !== 1 ? 's' : ''}</span>
          </div>
        ))}
      </div>

      <div className="space-y-2">
        <button onClick={onReplay} className="w-full rounded-xl bg-primary py-3 text-sm font-semibold text-white active:bg-primary-dark">
          Rejouer
        </button>
        <button onClick={onExit} className="w-full rounded-xl border border-dark py-3 text-sm font-semibold text-gray-500">
          Retour aux jeux
        </button>
      </div>
    </div>
  )
}
