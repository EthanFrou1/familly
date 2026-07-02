import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useMembers } from '../store/MembersContext'
import { gamesApi } from '../services/api'
import { membersWithPhoto, MIN_PAIRS_TO_UNLOCK } from '../utils/memoryGame'
import OpenRoomsList from '../components/games/OpenRoomsList'
import LeaderboardView from '../components/games/LeaderboardView'
import Avatar from '../components/shared/Avatar'

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

  const photoCount = membersWithPhoto(members).length
  const unlocked = photoCount >= MIN_PAIRS_TO_UNLOCK
  const fanMembers = membersWithPhoto(members).slice(0, 3)
  const memberById = new Map(members.map(m => [m.id, m]))

  useEffect(() => {
    gamesApi.getResults('memory', 10)
      .then(({ data }) => setRecentResults(data))
      .catch(() => {})
  }, [])

  const latestResult = recentResults[0]
  const olderResults = recentResults.slice(1)

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
              className={`flex-1 rounded-xl py-2.5 text-xs font-bold transition-colors ${
                tab === t.key ? 'bg-white text-primary shadow-sm' : 'text-gray-500'
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>

        {tab === 'games' && (
          <div className="space-y-4">
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

function ResultRow({ result, memberById, className }) {
  const ranked = [...result.players].sort((a, b) => b.score - a.score)
  const winner = ranked[0]

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
          {result.pairsCount} paires · {result.playerCount} joueurs · {formatDate(result.createdAt)}
        </p>
      </div>
      <span className="text-lg font-black text-primary shrink-0">{winner?.score}</span>
    </div>
  )
}
