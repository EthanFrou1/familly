export const THEMES = [
  {
    key: 'animaux',
    label: 'Animaux',
    emoji: '🐾',
    words: [
      'Lion', 'Éléphant', 'Girafe', 'Kangourou', 'Pingouin', 'Dauphin', 'Tigre', 'Ours',
      'Renard', 'Écureuil', 'Hibou', 'Crocodile', 'Perroquet', 'Zèbre', 'Panda', 'Koala',
      'Baleine', 'Requin', 'Chameau', 'Hérisson',
    ],
  },
  {
    key: 'celebrites',
    label: 'Célébrités & perso',
    emoji: '🌟',
    words: [
      'Superman', 'Batman', 'Harry Potter', 'Cendrillon', 'Sherlock Holmes', 'James Bond',
      'Mickey Mouse', 'Dark Vador', 'Spider-Man', 'Indiana Jones', 'Zorro', 'Robin des Bois',
      'Napoléon', 'Einstein', 'Mona Lisa', 'Père Noël', 'Cléopâtre', 'Beyoncé', 'Charlie Chaplin', 'Mario',
    ],
  },
  {
    key: 'metiers',
    label: 'Métiers',
    emoji: '💼',
    words: [
      'Boulanger', 'Pompier', 'Médecin', 'Facteur', 'Astronaute', 'Coiffeur', 'Professeur',
      'Policier', 'Vétérinaire', 'Cuisinier', 'Plombier', 'Musicien', 'Pilote', 'Menuisier',
      'Jardinier', 'Dentiste', 'Journaliste', 'Photographe', 'Agriculteur', 'Électricien',
    ],
  },
  {
    key: 'objets',
    label: 'Objets du quotidien',
    emoji: '🧸',
    words: [
      'Parapluie', 'Brosse à dents', 'Téléphone', 'Lunettes', 'Chaise', 'Réveil', 'Clé',
      'Miroir', 'Valise', 'Casserole', 'Ceinture', 'Oreiller', 'Bougie', 'Balai', 'Échelle',
      'Ciseaux', 'Chaussette', 'Portefeuille', 'Thermomètre', 'Aspirateur',
    ],
  },
  {
    key: 'films',
    label: 'Films & séries',
    emoji: '🎬',
    words: [
      'Titanic', 'Star Wars', 'Le Roi Lion', 'Avatar', 'Jurassic Park', 'Frozen', 'Shrek',
      'Pirates des Caraïbes', 'Matrix', 'Toy Story', 'Le Seigneur des Anneaux', 'Stranger Things',
      'Friends', 'Game of Thrones', 'Ratatouille', 'Cars', 'La Reine des Neiges', 'Les Simpson',
      'Squid Game', 'Astérix',
    ],
  },
  {
    key: 'sports',
    label: 'Sports',
    emoji: '⚽',
    words: [
      'Football', 'Tennis', 'Natation', 'Basketball', 'Judo', 'Boxe', 'Ski', 'Escalade',
      'Rugby', 'Golf', 'Volleyball', 'Handball', 'Cyclisme', 'Athlétisme', 'Karaté', 'Surf',
      'Patinage', 'Gymnastique', 'Équitation', 'Bowling',
    ],
  },
]

export const MIN_MEMBERS_TO_UNLOCK = 4 // 2 équipes de 2 minimum

export function buildWordPool(themeKeys) {
  const words = THEMES
    .filter(t => themeKeys.includes(t.key))
    .flatMap(t => t.words)

  return [...new Set(words)]
}
