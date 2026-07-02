import { shuffle } from './shuffle'
import { membersWithPhoto } from './memoryGame'

const OPTIONS_PER_QUESTION = 4
export const MIN_MEMBERS_TO_UNLOCK = OPTIONS_PER_QUESTION

export const QUESTION_COUNT_PRESETS = [
  { label: 'Court', value: 8, emoji: '🌱', minRequired: MIN_MEMBERS_TO_UNLOCK },
  { label: 'Moyen', value: 12, emoji: '🌳', minRequired: MIN_MEMBERS_TO_UNLOCK },
  { label: 'Long', value: 16, emoji: '🔥', minRequired: MIN_MEMBERS_TO_UNLOCK },
]

export function buildWhoIsItRounds(members, questionCount) {
  const pool = membersWithPhoto(members)
  const rounds = []
  let lastTargetId = null

  for (let i = 0; i < questionCount; i++) {
    const candidates = pool.filter(m => m.id !== lastTargetId)
    const target = shuffle(pool.length > 1 ? candidates : pool)[0]
    lastTargetId = target.id

    const distractors = shuffle(pool.filter(m => m.id !== target.id)).slice(0, OPTIONS_PER_QUESTION - 1)
    const options = shuffle([target, ...distractors]).map(m => ({ memberId: m.id, name: `${m.firstName} ${m.lastName}` }))

    rounds.push({
      id: `${target.id}-${i}`,
      targetMemberId: target.id,
      photoUrl: target.profilePictureUrl,
      options,
    })
  }

  return rounds
}
