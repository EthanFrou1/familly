import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useMembers } from '../store/MembersContext'
import { gamesApi, familleEnOrApi } from '../services/api'
import { membersWithPhoto, MIN_PAIRS_TO_UNLOCK } from '../utils/memoryGame'
import { MIN_MEMBERS_TO_UNLOCK as MIN_MEMBERS_FOR_WHOISIT } from '../utils/whoIsItGame'
import { MIN_MEMBERS_TO_UNLOCK as MIN_MEMBERS_FOR_RELATIONSHIP } from '../utils/relationshipGame'
import { MIN_SUBJECTS_TO_UNLOCK, eligibleSubjectsCount } from '../utils/whoAmIGame'
import { MIN_MEMBERS_TO_UNLOCK as MIN_MEMBERS_FOR_TRIVIA, eligibleMembersCount as eligibleTriviaMembersCount } from '../utils/familyTriviaGame'
import { MIN_MEMBERS_TO_UNLOCK as MIN_MEMBERS_FOR_DAILY_MYSTERY } from '../utils/dailyMystery'
import { MIN_MEMBERS_TO_UNLOCK as MIN_MEMBERS_FOR_UNDERCOVER } from '../utils/undercoverGame'
import { MIN_MEMBERS_TO_UNLOCK as MIN_MEMBERS_FOR_FOREHEAD } from '../utils/foreheadThemes'
import { GAMES, GAME_LABELS, GAME_UNIT_LABELS } from '../utils/gameRegistry'
import { connectHub, gameHub, onHubEvent } from '../services/gameHub'
import OpenRoomsList from '../components/games/OpenRoomsList'
import LeaderboardView from '../components/games/LeaderboardView'
import DailyMysteryHero from '../components/games/DailyMysteryHero'
import Avatar from '../components/shared/Avatar'

const MIN_MEMBERS_FOR_SUPERLATIVE = 3
const MIN_MEMBERS_FOR_FAMILLENOR = 4
const MIN_READY_QUESTIONS_FOR_FAMILLENOR = 4

const TABS = [
  { key: 'games', label: 'Jeux' },
  { key: 'open', label: 'Parties ouvertes' },
  { key: 'leaderboard', label: 'Classement' },
]

function formatDate(dateStr) {
  return new Date(dateStr).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' })
}

export default function GamesLobby() {
  const { members } = useMembers()
  const navigate = useNavigate()
  const [tab, setTab] = useState('games')
  const [recentResults, setRecentResults] = useState([])
  const [historyOpen, setHistoryOpen] = useState(false)
  const [openRooms, setOpenRooms] = useState([])
  const [famillenorReadyCount, setFamillenorReadyCount] = useState(0)

  const photoCount = membersWithPhoto(members).length
  const unlocked = photoCount >= MIN_PAIRS_TO_UNLOCK
  const whoIsItUnlocked = photoCount >= MIN_MEMBERS_FOR_WHOISIT
  const relationshipUnlocked = members.length >= MIN_MEMBERS_FOR_RELATIONSHIP
  const superlativeUnlocked = members.length >= MIN_MEMBERS_FOR_SUPERLATIVE
  const whoAmIUnlocked = eligibleSubjectsCount(members) >= MIN_SUBJECTS_TO_UNLOCK
  const triviaUnlocked = eligibleTriviaMembersCount(members) >= MIN_MEMBERS_FOR_TRIVIA
  const dailyMysteryUnlocked = members.length >= MIN_MEMBERS_FOR_DAILY_MYSTERY
  const famillenorPlayable = members.length >= MIN_MEMBERS_FOR_FAMILLENOR && famillenorReadyCount >= MIN_READY_QUESTIONS_FOR_FAMILLENOR
  const undercoverUnlocked = members.length >= MIN_MEMBERS_FOR_UNDERCOVER
  const foreheadUnlocked = members.length >= MIN_MEMBERS_FOR_FOREHEAD
  const fanMembers = membersWithPhoto(members).slice(0, 3)
  const memberById = new Map(members.map(m => [m.id, m]))

  useEffect(() => {
    Promise.all(GAMES.map(g => gamesApi.getResults(g.key, 10)))
      .then(responses => {
        const merged = responses.flatMap(r => r.data)
          .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
          .slice(0, 15)
        setRecentResults(merged)
      })
      .catch(() => {})

    familleEnOrApi.getQuestions()
      .then(({ data }) => setFamillenorReadyCount(data.filter(q => q.isReady).length))
      .catch(() => {})
  }, [])

  useEffect(() => {
    let cancelled = false

    connectHub()
      .then(() => gameHub.getOpenRooms())
      .then(list => { if (!cancelled) setOpenRooms(list) })
      .catch(() => {})

    const off = onHubEvent('RoomsChanged', setOpenRooms)
    return () => { cancelled = true; off() }
  }, [])

  const latestResult = recentResults[0]
  const olderResults = recentResults.slice(1)

  const joinableRoomsCount = openRooms.filter(r => r.playerCount < r.maxPlayers).length

  return (
    <div className="overflow-y-auto h-full bg-gray-50 pb-24">
      <div className="bg-dark px-5 pt-12 pb-4">
        <h1 className="text-2xl font-black text-white">Jeux 🎲</h1>
        <p className="text-white/70 text-sm mt-0.5 font-medium">Amusez-vous en famille</p>
      </div>

      <div className="px-4 mt-5">
        <div className="flex gap-1.5 bg-black/5 p-1.5 rounded-2xl mb-5">
          {TABS.map(t => (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              className={`relative flex-1 rounded-xl py-2.5 text-xs font-bold transition-colors ${
                tab === t.key ? 'bg-white text-primary shadow-sm' : 'text-gray-500'
              }`}
            >
              {t.label}
              {t.key === 'open' && joinableRoomsCount > 0 && (
                <span className="absolute -top-1.5 -right-1 h-4 min-w-4 px-1 rounded-full bg-red-500 text-white text-[10px] font-bold flex items-center justify-center ring-2 ring-white">
                  {joinableRoomsCount}
                </span>
              )}
            </button>
          ))}
        </div>

        {tab === 'games' && (
          <div className="space-y-4">
            <DailyMysteryHero unlocked={dailyMysteryUnlocked} minMembers={MIN_MEMBERS_FOR_DAILY_MYSTERY} />

            <div className="relative rounded-3xl bg-dark shadow-lg shadow-black/10 overflow-hidden p-5">
              <span className="absolute top-4 right-4 rounded-full bg-primary/90 text-white text-[10px] font-extrabold tracking-wide px-2.5 py-1">
                POPULAIRE
              </span>

              <div className="relative h-24 mb-1">
                {fanMembers.map((m, i) => {
                  const n = fanMembers.length
                  const mid = (n - 1) / 2
                  const offset = i - mid
                  const rotate = offset * 16
                  const isCenter = Math.abs(offset) < 0.5
                  return (
                    <div
                      key={m.id}
                      className="absolute left-1/2 bottom-0 rounded-xl bg-white flex items-center justify-center"
                      style={{
                        width: isCenter ? 64 : 60,
                        height: isCenter ? 86 : 80,
                        transform: `translateX(calc(-50% + ${offset * 46}px)) rotate(${rotate}deg)`,
                        border: `2px solid ${isCenter ? 'rgb(var(--color-primary))' : 'rgb(var(--color-primary) / 0.4)'}`,
                        zIndex: isCenter ? 2 : 1,
                        boxShadow: '0 10px 20px -6px rgba(0,0,0,.35)',
                      }}
                    >
                      <Avatar member={m} size={isCenter ? 46 : 40} />
                    </div>
                  )
                })}
              </div>

              <h2 className="text-xl font-black text-white text-center mt-3">Memory des photos</h2>
              <p className="text-sm text-white/75 font-medium text-center mt-2 mb-1">
                Retrouvez les paires de photos des membres de la famille.
              </p>
              <p className="text-xs text-white/60 text-center mb-4">
                📷 {photoCount}/{members.length} membres ont une photo
                {!unlocked && ` · ${MIN_PAIRS_TO_UNLOCK} min. pour débloquer`}
              </p>

              <button
                disabled={!unlocked}
                onClick={() => navigate('/games/memory')}
                className="w-full rounded-2xl bg-primary text-white font-black text-base py-4 flex items-center justify-center gap-2 shadow-lg shadow-primary/30 active:bg-primary-dark disabled:bg-white/10 disabled:text-white/40 disabled:shadow-none"
              >
                <svg className="h-4 w-4" fill="currentColor" viewBox="0 0 24 24"><path d="M8 5v14l11-7z" /></svg>
                Jouer
              </button>
            </div>

            <GameCard
              emoji="🕵️"
              title="Qui est-ce ?"
              description="Devinez qui se cache derrière chaque photo de profil."
              unlocked={whoIsItUnlocked}
              lockedHint={`${MIN_MEMBERS_FOR_WHOISIT} membres avec photo min. pour débloquer`}
              onPlay={() => navigate('/games/quiwho')}
            />

            <GameCard
              emoji="🌳"
              title="Quel est le lien ?"
              description="Devinez le lien de parenté entre deux membres de l'arbre."
              unlocked={relationshipUnlocked}
              lockedHint={`${MIN_MEMBERS_FOR_RELATIONSHIP} membres min. pour débloquer`}
              onPlay={() => navigate('/games/relationship')}
            />

            <GameCard
              emoji="🎉"
              title="Le plus susceptible de..."
              description="Chacun sur son téléphone : votez qui correspond le mieux à chaque question. Jusqu'à 10 joueurs !"
              unlocked={superlativeUnlocked}
              lockedHint={`${MIN_MEMBERS_FOR_SUPERLATIVE} membres min. pour débloquer`}
              onPlay={() => navigate('/games/superlative/remote')}
            />

            <GameCard
              emoji="❓"
              title="Qui suis-je ?"
              description="Des indices se révèlent peu à peu, devinez quel membre de la famille se cache derrière."
              unlocked={whoAmIUnlocked}
              lockedHint="Complétez plus de profils (bio, métier, sport...) pour débloquer"
              onPlay={() => navigate('/games/whoami/remote')}
            />

            <GameCard
              emoji="🧠"
              title="Quiz Famille"
              description="Date de naissance, ville, qui est né en premier... Répondez au plus vite ! Jusqu'à 10 joueurs."
              unlocked={triviaUnlocked}
              lockedHint={`${MIN_MEMBERS_FOR_TRIVIA} membres avec date de naissance min. pour débloquer`}
              onPlay={() => navigate('/games/familytrivia/remote')}
            />

            <button
              onClick={() => navigate(famillenorPlayable ? '/games/famillenor/remote' : '/games/famillenor/survey')}
              className="w-full flex items-center justify-between bg-white rounded-2xl px-4 py-4 shadow-sm active:scale-[0.99] transition-transform"
            >
              <div className="flex items-center gap-4 text-left">
                <span className="h-12 w-12 shrink-0 rounded-2xl bg-primary/10 flex items-center justify-center text-2xl">💰</span>
                <div>
                  <h2 className="font-extrabold text-gray-800">Une Famille en Or</h2>
                  <p className="text-sm text-gray-500 mt-0.5">
                    {famillenorPlayable
                      ? '2 équipes s\'affrontent sur un sondage familial. 4 à 8 joueurs !'
                      : `Réponds au sondage pour débloquer (${famillenorReadyCount}/${MIN_READY_QUESTIONS_FOR_FAMILLENOR} questions prêtes)`}
                  </p>
                </div>
              </div>
              <svg className="h-4 w-4 text-gray-300 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
              </svg>
            </button>

            <GameCard
              emoji="🎭"
              title="Undercover"
              description="Rôles secrets, indices à voix haute et vote pour démasquer les undercover. En local ou à distance."
              unlocked={undercoverUnlocked}
              lockedHint={`${MIN_MEMBERS_FOR_UNDERCOVER} membres min. pour débloquer`}
              onPlay={() => navigate('/games/undercover')}
            />

            <GameCard
              emoji="🙌"
              title="Sur le Front"
              description="Un tel sur le front, incliné vers le bas ou le haut pour faire deviner un max de mots à ton équipe."
              unlocked={foreheadUnlocked}
              lockedHint={`${MIN_MEMBERS_FOR_FOREHEAD} membres min. pour débloquer`}
              onPlay={() => navigate('/games/surlefront')}
            />

            {latestResult && (
              <div className="rounded-2xl bg-white shadow-sm overflow-hidden">
                <div className="px-4 pt-4 pb-3 flex items-center justify-between">
                  <h3 className="text-xs font-extrabold text-gray-400 uppercase tracking-wide">Dernière partie</h3>
                  {olderResults.length > 0 && (
                    <button onClick={() => setHistoryOpen(o => !o)} className="text-gray-400">
                      <svg
                        className={`h-4 w-4 transition-transform ${historyOpen ? 'rotate-180' : ''}`}
                        fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}
                      >
                        <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
                      </svg>
                    </button>
                  )}
                </div>
                <ResultRow result={latestResult} memberById={memberById} className="px-4 pb-4" />

                {historyOpen && olderResults.length > 0 && (
                  <div className="divide-y divide-gray-50 border-t border-gray-50">
                    {olderResults.map(r => (
                      <ResultRow key={r.id} result={r} memberById={memberById} className="px-4 py-3" />
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {tab === 'open' && <OpenRoomsList />}

        {tab === 'leaderboard' && <LeaderboardView />}
      </div>
    </div>
  )
}

function GameCard({ emoji, title, description, unlocked, lockedHint, onPlay }) {
  return (
    <button
      onClick={onPlay}
      disabled={!unlocked}
      className="w-full flex items-center justify-between bg-white rounded-2xl px-4 py-4 shadow-sm active:scale-[0.99] transition-transform disabled:opacity-60"
    >
      <div className="flex items-center gap-4 text-left">
        <span className="h-12 w-12 shrink-0 rounded-2xl bg-primary/10 flex items-center justify-center text-2xl">{emoji}</span>
        <div>
          <h2 className="font-extrabold text-gray-800">{title}</h2>
          <p className="text-sm text-gray-500 mt-0.5">{unlocked ? description : lockedHint}</p>
        </div>
      </div>
      <svg className="h-4 w-4 text-gray-300 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
      </svg>
    </button>
  )
}

function ResultRow({ result, memberById, className }) {
  const ranked = [...result.players].sort((a, b) => b.score - a.score)
  const winner = ranked[0]
  const gameLabel = GAME_LABELS[result.gameType] ?? result.gameType
  const unitLabel = GAME_UNIT_LABELS[result.gameType] ?? 'paires'

  return (
    <div className={`flex items-center gap-3 ${className}`}>
      <Avatar
        member={result.winnerName ? memberById.get(winner?.memberId) : null}
        name={result.winnerName ?? undefined}
        size="md"
      />
      <div className="flex-1 min-w-0">
        <p className="text-sm font-bold text-gray-800 truncate">
          {result.winnerName ? `🏆 ${result.winnerName} a gagné` : 'Égalité'}
        </p>
        <p className="text-xs text-gray-400 mt-0.5">
          {gameLabel} · {result.pairsCount} {unitLabel} · {result.playerCount} joueurs · {formatDate(result.createdAt)}
        </p>
      </div>
      <span className="text-lg font-black text-primary shrink-0">{winner?.score}</span>
    </div>
  )
}
