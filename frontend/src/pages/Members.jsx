import { useEffect, useState, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'
import { useMembers } from '../store/MembersContext'
import { familiesApi } from '../services/api'
import { FAMILY_PALETTE } from '../components/tree/treeLayout'
import Avatar from '../components/shared/Avatar'

export default function Members() {
  const { members } = useMembers()
  const { user } = useAuth()
  const navigate = useNavigate()

  const [search, setSearch] = useState('')
  const [familyFilter, setFamilyFilter] = useState(null)
  const [families, setFamilies] = useState([])

  useEffect(() => {
    familiesApi.getAll().then(({ data }) => setFamilies(data)).catch(() => {})
  }, [])

  const filtered = useMemo(() => {
    let result = members
    if (familyFilter === '__none__') result = result.filter(m => !m.familyId)
    else if (familyFilter) result = result.filter(m => m.familyId === familyFilter)
    if (search.trim()) {
      const q = search.toLowerCase()
      result = result.filter(m =>
        `${m.firstName} ${m.lastName}`.toLowerCase().includes(q)
      )
    }
    return [...result].sort((a, b) =>
      a.firstName.localeCompare(b.firstName, 'fr', { sensitivity: 'base' })
    )
  }, [members, search, familyFilter])

  // Group by first letter
  const grouped = useMemo(() => {
    const map = {}
    filtered.forEach(m => {
      const letter = m.firstName[0]?.toUpperCase() ?? '#'
      if (!map[letter]) map[letter] = []
      map[letter].push(m)
    })
    return Object.entries(map).sort(([a], [b]) => a.localeCompare(b, 'fr'))
  }, [filtered])

  const familyColorMap = useMemo(() => {
    const map = {}
    families.forEach((f, i) => { map[f.id] = FAMILY_PALETTE[i % FAMILY_PALETTE.length] })
    return map
  }, [families])

  return (
    <div className="flex flex-col h-full bg-gray-50 animate-fade-in">

      {/* Header */}
      <div className="bg-dark px-5 pt-10 pb-4 shrink-0">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h1 className="text-2xl font-bold text-white">Membres</h1>
            <p className="text-gray-400 text-sm mt-0.5">{members.length} membre{members.length !== 1 ? 's' : ''}</p>
          </div>
        </div>

        {/* Search */}
        <div className="relative">
          <svg className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400 pointer-events-none"
            fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-4.35-4.35M17 11A6 6 0 111 11a6 6 0 0116 0z" />
          </svg>
          <input
            type="text"
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Rechercher un membre…"
            className="w-full rounded-xl bg-white/10 border border-white/10 pl-9 pr-9 py-2.5 text-sm text-white placeholder-gray-400 focus:outline-none focus:bg-white/20"
          />
          {search && (
            <button onClick={() => setSearch('')}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 active:text-white">
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          )}
        </div>
      </div>

      {/* Family filter chips */}
      {families.length > 0 && (
        <div className="bg-dark pb-6 shrink-0">
          <div className="flex gap-2 px-4 pb-2 overflow-x-auto scrollbar-none">
            <Chip label="Tous" active={!familyFilter} onClick={() => setFamilyFilter(null)} />
            {families.map((f, i) => (
              <Chip
                key={f.id}
                label={f.name}
                active={familyFilter === f.id}
                onClick={() => setFamilyFilter(familyFilter === f.id ? null : f.id)}
                color={FAMILY_PALETTE[i % FAMILY_PALETTE.length]}
              />
            ))}
            <Chip label="Pièces rapportées" active={familyFilter === '__none__'} onClick={() => setFamilyFilter(familyFilter === '__none__' ? null : '__none__')} />
          </div>
        </div>
      )}

      {/* List */}
      <div className="flex-1 overflow-y-auto pb-6">
        {grouped.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-center px-6">
            <p className="text-gray-400 text-sm">Aucun membre trouvé.</p>
            {search && (
              <button onClick={() => setSearch('')} className="mt-3 text-primary text-sm font-semibold">
                Effacer la recherche
              </button>
            )}
          </div>
        ) : (
          grouped.map(([letter, group]) => (
            <div key={letter}>
              <div className="px-4 pt-4 pb-1">
                <span className="text-xs font-bold text-gray-400 uppercase tracking-wider">{letter}</span>
              </div>
              <div className="mx-4 rounded-2xl bg-white shadow-sm overflow-hidden">
                {group.map((m, idx) => {
                  const color = m.familyId ? familyColorMap[m.familyId] : null
                  const age = m.birthDate
                    ? Math.floor((Date.now() - new Date(m.birthDate)) / (365.25 * 24 * 3600 * 1000))
                    : null
                  return (
                    <button
                      key={m.id}
                      onClick={() => navigate(`/profile/${m.id}`)}
                      className={`flex items-center gap-3 w-full px-4 py-3 text-left active:bg-gray-50 ${idx < group.length - 1 ? 'border-b border-gray-50' : ''}`}
                    >
                      <Avatar src={m.profilePictureUrl} name={`${m.firstName} ${m.lastName}`} size="sm" />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold text-gray-900 truncate">{m.firstName} {m.lastName}</p>
                        <p className="text-xs text-gray-400 truncate">
                          {[age && `${age} ans`, m.city].filter(Boolean).join(' · ') || 'Aucune info'}
                        </p>
                      </div>
                      {color && m.familyName ? (
                        <span
                          className="text-[10px] font-bold px-2 py-0.5 rounded-full shrink-0"
                          style={{ background: color.bg, color: color.text, border: `1px solid ${color.border}` }}
                        >
                          {m.familyName}
                        </span>
                      ) : !m.familyId && (
                        <span className="text-[10px] font-medium px-2 py-0.5 rounded-full shrink-0 bg-gray-100 text-gray-400">
                          Pièce rapportée
                        </span>
                      )}
                      <svg className="h-4 w-4 text-gray-300 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                      </svg>
                    </button>
                  )
                })}
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  )
}

function Chip({ label, active, onClick, color }) {
  return (
    <button
      onClick={onClick}
      className="shrink-0 rounded-full px-3 py-1.5 text-xs font-semibold transition-colors"
      style={active && color
        ? { background: color.border, color: '#fff' }
        : active
          ? { background: '#534AB7', color: '#fff' }
          : { background: 'rgba(255,255,255,0.1)', color: 'rgba(255,255,255,0.6)' }
      }
    >
      {label}
    </button>
  )
}
