export const DIFFICULTY_PRESETS = [
  { label: 'Facile', pairsCount: 6 },
  { label: 'Moyen', pairsCount: 8 },
  { label: 'Difficile', pairsCount: 12 },
]

export const MIN_PAIRS_TO_UNLOCK = DIFFICULTY_PRESETS[0].pairsCount

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
