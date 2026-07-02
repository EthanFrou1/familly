import { useEffect, useMemo, useState } from 'react'
import { useMembers } from '../../store/MembersContext'
import { useAuth } from '../../hooks/useAuth'
import { gamesApi } from '../../services/api'
import { GAMES, GAME_FULL_LABELS, GAME_EMOJIS } from '../../utils/gameRegistry'
import Avatar from '../shared/Avatar'
import Podium from './Podium'

const TABS = [{ key: 'global', label: 'Global' }, ...GAMES]

export default function LeaderboardView() {
  const { members } = useMembers()
  const { user } = useAuth()
  const memberById = useMemo(() => new Map(members.map(m => [m.id, m])), [members])

  const [tab, setTab] = useState('global')
  const [entries, setEntries] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    setLoading(true)
    const request = tab === 'global' ? gamesApi.getGlobalLeaderboard() : gamesApi.getLeaderboard(tab)
    request
      .then(({ data }) => setEntries(data))
      .catch(() => setEntries([]))
      .finally(() => setLoading(false))
  }, [tab])

  function statLabel(e) {
    return tab === 'global' ? `${e.averageWinRate}%` : `${e.winRate}% · ${e.wins}V`
  }

  const podiumEntries = entries.slice(0, 3).map(e => ({
    memberId: e.memberId,
    name: e.name,
    statLabel: statLabel(e),
    isYou: e.memberId === user?.memberId,
  }))
  const rest = entries.slice(3)

  return (
    <div>
      <div className="flex gap-2 mb-6 overflow-x-auto scrollbar-none -mx-4 px-4">
        {TABS.map(t => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`shrink-0 whitespace-nowrap rounded-xl px-4 py-2.5 text-sm font-semibold transition-colors ${
              tab === t.key ? 'bg-primary text-white' : 'bg-white text-gray-600 shadow-sm'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="flex justify-center py-10">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
        </div>
      ) : entries.length === 0 ? (
        <div className="rounded-2xl bg-white shadow-sm p-8 text-center">
          <p className="text-gray-400 text-sm">Aucune partie jouée pour l'instant.</p>
        </div>
      ) : (
        <>
          {tab !== 'global' && (
            <p className="flex items-center gap-1.5 mb-3 pl-0.5 text-xs font-semibold text-gray-500">
              <span className="text-base">{GAME_EMOJIS[tab]}</span>
              Classement <b className="text-gray-800">{GAME_FULL_LABELS[tab]}</b> · taux de victoire
            </p>
          )}

          <div className="rounded-3xl bg-white shadow-sm pt-5 px-3.5 overflow-hidden">
            <Podium entries={podiumEntries} memberById={memberById} showRankInBar />
          </div>

          {rest.length > 0 && (
            <div className="mt-8 rounded-2xl bg-white shadow-sm divide-y divide-gray-50 overflow-hidden">
              {rest.map((e, i) => {
                const isYou = e.memberId === user?.memberId
                return (
                  <div key={e.memberId} className={`flex items-center gap-3 px-4 py-3 ${isYou ? 'bg-dark/5' : ''}`}>
                    <span className={`w-5 text-sm font-semibold ${isYou ? 'text-dark' : 'text-gray-400'}`}>{i + 4}</span>
                    <Avatar member={memberById.get(e.memberId)} name={e.name} size="sm" />
                    <span className="flex-1 text-sm font-medium text-gray-800 truncate">{e.name}</span>
                    {isYou && (
                      <span className="rounded-full bg-dark/10 px-2.5 py-1 text-[11px] font-bold text-dark">Vous</span>
                    )}
                    <span className="text-sm font-semibold text-primary">{statLabel(e)}</span>
                  </div>
                )
              })}
            </div>
          )}
        </>
      )}
    </div>
  )
}
