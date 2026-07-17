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
    const distractors = pickDistractors(fullPool, target)
    const options = shuffle([target, ...distractors]).map(m => ({ memberId: m.id, name: `${m.firstName} ${m.lastName}` }))

    return {
      id: `${target.id}-${i}`,
      targetMemberId: target.id,
      photoUrl: target.profilePictureUrl,
      options,
    }
  })
}

// Un seul prénom masculin/féminin au milieu de leurres de l'autre genre trahirait la bonne
// réponse : on pioche d'abord les leurres dans le même genre que la cible, et on ne complète
// avec le reste que si le pool same-gender est trop petit pour remplir les options.
function pickDistractors(pool, target) {
  const others = pool.filter(m => m.id !== target.id)
  if (!target.gender) return shuffle(others).slice(0, OPTIONS_PER_QUESTION - 1)

  const sameGender = shuffle(others.filter(m => m.gender === target.gender))
  if (sameGender.length >= OPTIONS_PER_QUESTION - 1) return sameGender.slice(0, OPTIONS_PER_QUESTION - 1)

  const rest = shuffle(others.filter(m => m.gender !== target.gender))
  return [...sameGender, ...rest].slice(0, OPTIONS_PER_QUESTION - 1)
}
