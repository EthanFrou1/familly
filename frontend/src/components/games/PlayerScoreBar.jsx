import { PLAYER_COLORS } from '../../utils/memoryGame'
import Avatar from '../shared/Avatar'

export default function PlayerScoreBar({ players, isActive, memberById }) {
  return (
    <div className="flex flex-wrap gap-2">
      {players.map((p, i) => {
        const active = isActive(p, i)
        const color = PLAYER_COLORS[p.colorIndex % PLAYER_COLORS.length]
        return (
          <div
            key={p.memberId ?? p.name + i}
            className={`flex-1 min-w-[90px] flex items-center gap-2 rounded-2xl py-1.5 px-2 transition-all duration-200 ${
              active ? 'bg-primary shadow-md scale-105' : 'bg-white shadow-sm'
            }`}
          >
            <Avatar
              src={p.profilePictureUrl}
              member={memberById?.get(p.memberId)}
              name={p.name}
              size="xs"
              className={`ring-2 shrink-0 ${active ? 'ring-white' : color.ring}`}
            />
            <div className="min-w-0 flex-1">
              <p className={`text-[11px] font-semibold truncate ${active ? 'text-white' : 'text-gray-600'}`}>
                {p.name.split(' ')[0]}
              </p>
              <p className={`text-xs font-bold ${active ? 'text-white' : color.text}`}>{p.score}</p>
            </div>
          </div>
        )
      })}
    </div>
  )
}
