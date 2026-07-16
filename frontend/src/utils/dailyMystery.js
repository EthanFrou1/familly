export const MIN_MEMBERS_TO_UNLOCK = 8
export const MAX_ATTEMPTS = 15

// Ordre d'affichage des colonnes de la grille. `branch` est masquée dynamiquement
// par le backend (showBranchColumn) si la famille n'a qu'une seule branche/aucune.
export const ATTRIBUTE_COLUMNS = [
  { key: 'generation', label: 'Génération', emoji: '🌳', description: "Même génération, génération proche (parent/enfant direct) ou éloignée par rapport à la réponse." },
  { key: 'birthYear', label: 'Naissance', emoji: '🎂', description: "Année de naissance du membre proposé, affichée directement dans la case." },
  { key: 'city', label: 'Ville', emoji: '📍', description: "Même ville, même pays (mais autre ville), ou totalement différent." },
  { key: 'gender', label: 'Sexe', emoji: '🚻', description: "Même sexe que la réponse ou non." },
  { key: 'branch', label: 'Famille', emoji: '🌿', description: "Même famille (utile pour les familles recomposées) ou non." },
  { key: 'alive', label: 'Statut', emoji: '🔁', description: "Vivant ou décédé, comme la réponse ou non." },
]

const CELL_EMOJI = { green: '🟩', yellow: '🟨', gray: '⬜' }

export function buildShareText(state) {
  const columns = ATTRIBUTE_COLUMNS.filter(c => c.key !== 'branch' || state.showBranchColumn)
  const lines = state.rows.map(row =>
    // La case Naissance affiche l'année brute (indice neutre) plutôt qu'un statut vert/gris.
    columns.map(c => c.key === 'birthYear' ? '⬜' : CELL_EMOJI[row[c.key]?.status] ?? '⬜').join('')
  )

  const result = state.status === 'solved' ? `Réussi en ${state.attemptsUsed}/${MAX_ATTEMPTS}` : `Raté (${MAX_ATTEMPTS}/${MAX_ATTEMPTS})`
  const streakLine = state.streak > 0 ? `🔥 ${state.streak} jour${state.streak > 1 ? 's' : ''} de suite` : null

  return ['🔮 Le Membre Mystère', result, ...(streakLine ? [streakLine] : []), '', ...lines].join('\n')
}
