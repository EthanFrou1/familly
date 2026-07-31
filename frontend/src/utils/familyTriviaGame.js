// La génération réelle des questions se fait côté serveur (FamilyTriviaRoundGenerator.cs), pour
// ne jamais exposer la bonne réponse avant résolution du round. Ce fichier ne sert qu'à calculer
// le déblocage du jeu côté front et à afficher les catégories de questions.

export const MIN_MEMBERS_TO_UNLOCK = 4

export const CATEGORIES = [
  { key: 'birthdate', label: 'Date de naissance', emoji: '🎂' },
  { key: 'birth_day', label: 'Jour du mois', emoji: '📅' },
  { key: 'birth_order', label: 'Qui est né en premier', emoji: '⏳' },
  { key: 'age', label: 'Âge actuel', emoji: '🎈' },
  { key: 'city', label: 'Ville', emoji: '📍' },
  { key: 'phone', label: 'Numéro de téléphone', emoji: '📞' },
]

export const DEFAULT_CATEGORY_KEYS = CATEGORIES.map(c => c.key)

// Au moins la catégorie "date de naissance" doit être jouable (4 membres avec une date de
// naissance renseignée) pour proposer le jeu — les autres catégories sont juste ignorées côté
// serveur si elles n'ont pas assez de données.
export function eligibleMembersCount(members) {
  return members.filter(m => m.birthDate).length
}
