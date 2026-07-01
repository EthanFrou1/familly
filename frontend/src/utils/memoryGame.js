export const DIFFICULTY_PRESETS = [
  { label: 'Facile', pairsCount: 6 },
  { label: 'Moyen', pairsCount: 8 },
  { label: 'Difficile', pairsCount: 12 },
]

export const MIN_PAIRS_TO_UNLOCK = DIFFICULTY_PRESETS[0].pairsCount

export const PLAYER_COLORS = [
  { ring: 'ring-blue-400', dot: 'bg-blue-400' },
  { ring: 'ring-rose-400', dot: 'bg-rose-400' },
  { ring: 'ring-amber-400', dot: 'bg-amber-400' },
  { ring: 'ring-violet-400', dot: 'bg-violet-400' },
]

function shuffle(array) {
  const result = [...array]
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[result[i], result[j]] = [result[j], result[i]]
  }
  return result
}

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

export function preloadDeckImages(deck) {
  const uniqueUrls = [...new Set(deck.map(card => card.photoUrl))]
  uniqueUrls.forEach(url => {
    const img = new Image()
    img.src = url
  })
}
