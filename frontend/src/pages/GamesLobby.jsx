import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useMembers } from '../store/MembersContext'
import { gamesApi } from '../services/api'
import { membersWithPhoto, MIN_PAIRS_TO_UNLOCK } from '../utils/memoryGame'

function formatDate(dateStr) {
  return new Date(dateStr).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' })
}

export default function GamesLobby() {
  const { members } = useMembers()
  const navigate = useNavigate()
  const [recentResults, setRecentResults] = useState([])

  const photoCount = membersWithPhoto(members).length
  const unlocked = photoCount >= MIN_PAIRS_TO_UNLOCK

  useEffect(() => {
    gamesApi.getResults('memory', 5)
      .then(({ data }) => setRecentResults(data))
      .catch(() => {})
  }, [])

  return (
    <div className="overflow-y-auto h-full bg-gray-50 pb-24">
      <div className="bg-dark px-5 pt-12 pb-4">
        <h1 className="text-2xl font-bold text-white">Jeux</h1>
        <p className="text-white/70 text-sm mt-0.5">Amusez-vous en famille</p>
      </div>

      <div className="px-4 mt-5 space-y-4">
        <div className="rounded-2xl bg-white shadow-sm overflow-hidden">
          <div className="p-4 flex items-start gap-4">
            <div className="h-14 w-14 shrink-0 rounded-2xl bg-primary flex items-center justify-center text-2xl">
              🧠
            </div>
            <div className="flex-1">
              <h2 className="font-semibold text-gray-800">Memory des photos</h2>
              <p className="text-sm text-gray-500 mt-0.5">
                Retrouvez les paires de photos des membres de la famille, à 2 à 4 joueurs.
              </p>
              {!unlocked && (
                <p className="text-xs text-amber-600 mt-2">
                  Ajoutez au moins {MIN_PAIRS_TO_UNLOCK} photos de profil pour débloquer ce jeu ({photoCount}/{MIN_PAIRS_TO_UNLOCK}).
                </p>
              )}
            </div>
          </div>
          <button
            disabled={!unlocked}
            onClick={() => navigate('/games/memory')}
            className="w-full py-3 text-sm font-semibold text-white bg-primary active:bg-primary-dark disabled:bg-gray-200 disabled:text-gray-400"
          >
            Jouer
          </button>
        </div>

        {recentResults.length > 0 && (
          <div className="rounded-2xl bg-white shadow-sm overflow-hidden">
            <div className="px-4 pt-4 pb-3 border-b border-gray-50">
              <h2 className="text-sm font-semibold text-gray-500">Dernières parties</h2>
            </div>
            <div className="divide-y divide-gray-50">
              {recentResults.map(r => {
                const ranked = [...r.players].sort((a, b) => b.score - a.score)
                return (
                  <div key={r.id} className="px-4 py-3">
                    <div className="flex items-center justify-between">
                      <p className="text-sm font-medium text-gray-700">
                        {r.winnerName ? `🏆 ${r.winnerName}` : 'Égalité'}
                      </p>
                      <span className="text-xs text-gray-400">{formatDate(r.createdAt)}</span>
                    </div>
                    <p className="text-xs text-gray-400 mt-0.5">{r.pairsCount} paires · {r.playerCount} joueurs</p>
                    <p className="text-xs text-gray-500 mt-1.5">
                      {ranked.map((p, i) => `${i + 1}. ${p.name} (${p.score})`).join(' · ')}
                    </p>
                  </div>
                )
              })}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
