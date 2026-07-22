import { shuffle } from './shuffle'

// Banque de mots pour le mode local d'Undercover. Distincte de UndercoverWordBank.cs côté
// backend (le mode local est 100% frontend, aucun mot ne transite jamais par le réseau ici
// puisqu'il n'y a qu'un seul appareil — même logique que le deck du Memory local/remote,
// chacun avec sa propre génération indépendante).
const WORD_PAIRS = [
  ['Café', 'Thé'],
  ['Chien', 'Chat'],
  ['Plage', 'Piscine'],
  ['Pizza', 'Burger'],
  ['Été', 'Printemps'],
  ['Train', 'Avion'],
  ['Guitare', 'Piano'],
  ['Football', 'Rugby'],
  ['Montagne', 'Colline'],
  ['Cinéma', 'Théâtre'],
  ['Vélo', 'Trottinette'],
  ['Soleil', 'Lune'],
  ['Riz', 'Pâtes'],
  ['Mer', 'Océan'],
  ['Livre', 'Magazine'],
  ['Camping', 'Hôtel'],
  ['Chocolat', 'Bonbon'],
  ['Voiture', 'Moto'],
  ['Forêt', 'Jardin'],
  ['Neige', 'Pluie'],
]

export const MIN_MEMBERS_TO_UNLOCK = 4
export const MIN_PLAYERS = 4

export const ROLE_CIVILIAN = 'civilian'
export const ROLE_UNDERCOVER = 'undercover'
export const ROLE_MRWHITE = 'mrwhite'

// Nombre max d'undercover pour N joueurs : garde toujours au moins 2 civils en jeu.
export function maxUndercoverCount(playerCount) {
  return Math.max(1, Math.floor((playerCount - 2) / 2))
}

// players: [{ name, memberId, isGuest, colorIndex }]
// Renvoie players enrichis de { role, word } — word est null pour Mr. White.
export function assignRoles(players, undercoverCount, mrWhiteCount) {
  const [civilianWord, undercoverWord] = WORD_PAIRS[Math.floor(Math.random() * WORD_PAIRS.length)]
  const shuffled = shuffle(players)

  return shuffled.map((p, i) => {
    if (i < undercoverCount) return { ...p, role: ROLE_UNDERCOVER, word: undercoverWord }
    if (i < undercoverCount + mrWhiteCount) return { ...p, role: ROLE_MRWHITE, word: null }
    return { ...p, role: ROLE_CIVILIAN, word: civilianWord }
  })
}

// Mr. White n'a aucun mot : le faire parler en premier ne lui laisse rien sur quoi bluffer.
// Règle de maison courante reproduite ici : jamais en première place de l'ordre de parole.
export function buildSpeakingOrder(players) {
  const order = shuffle(players)
  if (order.length > 1 && order[0].role === ROLE_MRWHITE) {
    const swapIndex = 1 + Math.floor(Math.random() * (order.length - 1))
    ;[order[0], order[swapIndex]] = [order[swapIndex], order[0]]
  }
  return order
}

// Vérifie les conditions de victoire parmi les joueurs encore vivants.
// Renvoie 'civilians' | 'undercover' | null (partie continue).
export function checkWinner(alivePlayers) {
  const aliveCivilians = alivePlayers.filter(p => p.role === ROLE_CIVILIAN).length
  const aliveThreats = alivePlayers.filter(p => p.role !== ROLE_CIVILIAN).length

  if (aliveThreats === 0) return 'civilians'
  if (aliveThreats >= aliveCivilians) return 'undercover'
  return null
}
