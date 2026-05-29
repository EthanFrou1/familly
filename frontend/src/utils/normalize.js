// Normalise une chaîne pour la recherche : retire les accents, met en minuscule
export function normalize(str) {
  if (!str) return ''
  return str
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLowerCase()
    .trim()
}

// Vérifie si haystack contient needle (insensible à la casse ET aux accents)
export function matchesSearch(haystack, needle) {
  return normalize(haystack).includes(normalize(needle))
}
