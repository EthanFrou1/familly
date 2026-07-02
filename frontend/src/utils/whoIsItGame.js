import { shuffle } from './shuffle'
import { membersWithPhoto } from './memoryGame'

const OPTIONS_PER_QUESTION = 4

// Comme pour le Memory : chaque preset exige son propre nombre de photos
// uniques (pas de minRequired commun), pour ne jamais répéter une photo
// dans la même partie.
export const QUESTION_COUNT_PRESETS = [
  { label: 'Facile', value: 6, emoji: '🌱' },
  { label: 'Moyen', value: 8, emoji: '🌳' },
  { label: 'Difficile', value: 12, emoji: '🔥' },
]

export const MIN_MEMBERS_TO_UNLOCK = QUESTION_COUNT_PRESETS[0].value

export function buildWhoIsItRounds(members, questionCount, excludeMemberIds = []) {
  const fullPool = membersWithPhoto(members)
  const excluded = new Set(excludeMemberIds.filter(Boolean))
  const targetPool = fullPool.filter(m => !excluded.has(m.id))
  const targets = shuffle(targetPool).slice(0, Math.min(questionCount, targetPool.length))

  return targets.map((target, i) => {
    const distractors = shuffle(fullPool.filter(m => m.id !== target.id)).slice(0, OPTIONS_PER_QUESTION - 1)
    const options = shuffle([target, ...distractors]).map(m => ({ memberId: m.id, name: `${m.firstName} ${m.lastName}` }))

    return {
      id: `${target.id}-${i}`,
      targetMemberId: target.id,
      photoUrl: target.profilePictureUrl,
      options,
    }
  })
}
