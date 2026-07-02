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
