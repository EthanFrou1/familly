import { useEffect, useState, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { useMembers } from '../store/MembersContext'
import { useAuth } from '../hooks/useAuth'
import { familiesApi, membersApi } from '../services/api'
import Avatar from '../components/shared/Avatar'
import ConfirmModal from '../components/shared/ConfirmModal'

export default function Families() {
  const { members, refresh } = useMembers()
  const { user } = useAuth()
  const navigate = useNavigate()
  const isAdmin = user?.role === 'Admin'

  const [families, setFamilies] = useState([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [sort, setSort] = useState('alpha')
  const [showCreate, setShowCreate] = useState(false)
  const [newName, setNewName] = useState('')
  const [creating, setCreating] = useState(false)
  const [createError, setCreateError] = useState('')
  const [addingTo, setAddingTo] = useState(null) // familyId being managed
  const [confirmDelete, setConfirmDelete] = useState(null) // { type: 'family'|'member', familyId, memberId, label }


  useEffect(() => {
    familiesApi.getAll()
      .then(({ data }) => setFamilies(data))
      .finally(() => setLoading(false))
  }, [])

  const membersByFamily = useMemo(() => {
    const map = {}
    for (const m of members) {
      const key = m.familyId ?? '__none__'
      if (!map[key]) map[key] = []
      map[key].push(m)
    }
    return map
  }, [members])

  async function handleCreate(e) {
    e.preventDefault()
    if (!newName.trim()) return
    setCreating(true)
    setCreateError('')
    try {
      const { data } = await familiesApi.create(newName.trim())
      setFamilies(prev => [...prev, data].sort((a, b) => a.name.localeCompare(b.name)))
      setNewName('')
      setShowCreate(false)
    } catch (err) {
      setCreateError(err.response?.data?.message || 'Cette famille existe déjà.')
    } finally {
      setCreating(false)
    }
  }

  async function handleDeleteFamily(id) {
    await familiesApi.delete(id)
    setFamilies(prev => prev.filter(f => f.id !== id))
    setConfirmDelete(null)
  }

  async function handleAddMemberToFamily(memberId, familyId) {
    await membersApi.update(memberId, { familyId })
    refresh()
    setFamilies(prev => prev.map(f =>
      f.id === familyId ? { ...f, memberCount: f.memberCount + 1 } : f
    ))
  }

  async function handleRemoveMemberFromFamily(memberId) {
    await membersApi.update(memberId, { familyId: null })
    refresh()
    setConfirmDelete(null)
  }

  const avgBirthYear = (members) => {
    const withDate = members.filter(m => m.birthDate)
    if (!withDate.length) return null
    return withDate.reduce((sum, m) => sum + new Date(m.birthDate).getFullYear(), 0) / withDate.length
  }

  const { familiesWithMembers, unassigned } = useMemo(() => {
    const q = search.trim().toLowerCase()
    const all = membersByFamily['__none__'] ?? []

    let list = families
      .map(f => ({ ...f, members: membersByFamily[f.id] ?? [] }))
      .filter(f => !q || f.name.toLowerCase().includes(q) ||
        f.members.some(m => `${m.firstName} ${m.lastName}`.toLowerCase().includes(q)))

    if (sort === 'biggest')  list = [...list].sort((a, b) => b.members.length - a.members.length)
    else if (sort === 'smallest') list = [...list].sort((a, b) => a.members.length - b.members.length)
    else if (sort === 'oldest') list = [...list].sort((a, b) => {
      const ya = avgBirthYear(a.members), yb = avgBirthYear(b.members)
      if (ya === null && yb === null) return 0
      if (ya === null) return 1
      if (yb === null) return -1
      return ya - yb // année naissance la plus petite = la plus âgée
    })
    else if (sort === 'youngest') list = [...list].sort((a, b) => {
      const ya = avgBirthYear(a.members), yb = avgBirthYear(b.members)
      if (ya === null && yb === null) return 0
      if (ya === null) return 1
      if (yb === null) return -1
      return yb - ya
    })
    else list = [...list].sort((a, b) => a.name.localeCompare(b.name, 'fr'))

    return {
      familiesWithMembers: list,
      unassigned: !q ? all : all.filter(m =>
        `${m.firstName} ${m.lastName}`.toLowerCase().includes(q)
      ),
    }
  }, [families, membersByFamily, search, sort])

  if (loading) return (
    <div className="flex h-full items-center justify-center">
      <div className="h-10 w-10 animate-spin rounded-full border-4 border-primary border-t-transparent" />
    </div>
  )

  return (
    <div className="overflow-y-auto h-full bg-gray-50 pb-24">

      {/* Header */}
      <div className="bg-dark px-5 pt-12 pb-4">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h1 className="text-2xl font-bold text-white">Familles</h1>
            <p className="text-white/70 text-sm mt-0.5">{families.length} famille{families.length !== 1 ? 's' : ''}</p>
          </div>
          {isAdmin && (
            <button
              onClick={() => setShowCreate(true)}
              className="flex items-center gap-2 rounded-2xl bg-primary px-4 py-2.5 text-sm font-semibold text-white active:bg-primary-dark"
            >
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
              </svg>
              Nouvelle famille
            </button>
          )}
        </div>
        <div className="relative">
          <svg className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-white/50 pointer-events-none"
            fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-4.35-4.35M17 11A6 6 0 111 11a6 6 0 0116 0z" />
          </svg>
          <input
            type="text"
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Rechercher une famille ou un membre…"
            className="w-full rounded-xl bg-white/10 border border-white/10 pl-9 pr-9 py-2.5 text-sm text-white placeholder-white/50 focus:outline-none focus:bg-white/20"
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
        {/* Chips de tri */}
        <div className="flex gap-2 mt-3 overflow-x-auto scrollbar-none pb-1">
          {[
            { key: 'alpha',    label: 'A–Z' },
            { key: 'biggest',  label: '+ Grande' },
            { key: 'smallest', label: '+ Petite' },
            { key: 'oldest',   label: '+ Âgée' },
            { key: 'youngest', label: '+ Jeune' },
          ].map(({ key, label }) => (
            <button
              key={key}
              onClick={() => setSort(key)}
              className="shrink-0 rounded-full px-3 py-1.5 text-xs font-semibold transition-colors"
              style={sort === key
                ? { background: 'var(--c-primary)', color: '#fff' }
                : { background: 'rgba(255,255,255,0.1)', color: 'rgba(255,255,255,0.6)' }
              }
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      <div className="px-4 mt-5 space-y-4">

        {families.length === 0 && (
          <div className="rounded-2xl bg-white shadow-sm p-8 text-center">
            <p className="text-gray-400 text-sm">Aucune famille créée.</p>
            <button onClick={() => setShowCreate(true)}
              className="mt-4 rounded-xl bg-primary px-6 py-2.5 text-sm font-semibold text-white active:bg-primary-dark">
              Créer la première famille
            </button>
          </div>
        )}

        {familiesWithMembers.map(family => (
          <FamilyCard
            key={family.id}
            family={family}
            isAdmin={isAdmin}
            onDelete={() => setConfirmDelete({ type: 'family', familyId: family.id, label: family.name })}
            onViewMember={id => navigate(`/profile/${id}`)}
            onRemoveMember={(memberId, memberName) => setConfirmDelete({ type: 'member', memberId, familyId: family.id, label: memberName })}
            onAddMembers={() => setAddingTo(family.id)}
          />
        ))}

        {/* Membres sans famille */}
        {unassigned.length > 0 && (
          <div className="rounded-2xl bg-white shadow-sm overflow-hidden">
            <div className="px-4 pt-4 pb-3 border-b border-gray-50 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="h-2 w-2 rounded-full bg-gray-300" />
                <h2 className="text-sm font-semibold text-gray-500">Pièces rapportées</h2>
                <span className="text-xs text-gray-400 bg-gray-100 rounded-full px-2 py-0.5">{unassigned.length}</span>
              </div>
            </div>
            <div className="divide-y divide-gray-50">
              {unassigned.map(m => (
                <button
                  key={m.id}
                  onClick={() => navigate(`/profile/${m.id}`)}
                  className="flex items-center gap-3 w-full px-4 py-3 active:bg-gray-50"
                >
                  <Avatar src={m.profilePictureUrl} name={`${m.firstName} ${m.lastName}`} size="sm" />
                  <span className="flex-1 text-left text-sm font-medium text-gray-700">{m.firstName} {m.lastName}</span>
                  <svg className="h-4 w-4 text-gray-300" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                  </svg>
                </button>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Modal création famille */}
      {showCreate && (
        <div className="fixed inset-0 z-[60] flex flex-col justify-end">
          <div className="absolute inset-0 bg-black/50" onClick={() => setShowCreate(false)} />
          <div className="relative bg-white rounded-t-3xl animate-slide-up px-5 pt-6 pb-10">
            <h2 className="text-lg font-semibold text-gray-900 mb-5">Nouvelle famille</h2>
            <form onSubmit={handleCreate} className="space-y-4">
              <input
                autoFocus
                value={newName}
                onChange={e => setNewName(e.target.value)}
                placeholder="Ex: Famille FROU"
                className="w-full rounded-xl border border-gray-200 bg-gray-50 px-4 py-3 text-sm text-gray-900 focus:border-primary focus:outline-none focus:bg-white focus:ring-2 focus:ring-primary/10"
              />
              {createError && <p className="text-sm text-red-500 text-center">{createError}</p>}
              <button
                type="submit"
                disabled={!newName.trim() || creating}
                className="w-full rounded-xl bg-primary py-3.5 font-semibold text-white disabled:opacity-50"
              >
                {creating ? '...' : 'Créer la famille'}
              </button>
            </form>
          </div>
        </div>
      )}

      {/* Modal ajout membres à une famille */}
      {addingTo && (
        <AddMembersModal
          familyId={addingTo}
          familyName={families.find(f => f.id === addingTo)?.name ?? ''}
          unassigned={unassigned}
          onAdd={handleAddMemberToFamily}
          onClose={() => setAddingTo(null)}
        />
      )}

      <ConfirmModal
        open={!!confirmDelete}
        title={confirmDelete?.type === 'family' ? 'Supprimer cette famille ?' : 'Retirer ce membre ?'}
        message={
          confirmDelete?.type === 'family'
            ? `La famille "${confirmDelete?.label}" sera supprimée. Les membres ne seront pas supprimés.`
            : `${confirmDelete?.label} sera retiré(e) de cette famille.`
        }
        confirmLabel={confirmDelete?.type === 'family' ? 'Supprimer' : 'Retirer'}
        onConfirm={() =>
          confirmDelete?.type === 'family'
            ? handleDeleteFamily(confirmDelete.familyId)
            : handleRemoveMemberFromFamily(confirmDelete.memberId)
        }
        onCancel={() => setConfirmDelete(null)}
      />
    </div>
  )
}

function FamilyCard({ family, isAdmin, onDelete, onViewMember, onRemoveMember, onAddMembers }) {
  const [expanded, setExpanded] = useState(false)
  const hasMembers = family.members.length > 0

  const sortedMembers = useMemo(() =>
    [...family.members].sort((a, b) => {
      if (!a.birthDate && !b.birthDate) return 0
      if (!a.birthDate) return 1
      if (!b.birthDate) return -1
      return new Date(a.birthDate) - new Date(b.birthDate)
    }), [family.members])

  return (
    <div className="rounded-2xl bg-white shadow-sm overflow-hidden">
      {/* Header carte */}
      <div className="px-4 pt-4 pb-3 flex items-center justify-between">
        <button onClick={() => setExpanded(e => !e)} className="flex items-center gap-3 flex-1 text-left active:opacity-70">
          <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
            <span className="text-primary font-bold text-sm">{family.name.slice(0, 2).toUpperCase()}</span>
          </div>
          <div>
            <h2 className="text-base font-bold text-gray-900">{family.name}</h2>
            <p className="text-xs text-gray-400">{family.members.length} membre{family.members.length !== 1 ? 's' : ''}</p>
          </div>
          <svg
            className={`h-4 w-4 text-gray-400 ml-auto transition-transform ${expanded ? 'rotate-180' : ''}`}
            fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}
          >
            <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
          </svg>
        </button>
      </div>

      {/* Aperçu avatars (collapsed) */}
      {!expanded && hasMembers && (
        <div className="px-4 pb-4 flex items-center gap-2">
          <div className="flex -space-x-2">
            {sortedMembers.slice(0, 6).map(m => (
              <div key={m.id} className="ring-2 ring-white rounded-full">
                <Avatar src={m.profilePictureUrl} name={`${m.firstName} ${m.lastName}`} size="sm" />
              </div>
            ))}
            {sortedMembers.length > 6 && (
              <div className="h-8 w-8 rounded-full bg-gray-100 ring-2 ring-white flex items-center justify-center">
                <span className="text-xs font-semibold text-gray-500">+{sortedMembers.length - 6}</span>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Liste membres (expanded) */}
      {expanded && (
        <div className="border-t border-gray-50">
          {family.members.length === 0 ? (
            <p className="text-sm text-gray-400 px-4 py-4 text-center">Aucun membre dans cette famille.</p>
          ) : (
            <div className="divide-y divide-gray-50">
              {sortedMembers.map(m => (
                <div key={m.id} className="flex items-center gap-3 px-4 py-3">
                  <button onClick={() => onViewMember(m.id)} className="flex items-center gap-3 flex-1 active:opacity-70">
                    <Avatar src={m.profilePictureUrl} name={`${m.firstName} ${m.lastName}`} size="sm" />
                    <div className="text-left">
                      <p className="text-sm font-medium text-gray-900">{m.firstName} {m.lastName}</p>
                      {m.city && <p className="text-xs text-gray-400">{m.city}</p>}
                    </div>
                  </button>
                  {isAdmin && (
                    <button
                      onClick={() => onRemoveMember(m.id, `${m.firstName} ${m.lastName}`)}
                      className="p-1.5 text-gray-300 active:text-red-400"
                      title="Retirer de la famille"
                    >
                      <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    </button>
                  )}
                </div>
              ))}
            </div>
          )}

          {/* Actions admin */}
          {isAdmin && (
            <div className="flex gap-2 px-4 py-3 border-t border-gray-50">
              <button
                onClick={onAddMembers}
                className="flex-1 flex items-center justify-center gap-2 rounded-xl bg-primary/10 py-2.5 text-sm font-semibold text-primary active:bg-primary/20"
              >
                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
                </svg>
                Ajouter des membres
              </button>
              <button
                onClick={onDelete}
                className="rounded-xl border border-red-100 bg-red-50 px-4 py-2.5 text-sm font-semibold text-red-400 active:bg-red-100"
              >
                Supprimer
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

function AddMembersModal({ familyId, familyName, unassigned, onAdd, onClose }) {
  const [search, setSearch] = useState('')
  const [adding, setAdding] = useState(null)

  const filtered = unassigned.filter(m =>
    `${m.firstName} ${m.lastName}`.toLowerCase().includes(search.toLowerCase())
  )

  async function handleAdd(memberId) {
    setAdding(memberId)
    await onAdd(memberId, familyId)
    setAdding(null)
  }

  return (
    <div className="fixed inset-0 z-[60] flex flex-col justify-end">
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />
      <div className="relative bg-white rounded-t-3xl animate-slide-up max-h-[75vh] flex flex-col">
        <div className="px-5 pt-5 pb-4 border-b border-gray-100 flex items-center justify-between shrink-0">
          <div>
            <h2 className="text-lg font-semibold text-gray-900">Ajouter des membres</h2>
            <p className="text-sm text-gray-400 mt-0.5">à {familyName}</p>
          </div>
          <button onClick={onClose} className="text-gray-400 p-1">
            <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="px-4 pt-3 pb-2 shrink-0">
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Rechercher un membre…"
            className="w-full rounded-xl border border-gray-200 bg-gray-50 px-4 py-2.5 text-sm focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/10"
          />
        </div>

        <div className="overflow-y-auto flex-1 pb-6">
          {filtered.length === 0 ? (
            <p className="text-sm text-gray-400 text-center py-8">
              {unassigned.length === 0
                ? 'Tous les membres ont déjà une famille.'
                : 'Aucun résultat.'}
            </p>
          ) : (
            <div className="divide-y divide-gray-50">
              {filtered.map(m => (
                <div key={m.id} className="flex items-center gap-3 px-4 py-3">
                  <Avatar src={m.profilePictureUrl} name={`${m.firstName} ${m.lastName}`} size="sm" />
                  <div className="flex-1">
                    <p className="text-sm font-medium text-gray-900">{m.firstName} {m.lastName}</p>
                    {m.city && <p className="text-xs text-gray-400">{m.city}</p>}
                  </div>
                  <button
                    onClick={() => handleAdd(m.id)}
                    disabled={adding === m.id}
                    className="rounded-xl bg-primary px-4 py-1.5 text-xs font-semibold text-white disabled:opacity-50 active:bg-primary-dark"
                  >
                    {adding === m.id ? '...' : 'Ajouter'}
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
