import Avatar from '../shared/Avatar'

const RANK_STYLE = {
  1: { order: 'order-2', barHeight: 'h-24', barColor: 'bg-amber-400', ring: 'ring-amber-400', avatarSize: 'lg', badge: '👑' },
  2: { order: 'order-1', barHeight: 'h-16', barColor: 'bg-gray-300', ring: 'ring-gray-300', avatarSize: 'md', badge: '🥈' },
  3: { order: 'order-3', barHeight: 'h-10', barColor: 'bg-amber-700', ring: 'ring-amber-700', avatarSize: 'md', badge: '🥉' },
}

// entries doivent déjà être triées du meilleur au moins bon. Si un `score`
// numérique est fourni sur chaque entrée, les ex-æquo partagent le même
// rang (ex: 1, 1, 3) au lieu d'être départagés arbitrairement par leur
// position — sinon le podium ferait croire à une victoire qui n'existe pas.
function computeRanks(entries) {
  const hasScores = entries.every(e => typeof e.score === 'number')
  if (!hasScores) return entries.map((_, i) => i + 1)

  const ranks = []
  entries.forEach((e, i) => {
    ranks.push(i > 0 && e.score === entries[i - 1].score ? ranks[i - 1] : i + 1)
  })
  return ranks
}

export default function Podium({ entries, memberById, showRankInBar = false }) {
  const ranks = computeRanks(entries)
  const hasTie = new Set(ranks).size !== ranks.length
  const soleFirst = ranks.filter(r => r === 1).length === 1

  return (
    <div className="flex items-end justify-center gap-3">
      {entries.map((entry, i) => {
        const rank = ranks[i]
        const style = RANK_STYLE[Math.min(rank, 3)]
        const isSoleFirst = rank === 1 && soleFirst
        const hasBadge = entry.badge != null
        return (
          <div key={entry.memberId ?? entry.name} className={`flex-1 flex flex-col items-center ${hasTie ? '' : style.order}`}>
            <div className="relative">
              {isSoleFirst && <span className="absolute -top-6 left-1/2 -translate-x-1/2 text-2xl">👑</span>}
              <Avatar
                member={memberById.get(entry.memberId)}
                name={entry.name}
                size={style.avatarSize}
                className={`ring-4 ${style.ring}`}
              />
              {!isSoleFirst && !hasBadge && (
                <span className="absolute -bottom-1 -right-1 text-lg">{style.badge}</span>
              )}
            </div>
            {hasBadge && (
              <span className={`-mt-3 z-10 flex h-8 w-8 items-center justify-center rounded-full ${style.barColor} text-white text-sm font-black ring-2 ring-white`}>
                {entry.badge}
              </span>
            )}
            <p className="text-xs font-semibold text-gray-700 mt-2 truncate max-w-[80px]">{entry.name.split(' ')[0]}</p>
            {entry.statLabel && <p className="text-[11px] text-gray-400">{entry.statLabel}</p>}
            <div className={`w-full rounded-t-xl mt-2 ${style.barHeight} ${style.barColor} ${showRankInBar ? 'flex items-start justify-center pt-2 text-white font-black text-xl' : ''}`}>
              {showRankInBar && rank}
            </div>
          </div>
        )
      })}
    </div>
  )
}
