export const MIN_MEMBERS_TO_UNLOCK = 8

// Ordre d'affichage des colonnes de la grille. `branch` est masquée dynamiquement
// par le backend (showBranchColumn) si la famille n'a qu'une seule branche/aucune.
export const ATTRIBUTE_COLUMNS = [
  { key: 'generation', label: 'Génération', emoji: '🌳', description: "Même génération, génération proche (parent/enfant direct) ou éloignée par rapport à la réponse." },
  { key: 'birthYear', label: 'Naissance', emoji: '🎂', description: "Année de naissance du membre proposé, affichée directement dans la case." },
  { key: 'city', label: 'Ville', emoji: '📍', description: "Même ville, à moins de 500km (mais autre ville), ou plus loin." },
  { key: 'gender', label: 'Sexe', emoji: '🚻', description: "Même sexe que la réponse ou non." },
  { key: 'branch', label: 'Famille', emoji: '🌿', description: "Même famille (utile pour les familles recomposées) ou non." },
  { key: 'alive', label: 'Vivant', emoji: '🔁', description: "Vivant ou décédé, comme la réponse ou non." },
]
