// La génération réelle des indices se fait côté serveur (WhoAmIRoundGenerator.cs), pour ne
// jamais exposer le membre-sujet avant résolution du round. Ce fichier ne sert qu'à calculer
// le déblocage du jeu côté front (assez de membres ont des données exploitables).

export const MIN_SUBJECTS_TO_UNLOCK = 4

export function eligibleSubjectsCount(members) {
  return members.filter(m => nonNullFieldCount(m) >= 2).length
}

function nonNullFieldCount(member) {
  return (
    (member.birthDate ? 1 : 0) +
    (member.occupation?.trim() ? 1 : 0) +
    (member.sport?.trim() ? 1 : 0) +
    (member.bio?.trim() ? 1 : 0)
  )
}
