import { shuffle } from './shuffle'
import { buildQuestionCountPresets } from './quizPresets'
import { getRelationshipLabel } from './relationshipUtils'

export const MIN_MEMBERS_TO_UNLOCK = 4
export const QUESTION_COUNT_PRESETS = buildQuestionCountPresets(MIN_MEMBERS_TO_UNLOCK)

const PREFIX = 'Votre '

// Pool de secours si la famille n'a pas assez de types de liens différents
// pour fournir 3 leurres distincts autour d'une bonne réponse donnée.
const FALLBACK_TERMS = [
  'père', 'mère', 'fils', 'fille', 'frère', 'sœur',
  'grand-père', 'grand-mère', 'petit-fils', 'petite-fille',
  'oncle', 'tante', 'neveu', 'nièce', 'cousin', 'cousine',
  'beau-frère', 'belle-sœur',
]

const OPTIONS_PER_QUESTION = 4

export function buildRelationshipRounds(members, relations, questionCount) {
  const rounds = []
  const usedPairs = new Set()
  const maxAttempts = questionCount * 40

  for (let attempts = 0; rounds.length < questionCount && attempts < maxAttempts; attempts++) {
    const a = members[Math.floor(Math.random() * members.length)]
    const b = members[Math.floor(Math.random() * members.length)]
    if (a.id === b.id) continue

    const pairKey = [a.id, b.id].sort().join('|')
    if (usedPairs.has(pairKey)) continue

    const label = getRelationshipLabel(relations, members, a.id, b.id)
    if (!label?.startsWith(PREFIX)) continue

    usedPairs.add(pairKey)
    rounds.push({ id: pairKey, memberAId: a.id, memberBId: b.id, correctTerm: label.slice(PREFIX.length) })
  }

  const knownTerms = [...new Set(rounds.map(r => r.correctTerm))]

  return rounds.map(r => {
    const alternativePool = shuffle([...new Set([...knownTerms, ...FALLBACK_TERMS])].filter(t => t !== r.correctTerm))
    const distractors = alternativePool.slice(0, OPTIONS_PER_QUESTION - 1)
    const options = shuffle([r.correctTerm, ...distractors]).map(term => ({ key: term, label: term }))

    return {
      id: r.id,
      memberAId: r.memberAId,
      memberBId: r.memberBId,
      correctTerm: r.correctTerm,
      options,
    }
  })
}
