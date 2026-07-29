import { useState } from 'react'
import Avatar from '../shared/Avatar'

// Fond du parcours (le Canigou), généré par IA — frontend/public/games/canigou-mountain.jpg
// (recompressé en JPEG 800px large : le PNG original faisait 2,3 Mo, trop lourd pour du mobile).
// Si l'image ne charge pas, on retombe sur un dégradé montagne/ciel.
const BACKGROUND_SRC = '/games/canigou-mountain.jpg'

// Échelle absolue (pas relative au meilleur du groupe) : 5 victoires pour atteindre le sommet, quel
// que soit le score des autres. Donne 4 camps intermédiaires (1 par victoire) avant le sommet (5e).
const VICTORIES_TO_SUMMIT = 5

// Petit hash déterministe (memberId -> [0,1)) : sert à écarter horizontalement les membres à égalité
// de victoires sans que leur position ne bouge d'un rendu à l'autre.
function hashUnit(id) {
  let h = 0
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) >>> 0
  return (h % 1000) / 1000
}

// Approxime la courbe du sentier qui serpente dans l'image de fond, pour que les repères (avatars,
// camps) suivent visuellement le chemin plutôt que de rester alignés au centre.
function trailLeft(pct, seed = 0) {
  const wobble = Math.sin(pct * Math.PI * 2.2 + seed) * 26
  return Math.min(88, Math.max(12, 50 + wobble))
}

const CAMPS = [1, 2, 3, 4].map(victories => ({ victories, pct: victories / VICTORIES_TO_SUMMIT }))

export default function DailyMysteryMountain({ entries, currentMemberId }) {
  const [bgFailed, setBgFailed] = useState(false)

  return (
    <div className="relative w-full h-full rounded-3xl overflow-hidden shadow-lg bg-gradient-to-b from-sky-300 via-sky-100 to-emerald-200">
      {!bgFailed && (
        <img
          src={BACKGROUND_SRC}
          onError={() => setBgFailed(true)}
          alt=""
          aria-hidden="true"
          className="absolute inset-0 h-full w-full object-cover"
        />
      )}

      <div className="absolute top-3 left-1/2 -translate-x-1/2 text-xs font-black text-white bg-black/30 backdrop-blur-sm rounded-full px-3 py-1 tracking-wide z-20">
        🏁 Sommet du Canigou
      </div>

      {CAMPS.map((camp, i) => {
        const bottom = 8 + camp.pct * 76
        const left = Math.min(80, Math.max(20, trailLeft(camp.pct) + (i % 2 === 0 ? -16 : 16)))
        return (
          <span
            key={camp.victories}
            className="absolute -translate-x-1/2 text-[10px] font-bold text-white bg-black/35 backdrop-blur-sm rounded-full px-2 py-0.5 whitespace-nowrap"
            style={{ left: `${left}%`, bottom: `${bottom}%`, zIndex: Math.round(camp.pct * 100) }}
          >
            🏕️ Camp {camp.victories}
          </span>
        )
      })}

      {entries.map(e => {
        const pct = Math.min(1, e.victories / VICTORIES_TO_SUMMIT)
        const bottom = 8 + pct * 76
        const jitter = (hashUnit(e.memberId) - 0.5) * 10
        const left = Math.min(88, Math.max(12, trailLeft(pct, hashUnit(e.memberId) * 6) + jitter))
        const reachedSummit = e.victories >= VICTORIES_TO_SUMMIT
        const isMe = e.memberId === currentMemberId

        return (
          <div
            key={e.memberId}
            className="absolute flex flex-col items-center -translate-x-1/2"
            style={{ left: `${left}%`, bottom: `${bottom}%`, zIndex: 50 + Math.round(pct * 100) }}
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
              {reachedSummit && (
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
