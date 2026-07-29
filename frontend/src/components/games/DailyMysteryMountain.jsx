import { useState } from 'react'
import Avatar from '../shared/Avatar'

// Fond du parcours (le Canigou), généré par IA — frontend/public/games/canigou-mountain.jpg
// (recompressé en JPEG 800px large : le PNG original faisait 2,3 Mo, trop lourd pour du mobile).
// Si l'image ne charge pas, on retombe sur un dégradé montagne/ciel.
const BACKGROUND_SRC = '/games/canigou-mountain.jpg'

// Petit hash déterministe (memberId -> [0,1)) : sert à écarter horizontalement les membres à égalité
// de victoires sans que leur position ne bouge d'un rendu à l'autre.
function hashUnit(id) {
  let h = 0
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) >>> 0
  return (h % 1000) / 1000
}

export default function DailyMysteryMountain({ entries, currentMemberId }) {
  const [bgFailed, setBgFailed] = useState(false)
  const maxVictories = Math.max(1, ...entries.map(e => e.victories))
  const hasAnyVictory = entries.some(e => e.victories > 0)

  return (
    <div className="relative w-full aspect-[3/4] rounded-3xl overflow-hidden shadow-lg bg-gradient-to-b from-sky-300 via-sky-100 to-emerald-200">
      {!bgFailed && (
        <img
          src={BACKGROUND_SRC}
          onError={() => setBgFailed(true)}
          alt=""
          aria-hidden="true"
          className="absolute inset-0 h-full w-full object-cover"
        />
      )}

      <div className="absolute top-3 left-1/2 -translate-x-1/2 text-xs font-black text-white bg-black/30 backdrop-blur-sm rounded-full px-3 py-1 tracking-wide">
        🏔️ Sommet du Canigou
      </div>

      {entries.map(e => {
        const pct = e.victories / maxVictories
        const bottom = 8 + pct * 76
        const wobble = Math.sin(pct * Math.PI * 2.2 + hashUnit(e.memberId) * 6) * 26
        const jitter = (hashUnit(e.memberId) - 0.5) * 10
        const left = Math.min(88, Math.max(12, 50 + wobble + jitter))
        const isLeader = hasAnyVictory && e.victories === maxVictories
        const isMe = e.memberId === currentMemberId

        return (
          <div
            key={e.memberId}
            className="absolute flex flex-col items-center -translate-x-1/2"
            style={{ left: `${left}%`, bottom: `${bottom}%`, zIndex: Math.round(pct * 100) }}
          >
            <span className="mb-1 text-[10px] font-extrabold text-white bg-black/40 backdrop-blur-sm rounded-full px-2 py-0.5 whitespace-nowrap">
              🏆 {e.victories} pt{e.victories > 1 ? 's' : ''}
            </span>
            <span className="relative inline-block">
              <Avatar
                src={e.profilePictureUrl}
                name={`${e.firstName} ${e.lastName}`}
                size={44}
                className={`ring-2 ${isMe ? 'ring-primary' : 'ring-white'} shadow-md`}
              />
              {isLeader && (
                <span className="absolute -top-3 -right-1.5 text-base rotate-12 select-none" aria-hidden="true">👑</span>
              )}
            </span>
            <span className="mt-0.5 text-[10px] font-bold text-white bg-black/40 backdrop-blur-sm rounded-full px-2 py-0.5 whitespace-nowrap max-w-[80px] truncate">
              {e.firstName}
            </span>
          </div>
        )
      })}
    </div>
  )
}
