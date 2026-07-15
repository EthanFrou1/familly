export const MIN_MEMBERS_TO_UNLOCK = 8
export const MAX_ATTEMPTS = 6

// Ordre d'affichage des colonnes de la grille. `branch` est masquée dynamiquement
// par le backend (showBranchColumn) si la famille n'a qu'une seule branche/aucune.
export const ATTRIBUTE_COLUMNS = [
  { key: 'generation', label: 'Génération', emoji: '🌳' },
  { key: 'birthYear', label: 'Naissance', emoji: '🎂' },
  { key: 'city', label: 'Ville', emoji: '📍' },
  { key: 'gender', label: 'Sexe', emoji: '🚻' },
  { key: 'branch', label: 'Branche', emoji: '🌿' },
  { key: 'alive', label: 'Statut', emoji: '💫' },
]

const CELL_EMOJI = { green: '🟩', yellow: '🟨', gray: '⬜' }

export function buildShareText(state) {
  const columns = ATTRIBUTE_COLUMNS.filter(c => c.key !== 'branch' || state.showBranchColumn)
  const lines = state.rows.map(row =>
    columns.map(c => CELL_EMOJI[row[c.key]?.status] ?? '⬜').join('')
  )

  const result = state.status === 'solved' ? `Réussi en ${state.attemptsUsed}/${MAX_ATTEMPTS}` : `Raté (${MAX_ATTEMPTS}/${MAX_ATTEMPTS})`
  const streakLine = state.streak > 0 ? `🔥 ${state.streak} jour${state.streak > 1 ? 's' : ''} de suite` : null

  return ['🔮 Le Mystère du jour', result, ...(streakLine ? [streakLine] : []), '', ...lines].join('\n')
}
