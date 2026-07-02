import Avatar from '../shared/Avatar'

const RANK_STYLE = {
  1: { order: 'order-2', barHeight: 'h-24', barColor: 'bg-amber-400', ring: 'ring-amber-400', avatarSize: 'lg', badge: '👑' },
  2: { order: 'order-1', barHeight: 'h-16', barColor: 'bg-gray-300', ring: 'ring-gray-300', avatarSize: 'md', badge: '🥈' },
  3: { order: 'order-3', barHeight: 'h-10', barColor: 'bg-amber-700', ring: 'ring-amber-700', avatarSize: 'md', badge: '🥉' },
}

export default function Podium({ entries, memberById, showRankInBar = false }) {
  return (
    <div className="flex items-end justify-center gap-3">
      {entries.map((entry, i) => {
        const rank = i + 1
        const style = RANK_STYLE[rank]
        const isFirst = rank === 1
        const hasBadge = entry.badge != null
        return (
          <div key={entry.memberId ?? entry.name} className={`flex-1 flex flex-col items-center ${style.order}`}>
            <div className="relative">
              {isFirst && <span className="absolute -top-6 left-1/2 -translate-x-1/2 text-2xl">👑</span>}
              <Avatar
                member={memberById.get(entry.memberId)}
                name={entry.name}
                size={style.avatarSize}
                className={`ring-4 ${style.ring}`}
              />
              {!isFirst && !hasBadge && (
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
