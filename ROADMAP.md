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
- [x] Notifications push (anniversaires, nouveaux membres)
- [x] PWA installable, mise à jour auto du service worker (reload forcé sur nouvelle version)
- [x] Historique d'activité (fil d'actu, logs par membre)

### Jeux
- [x] Page **Jeux** avec onglets : Jeux / Parties ouvertes / Classement
- [x] **Memory des photos** — retrouver les paires de photos de membres (local + à distance)
- [x] **Qui est-ce ?** — deviner le membre à partir de sa photo (local + à distance)
- [x] **Quel est le lien ?** — deviner le lien de parenté entre deux membres (local + à distance)
- [x] Mode **local** (passe-partout, un seul téléphone) pour les 3 jeux, avec liaison/invité par joueur
- [x] Mode **à distance** (2 à 4 joueurs, chacun son téléphone, temps réel via SignalR) pour les 3 jeux
  - [x] Créer une partie (code à 5 caractères) / rejoindre par code
  - [x] Onglet "Parties ouvertes" : liste live des salons en attente, rejoignables en un tap
  - [x] Roue de tirage au sort de l'ordre de jeu (composant générique réutilisable)
  - [x] Annulation de la partie si un joueur se déconnecte (pas de reconnexion en v1)
  - [x] Chrono en direct pendant la partie (mm:ss, aligné sur le temps final sauvegardé)
- [x] Classements : par jeu + classement global (moyenne des taux de victoire), podium (couronne 1er, médailles 2e/3e), tag "Vous"
- [x] Historique des parties (Jeux → dernière partie + historique dépliable)
- [x] Stats sur le profil membre (parties jouées, victoires, défaites, meilleur temps sur Memory)
- [x] Stats fun sur la Home ("Le boss du Memory", "Lanterne rouge")

---

## 🚧 Idées déjà évoquées, pas commencées

- [ ] **Devine l'âge** — à partir d'une photo, deviner l'âge/l'année de naissance, classement au plus proche (3ᵉ idée de jeu évoquée, pas encore construite)
- [ ] Reconnexion en partie à distance (aujourd'hui : une déconnexion annule la partie pour tout le monde)

## 💡 Idées en vrac / à creuser

- (à compléter au fil des discussions)

---

## 🧠 Notes techniques importantes

- **SignalR ≠ cookie** : le hub tourne en direct sur Railway (le proxy Vercel `/api/*` ne gère pas les WebSockets), donc le cookie `access_token` posé pour `mybigfamily.fr` n'est jamais envoyé sur `railway.app`. Le client SignalR envoie le JWT via `accessTokenFactory` (query string), lu côté serveur uniquement pour les chemins `/hubs/*`.
- **`VITE_API_URL` doit rester vide** en prod pour que les appels REST utilisent des URLs relatives via le proxy Vercel (sinon CORS cassé — cf. incident déjà rencontré).
- **`db.Database.Migrate()`** tourne dans tous les environnements au démarrage (pas seulement en dev).
- **État de partie en mémoire** : si le process backend redémarre (déploiement Railway), toutes les parties à distance en cours sont perdues (pas de persistance intermédiaire, seul le résultat final compte).
- **Palette de couleurs** : figée dans `index.css` (palette "Automne" : primary doré `#C49A36`, dark vert `#2D7A42`). Le système de thèmes multiples (`useTheme.js`, `ThemePicker.jsx`) a été retiré — utiliser les classes Tailwind sémantiques (`bg-primary`, `bg-dark`, etc.) plutôt qu'une couleur en dur, mais il n'y a plus qu'une seule palette possible.
