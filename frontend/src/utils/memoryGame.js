import { shuffle } from './shuffle'

export const DIFFICULTY_PRESETS = [
  { label: 'Facile', value: 6, emoji: '🌱' },
  { label: 'Moyen', value: 8, emoji: '🌳' },
  { label: 'Difficile', value: 12, emoji: '🔥' },
]

export const MIN_PAIRS_TO_UNLOCK = DIFFICULTY_PRESETS[0].value

export const PLAYER_COLORS = [
  { ring: 'ring-blue-400', border: 'border-blue-400', dot: 'bg-blue-400', text: 'text-blue-500', hex: '#60a5fa' },
  { ring: 'ring-rose-400', border: 'border-rose-400', dot: 'bg-rose-400', text: 'text-rose-500', hex: '#fb7185' },
  { ring: 'ring-amber-400', border: 'border-amber-400', dot: 'bg-amber-400', text: 'text-amber-500', hex: '#fbbf24' },
  { ring: 'ring-violet-400', border: 'border-violet-400', dot: 'bg-violet-400', text: 'text-violet-500', hex: '#a78bfa' },
  { ring: 'ring-emerald-400', border: 'border-emerald-400', dot: 'bg-emerald-400', text: 'text-emerald-500', hex: '#34d399' },
  { ring: 'ring-cyan-400', border: 'border-cyan-400', dot: 'bg-cyan-400', text: 'text-cyan-500', hex: '#22d3ee' },
  { ring: 'ring-fuchsia-400', border: 'border-fuchsia-400', dot: 'bg-fuchsia-400', text: 'text-fuchsia-500', hex: '#e879f9' },
  { ring: 'ring-orange-400', border: 'border-orange-400', dot: 'bg-orange-400', text: 'text-orange-500', hex: '#fb923c' },
  { ring: 'ring-lime-400', border: 'border-lime-400', dot: 'bg-lime-400', text: 'text-lime-500', hex: '#a3e635' },
  { ring: 'ring-indigo-400', border: 'border-indigo-400', dot: 'bg-indigo-400', text: 'text-indigo-500', hex: '#818cf8' },
]

export function membersWithPhoto(members) {
  return members.filter(m => m.profilePictureUrl)
}

export function buildDeck(members, pairsCount) {
  const pool = shuffle(membersWithPhoto(members)).slice(0, pairsCount)

  return shuffle(
    pool.flatMap(member => [
      { cardId: `${member.id}-a`, memberId: member.id, photoUrl: member.profilePictureUrl, name: `${member.firstName} ${member.lastName}` },
      { cardId: `${member.id}-b`, memberId: member.id, photoUrl: member.profilePictureUrl, name: `${member.firstName} ${member.lastName}` },
    ])
  )
}

export function formatDuration(totalSeconds) {
  const minutes = Math.floor(totalSeconds / 60)
  const seconds = totalSeconds % 60
  return `${minutes}:${String(seconds).padStart(2, '0')}`
}

export function preloadDeckImages(deck) {
  const uniqueUrls = [...new Set(deck.map(card => card.photoUrl))]
  uniqueUrls.forEach(url => {
    const img = new Image()
    img.src = url
  })
}
