export const GAMES = [
  { key: 'memory', label: 'Memory', unitLabel: 'paires' },
  { key: 'quiwho', label: 'Qui est-ce', unitLabel: 'questions' },
  { key: 'relationship', label: 'Quel est le lien', unitLabel: 'questions' },
]

export const GAME_LABELS = Object.fromEntries(GAMES.map(g => [g.key, g.label]))
export const GAME_UNIT_LABELS = Object.fromEntries(GAMES.map(g => [g.key, g.unitLabel]))
