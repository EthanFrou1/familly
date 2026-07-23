# 🗺️ Feuille de route — FamilyApp

> Fiche de suivi du projet : ce qui existe, ce qui est en cours, et les idées en attente.
> À tenir à jour au fil des sessions (cocher/décocher, ajouter des lignes) pour ne pas perdre le fil d'une fois sur l'autre.

## Vue d'ensemble

PWA mobile-first privée pour une famille (~100 membres), accès sur invitation uniquement.

- **Frontend** : React + Vite + Tailwind CSS + React Router + D3.js (arbre) + Leaflet (carte) — hébergé sur Vercel (`mybigfamily.fr`)
- **Backend** : ASP.NET Core 8 + Entity Framework Core + PostgreSQL (Neon) + Cloudinary (photos) — hébergé sur Railway
- **Temps réel** : SignalR (`GameHub`), état de partie en mémoire côté serveur (pas de persistance de l'état en cours, seul le résultat final est sauvegardé)
- **Auth** : JWT (cookie httpOnly pour les appels REST classiques, query string pour SignalR — voir notes techniques)

---

## ✅ Fonctionnalités en place

### Cœur de l'app
- [x] Auth par invitation, rôles (Admin / Member / ReadOnly)
- [x] Arbre généalogique interactif (D3), filtre par personne, familles recomposées (triple-slot)
- [x] Fiches membres (CRUD, infos, réseaux sociaux, liens familiaux, export contacts/anniversaires)
- [x] Gestion multi-familles (regroupement, photo de groupe, "pièces rapportées")
- [x] Photos (upload, albums, catégories, nettoyage automatique)
- [x] Timeline des événements familiaux
- [x] Carte des membres (Leaflet)
- [x] Espace Admin (aperçu membres, doublons, rôles, invitations)
- [x] Notifications push (anniversaires, nouveaux membres, défis entre membres — voir section Jeux)
- [x] PWA installable, mise à jour auto du service worker (reload forcé sur nouvelle version)
- [x] Historique d'activité (fil d'actu, logs par membre)

### Jeux
- [x] Page **Jeux** avec onglets : Jeux / Parties ouvertes / Classement
- [x] **Memory des photos** — retrouver les paires de photos de membres (local + à distance)
- [x] **Qui est-ce ?** — deviner le membre à partir de sa photo (local + à distance)
- [x] **Quel est le lien ?** — deviner le lien de parenté entre deux membres (local + à distance)
- [x] **Le/la plus susceptible de...** — vote collectif sur des questions, jusqu'à 10 joueurs (à distance uniquement)
- [x] **Qui suis-je ?** — indices progressifs sur un membre à deviner (à distance uniquement)
- [x] Mode **local** (passe-partout, un seul téléphone) pour Memory / Qui est-ce / Quel est le lien, avec liaison/invité par joueur
- [x] Mode **à distance** (2 à 10 joueurs selon le jeu, chacun son téléphone, temps réel via SignalR) pour Memory / Qui est-ce / Quel est le lien / Le plus susceptible / Qui suis-je
  - [x] Créer une partie (code à 5 caractères) / rejoindre par code
  - [x] Onglet "Parties ouvertes" : liste live des salons en attente, rejoignables en un tap
  - [x] Roue de tirage au sort de l'ordre de jeu (composant générique réutilisable)
  - [x] Annulation de la partie si un joueur se déconnecte pendant une partie déjà lancée (pas de reconnexion en pleine partie)
  - [x] Reconnexion tolérée en salon d'attente (avant lancement) : un même membre qui revient remplace son entrée fantôme au lieu d'être rejeté (utile après mise en arrière-plan/fermeture de la PWA)
  - [x] Défier des membres par notification push directement depuis le salon d'attente (lien direct vers la partie en cours) — uniquement les membres avec notifs activées **et** app installée en PWA (voir notes techniques)
  - [x] Chrono en direct pendant la partie (mm:ss, aligné sur le temps final sauvegardé)
- [x] **Le Membre Mystère** — jeu quotidien façon Wordle (un membre à deviner par jour, pour toute la famille), essais illimités, grille de comparaison (génération, année de naissance, ville [par département français, "non défini" hors France plutôt qu'un faux "différent"], sexe, famille, vivant/décédé), streak (jours consécutifs résolus) + record, classement dédié tous jours confondus (parties jouées/résolues, taux de réussite)
  - [x] Lobby à onglets : Aujourd'hui (essais en cours) / Hier (résultats définitifs de la veille) / Cette semaine (points) — CTA masqué une fois le défi du jour déjà résolu
  - [x] Classement à points remis à zéro chaque lundi : 2 pts pour qui trouve en le moins d'essais ce jour-là (égalité incluse), 1 pt pour les autres réussites — jour en cours toujours exclu tant qu'il n'est pas terminé (jamais de points provisoires)
- [x] **Une Famille en Or** — Family Feud familial, premier jeu en équipe de l'app (2 équipes, à distance uniquement)
  - [x] Sondage texte libre (banque de ~20 questions fixe dans le code, une réponse par membre et par question, verrouillée une fois la question "prête")
  - [x] Curation admin (`/admin/famillenor`) : regroupement manuel des réponses similaires en catégories, points = nombre de réponses par catégorie (pas de barème à définir à la main), toute réponse non groupée devient sa propre catégorie au moment de marquer la question prête
  - [x] Lobby avec répartition manuelle des joueurs en 2 équipes (min. 2 par équipe) avant de choisir le nombre de manches
  - [x] Manche à 3 phases : face-off (buzzer, le premier arrivé prend la main pour son équipe), contrôle (l'équipe propose des réponses, 3 fautes = perte de la main), vol (l'équipe adverse tente un essai unique sur la banque restante)
  - [x] Carte de jeu dans la lobby à CTA dynamique : "Répondre au sondage" tant qu'il n'y a pas assez de questions prêtes, "Jouer" une fois débloqué
- [x] **Undercover** — déduction sociale à rôles cachés (civils/undercover/Mr. White), **local et à distance**
  - [x] Indices donnés à voix haute (l'appli ne gère que l'ordre de parole, aucun texte d'indice tapé/affiché)
  - [x] Écran de configuration : l'hôte choisit le nombre d'undercover et de Mr. White (0 ou 1) avant de lancer
  - [x] Révélation privée du rôle une seule fois au lancement : tap pour voir/cacher avant de passer le téléphone (local) ou message privé au démarrage (à distance)
  - [x] Vote d'élimination simultané (à distance) ou à main levée avec sélection par l'hôte (local) ; égalité = personne n'est éliminé
  - [x] Mr. White éliminé a une tentative pour deviner le mot des civils et gagner quand même
  - [x] Victoire : civils si tous les undercover/Mr. White sont éliminés, undercover si leurs vivants ≥ civils vivants
- [x] **Sur le Front** — façon Heads Up!, téléphone posé sur le front et incliné pour deviner des mots, **local uniquement**
  - [x] Équipes de 2 à 4, slots liables à un membre de la famille (recherche, un membre ne peut pas être lié dans deux équipes) ou invité en texte libre, +/− par équipe pour ajouter/retirer des joueurs
  - [x] Choix d'un thème unique via un carrousel façon "roue" (carte centrale nette, voisines réduites/estompées selon le scroll) — 6 thèmes (Animaux, Célébrités & perso, Métiers, Objets du quotidien, Films & séries, Sports), 50 mots chacun
  - [x] Réglages : durée par joueur (30/45/60s), nombre de manches (2 à 4)
  - [x] Détection d'inclinaison du téléphone (`DeviceOrientationEvent`, calibration au début du tour + anti-rebond, axe choisi selon l'orientation écran portrait/paysage) pour valider (tête baissée) / passer (tête relevée) — boutons ✅/⏭️ manuels toujours affichés en repli (capteur indisponible, permission refusée, ou simplement par préférence)
  - [x] Verrouillage best-effort de l'orientation en paysage au lancement du tour + mise en page adaptée paysage/portrait (le tel est tenu à l'horizontale contre le front)
  - [x] Compte à rebours de 5s avant chaque tour, flash de fond vert/rouge selon le résultat, header masqué pendant le tour (juste trois points en haut pour mettre en pause : chrono et capteur suspendus, reprise ou abandon)
  - [x] Récap de tour éditable (corriger un mot mal détecté par le capteur avant de valider les points de l'équipe)
  - [x] Tirage des mots sans répétition sur une manche (mélange du pool entier en début de tour, pioche sans remise)
- [x] Classements : par jeu + classement global (moyenne des taux de victoire) + classement Membre Mystère (agrégé séparément, hors GameResult), podium (couronne 1er, médailles 2e/3e), tag "Vous"
- [x] Recherche de membre insensible aux accents (utilitaire `matchesSearch`) partout où on cherche un membre : jeux, arbre, fiches membres, admin, familles
- [x] Historique des parties (Jeux → dernière partie + historique dépliable, limité aux 15 plus récentes tous jeux confondus)
- [x] Stats sur le profil membre (parties jouées, victoires, défaites, meilleur temps sur Memory)
- [x] Stats fun sur la Home ("Le boss du Memory", "Lanterne rouge")

---

## 🚧 Idées déjà évoquées, pas commencées

- [ ] **Devine l'âge** — à partir d'une photo, deviner l'âge/l'année de naissance, classement au plus proche (idée de jeu évoquée, pas encore construite)
- [ ] Reconnexion en **pleine partie** à distance (une déconnexion en cours de partie annule toujours la partie pour tout le monde — seule la reconnexion en salon d'attente avant lancement est gérée, voir section Jeux)

## 💡 Idées en vrac / à creuser

- (à compléter au fil des discussions)

---

## 🧠 Notes techniques importantes

- **SignalR ≠ cookie** : le hub tourne en direct sur Railway (le proxy Vercel `/api/*` ne gère pas les WebSockets), donc le cookie `access_token` posé pour `mybigfamily.fr` n'est jamais envoyé sur `railway.app`. Le client SignalR envoie le JWT via `accessTokenFactory` (query string), lu côté serveur uniquement pour les chemins `/hubs/*`.
- **`VITE_API_URL` doit rester vide** en prod pour que les appels REST utilisent des URLs relatives via le proxy Vercel (sinon CORS cassé — cf. incident déjà rencontré).
- **`db.Database.Migrate()`** tourne dans tous les environnements au démarrage (pas seulement en dev).
- **État de partie en mémoire** : si le process backend redémarre (déploiement Railway), toutes les parties à distance en cours sont perdues (pas de persistance intermédiaire, seul le résultat final compte). Les salons (`GameSessionStore`) suivent les joueurs par `ConnectionId` SignalR, pas par utilisateur : `JoinRoom` traite un `MemberId` déjà présent comme une reconnexion (remplace l'entrée fantôme) plutôt que de rejeter, pour tolérer les PWA mises en arrière-plan/tuées sans `LeaveRoom` propre.
- **Palette de couleurs** : figée dans `index.css` (palette "Automne" : primary doré `#C49A36`, dark vert `#2D7A42`). Le système de thèmes multiples (`useTheme.js`, `ThemePicker.jsx`) a été retiré — utiliser les classes Tailwind sémantiques (`bg-primary`, `bg-dark`, etc.) plutôt qu'une couleur en dur, mais il n'y a plus qu'une seule palette possible.
- **Défi entre membres (push)** : `PushSubscription.IsStandalone` marque un abonnement comme "installé en PWA" (détecté via `matchMedia('(display-mode: standalone)')` / `navigator.standalone`). Seuls les abonnements avec ce flag sont ciblés par `POST /api/push/challenge`. Ce flag n'existait pas avant son ajout — `usePushNotifications` le resynchronise à chaque ouverture d'app tant qu'un abonnement local existe, pour rattraper les abonnements créés avant cet ajout.
- **`ExecuteUpdateAsync` s'exécute immédiatement**, hors du change tracker : si la requête référence une entité tout juste ajoutée via `db.Add(...)` (pas encore en base), elle échoue (violation de clé étrangère) tant qu'un `SaveChangesAsync()` intermédiaire n'a pas réellement inséré cette entité. Vu dans `FamilleEnOrService.CreateGroupAsync` — un `SaveChangesAsync()` après `Add(group)` est nécessaire avant le `ExecuteUpdateAsync` qui rattache des réponses à ce groupe.
- **Clic sur notif → navigation** : sur iOS/Safari en PWA, `clients.openWindow()` sur une fenêtre déjà ouverte ne change pas sa route (limitation WebKit connue), elle est juste ramenée au premier plan. Le service worker (`sw.js`) délègue donc la navigation à l'app via `postMessage({ type: 'navigate', url })`, écouté dans `ProtectedLayoutContent` (`App.jsx`) qui appelle `navigate(url)`.
- **Permission capteurs de mouvement (iOS)** : `DeviceOrientationEvent.requestPermission()` est une restriction WebKit qu'on ne peut pas contourner en code — obligatoirement déclenchée par un tap, aucun équivalent sur Android/Chrome/desktop (pas de prompt du tout). Elle n'est redemandée qu'une fois par session de page (pas à chaque manche/replay), mais iOS ne mémorise rien d'une vraie recharge à l'autre. Voir `useTiltDetector.js` (Sur le Front).
- **`beta`/`gamma` sont relatifs au châssis du téléphone, pas à l'écran affiché** : tenu à l'horizontale (paysage), le mouvement avant/arrière qui change `beta` en portrait se retrouve sur `gamma`. `useTiltDetector.js` relit `screen.orientation.angle` à chaque évènement pour choisir le bon axe (et le bon signe) — sinon la détection d'inclinaison ne fonctionne tout simplement pas une fois le tel tourné.
