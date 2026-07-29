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

// Repères de l'échelle sur le côté (1 pt à 5 pts), à la même hauteur que les avatars correspondants.
const SCALE_MARKS = [1, 2, 3, 4, 5].map(points => ({ points, pct: points / VICTORIES_TO_SUMMIT }))

export default function DailyMysteryMountain({ entries, currentMemberId }) {
  const [bgFailed, setBgFailed] = useState(false)

  return (
    <div className="relative isolate w-full h-full rounded-3xl overflow-hidden shadow-lg bg-gradient-to-b from-sky-300 via-sky-100 to-emerald-200">
      {!bgFailed && (
        <img
          src={BACKGROUND_SRC}
          onError={() => setBgFailed(true)}
          alt=""
          aria-hidden="true"
          className="absolute inset-0 h-full w-full object-cover"
        />
      )}

      {SCALE_MARKS.map(mark => (
        <div
          key={mark.points}
          className="absolute left-2 flex items-center gap-1"
          style={{ bottom: `${8 + mark.pct * 76}%`, zIndex: 30 }}
        >
          <span className="h-px w-3 bg-white/80" />
          <span className="text-[9px] font-bold text-white bg-black/35 backdrop-blur-sm rounded-full px-1.5 py-0.5">
            {mark.points} pt{mark.points > 1 ? 's' : ''}
          </span>
        </div>
      ))}

      {entries.map(e => {
        const pct = Math.min(1, e.victories / VICTORIES_TO_SUMMIT)
        const bottom = 8 + pct * 76
        const jitter = (hashUnit(e.memberId) - 0.5) * 10
        const left = Math.min(88, Math.max(12, trailLeft(pct, hashUnit(e.memberId) * 6) + jitter))
        const reachedSummit = e.victories >= VICTORIES_TO_SUMMIT
        const isMe = e.memberId === currentMemberId

        return (
          <span
            key={e.memberId}
            className="absolute -translate-x-1/2 flex flex-col items-center"
            style={{ left: `${left}%`, bottom: `${bottom}%`, zIndex: 50 + Math.round(pct * 100) }}
          >
            {isMe && (
              <span
                aria-hidden="true"
                className="h-0 w-0 border-l-[11px] border-l-transparent border-r-[11px] border-r-transparent border-t-[18px] border-t-white drop-shadow-md animate-bounce"
              />
            )}
            <span className="relative -mt-px inline-block">
              <Avatar
                src={e.profilePictureUrl}
                name={`${e.firstName} ${e.lastName}`}
                size={44}
                className={isMe ? 'ring-[3px] ring-primary shadow-md' : 'ring-2 ring-white shadow-md'}
              />
              {reachedSummit && (
                <span className="absolute -top-3 -right-1.5 text-base rotate-12 select-none" aria-hidden="true">👑</span>
              )}
            </span>
          </span>
        )
      })}
    </div>
  )
}
