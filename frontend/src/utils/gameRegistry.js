export const GAMES = [
  { key: 'memory', label: 'Memory', unitLabel: 'paires', fullLabel: 'Memory des photos', emoji: '🃏' },
  { key: 'quiwho', label: 'Qui est-ce', unitLabel: 'questions', fullLabel: 'Qui est-ce ?', emoji: '🕵️' },
  { key: 'relationship', label: 'Quel est le lien', unitLabel: 'questions', fullLabel: 'Quel est le lien ?', emoji: '🌳' },
  { key: 'superlative', label: 'Le plus susceptible', unitLabel: 'titres', fullLabel: 'Le/la plus susceptible de...', emoji: '🎉' },
  { key: 'whoami', label: 'Qui suis-je', unitLabel: 'personnages', fullLabel: 'Qui suis-je ?', emoji: '❓' },
  { key: 'dailymystery', label: 'Membre Mystère', unitLabel: 'essais', fullLabel: 'Le Membre Mystère', emoji: '🔮' },
  { key: 'famillenor', label: 'Famille en Or', unitLabel: 'manches', fullLabel: 'Une Famille en Or', emoji: '💰' },
  { key: 'undercover', label: 'Undercover', unitLabel: 'manches', fullLabel: 'Undercover', emoji: '🎭' },
]

export const GAME_LABELS = Object.fromEntries(GAMES.map(g => [g.key, g.label]))
export const GAME_UNIT_LABELS = Object.fromEntries(GAMES.map(g => [g.key, g.unitLabel]))
export const GAME_FULL_LABELS = Object.fromEntries(GAMES.map(g => [g.key, g.fullLabel]))
export const GAME_EMOJIS = Object.fromEntries(GAMES.map(g => [g.key, g.emoji]))
