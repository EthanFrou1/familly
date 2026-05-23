import { useState } from 'react'
import FamilyMap from '../components/map/FamilyMap'
import { useMembers } from '../store/MembersContext'
import { useAuth } from '../hooks/useAuth'

export default function Map() {
  const { members, loading } = useMembers()
  const { user } = useAuth()
  const [search, setSearch] = useState('')

  const filtered = search
    ? members.filter(m =>
        `${m.firstName} ${m.lastName}`.toLowerCase().includes(search.toLowerCase())
      )
    : members

  if (loading) return (
    <div className="flex h-full items-center justify-center">
      <div className="h-10 w-10 animate-spin rounded-full border-4 border-primary border-t-transparent" />
    </div>
  )

  return (
    <div className="relative h-full">
      <div className="absolute top-3 left-4 right-4 z-10">
        <input
          type="search"
          placeholder="Rechercher un membre..."
          value={search}
          onChange={e => setSearch(e.target.value)}
          className="w-full rounded-xl bg-white px-4 py-3 shadow-md text-sm focus:outline-none focus:ring-2 focus:ring-primary"
        />
      </div>
      <FamilyMap members={filtered} currentMemberId={user?.memberId} />
    </div>
  )
}
