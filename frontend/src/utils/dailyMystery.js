export const MIN_MEMBERS_TO_UNLOCK = 8

// Ordre d'affichage des colonnes de la grille. `branch` est masquée dynamiquement
// par le backend (showBranchColumn) si la famille n'a qu'une seule branche/aucune.
export const ATTRIBUTE_COLUMNS = [
  { key: 'generation', label: 'Génération', emoji: '🌳', description: "Même génération, génération proche (parent/enfant direct) ou éloignée par rapport à la réponse. Point d'interrogation si le lien de parenté n'a pas pu être déterminé." },
  { key: 'birthYear', label: 'Naissance', emoji: '🎂', description: "Année de naissance du membre proposé, affichée directement dans la case. Point d'interrogation si la date de naissance manque." },
  { key: 'city', label: 'Ville', emoji: '📍', description: "Même ville, même département (mais autre ville), ou autre département/pays. Point d'interrogation si l'info manque (adresse hors France ou incomplète)." },
  { key: 'gender', label: 'Sexe', emoji: '🚻', description: "Même sexe que la réponse ou non. Point d'interrogation si le sexe n'est pas renseigné." },
  { key: 'branch', label: 'Famille', emoji: '🌿', description: "Même famille (utile pour les familles recomposées) ou non. Point d'interrogation si le membre n'est rattaché à aucune famille." },
  { key: 'alive', label: 'Vivant', emoji: '🔁', description: "Vivant ou décédé, comme la réponse ou non." },
]
