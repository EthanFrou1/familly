import { useState, useEffect, useMemo, useRef } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { ReactFlowProvider } from '@xyflow/react'
import { useFamily } from '../hooks/useFamily'
import { useAuth } from '../hooks/useAuth'
import { familiesApi } from '../services/api'
import { usePageRefresh } from '../hooks/usePageRefresh'
import FamilyTree from '../components/tree/FamilyTree'
import Select from '../components/shared/Select'
import Avatar from '../components/shared/Avatar'
import SiblingsSuggestionModal from '../components/tree/SiblingsSuggestionModal'
import { detectImplicitSiblings } from '../components/tree/treeLayout'
import { matchesSearch } from '../utils/normalize'

export default function Tree() {
  const { members, relations, loading, reloadRelations } = useFamily()
  const { user } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const isAdmin = user?.role === 'Admin'

  const initialFamilyId = location.state?.filterFamilyId ?? ''

  const [families, setFamilies] = useState([])
  const [viewMode, setViewMode] = useState(initialFamilyId ? 'family' : 'all')
  const [familyId, setFamilyId] = useState(initialFamilyId)
  const [showLegend, setShowLegend] = useState(false)
  const [showSuggestions, setShowSuggestions] = useState(false)
  const [generationMap, setGenerationMap] = useState({})
  const [selectedGen, setSelectedGen] = useState(null)
  const [focusedMemberId, setFocusedMemberId] = useState(null)
  const [showPersonSheet, setShowPersonSheet] = useState(false)

  useEffect(() => {
    familiesApi.getAll().then(({ data }) => setFamilies(data)).catch(() => {})
  }, [])

  usePageRefresh(() => {
    familiesApi.getAll().then(({ data }) => setFamilies(data)).catch(() => {})
  })

  const siblingsSuggestions = useMemo(
    () => isAdmin ? detectImplicitSiblings(members, relations) : [],
    [members, relations, isAdmin]
  )

  useEffect(() => {
    if (siblingsSuggestions.length > 0) setShowSuggestions(true)
  }, [siblingsSuggestions.length])

  const filteredMembers = useMemo(() => {
    if (viewMode === 'all') return members

    if (viewMode === 'branch') {
      const userMember = members.find(m => m.id === user?.memberId)
      if (!userMember?.familyId) return members
      const ids = new Set(members.filter(m => m.familyId === userMember.familyId).map(m => m.id))
      relations.filter(r => r.type === 'Spouse').forEach(r => {
        if (ids.has(r.memberAId)) ids.add(r.memberBId)
        if (ids.has(r.memberBId)) ids.add(r.memberAId)
      })
      return members.filter(m => ids.has(m.id))
    }

    if (viewMode === 'family' && familyId) {
      const ids = new Set(members.filter(m => m.familyId === familyId).map(m => m.id))
      relations.filter(r => r.type === 'Spouse').forEach(r => {
        if (ids.has(r.memberAId)) ids.add(r.memberBId)
        if (ids.has(r.memberBId)) ids.add(r.memberAId)
      })
      return members.filter(m => ids.has(m.id))
    }

    return members
  }, [viewMode, familyId, members, user, relations])

  const generationCounts = useMemo(() => {
    const counts = {}
    filteredMembers.forEach(m => {
      const gen = generationMap[m.id] ?? 0
      counts[gen] = (counts[gen] || 0) + 1
    })
    return Object.entries(counts)
      .map(([gen, count]) => ({ gen: Number(gen), count }))
      .sort((a, b) => a.gen - b.gen)
  }, [generationMap, filteredMembers])

  const focusMemberIds = useMemo(() => {
    if (!focusedMemberId) return null
    const ids = new Set([focusedMemberId])
    relations.forEach(r => {
      if (r.memberAId === focusedMemberId) ids.add(r.memberBId)
      if (r.memberBId === focusedMemberId) ids.add(r.memberAId)
    })
    return ids
  }, [focusedMemberId, relations])

  const focusedMember = useMemo(
    () => focusedMemberId ? members.find(m => m.id === focusedMemberId) : null,
    [focusedMemberId, members]
  )

  // Reset filters when view mode changes
  const treeKey = `${viewMode}-${familyId}`
  useEffect(() => { setSelectedGen(null); setFocusedMemberId(null) }, [treeKey])

  if (loading) return (
    <div className="flex h-full items-center justify-center">
      <div className="h-10 w-10 animate-spin rounded-full border-4 border-primary border-t-transparent" />
    </div>
  )

  return (
    <div className="flex flex-col h-full">

      {/* ── Header fixe ── */}
      <div className="bg-dark px-5 pt-10 pb-4 shrink-0">
        <h1 className="text-2xl font-bold text-white">Arbre familial</h1>
        <p className="text-sm text-white mt-0.5">
          Pincez pour zoomer · Glissez pour naviguer · Appuyez sur un membre pour voir son profil
        </p>
      </div>

      <div className="relative flex-1 bg-gray-50">

      {/* ── Filtres inline ── */}
      <div className="absolute top-3 left-3 right-3 z-20 flex flex-col gap-1.5">
        {/* Filtre vue */}
        <div className="flex items-center gap-2 overflow-x-auto scrollbar-none">
          <div className="flex items-center gap-1.5 bg-white rounded-xl shadow-sm px-2 py-1.5 shrink-0">
            <svg className="h-3.5 w-3.5 text-gray-400 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2a1 1 0 01-.293.707L13 13.414V19a1 1 0 01-.553.894l-4 2A1 1 0 017 21v-7.586L3.293 6.707A1 1 0 013 6V4z" />
            </svg>
            <button
              onClick={() => setViewMode('all')}
              className={`rounded-lg px-2 py-0.5 text-xs font-semibold transition-all ${
                viewMode === 'all' ? 'bg-primary text-white' : 'text-gray-600 active:bg-gray-100'
              }`}
            >
              Tous
            </button>
            <button
              onClick={() => setViewMode('branch')}
              className={`rounded-lg px-2 py-0.5 text-xs font-semibold transition-all ${
                viewMode === 'branch' ? 'bg-primary text-white' : 'text-gray-600 active:bg-gray-100'
              }`}
            >
              Ma branche
            </button>
            {families.length > 0 && (
              <div className="w-28 shrink-0">
                <Select
                  value={viewMode === 'family' ? familyId : ''}
                  onChange={e => {
                    const val = e.target.value
                    if (val) { setFamilyId(val); setViewMode('family') }
                    else setViewMode('all')
                  }}
                  placeholder="Toutes familles"
                >
                  {families.map(f => (
                    <option key={f.id} value={f.id}>{f.name}</option>
                  ))}
                </Select>
              </div>
            )}

            <div className="w-px bg-gray-200 self-stretch mx-0.5" />

            {/* Bouton focus personne — icône seule, toujours */}
            <button
              onClick={() => setShowPersonSheet(true)}
              className={`rounded-lg p-1 shrink-0 transition-all ${
                focusedMemberId ? 'text-primary' : 'text-gray-500 active:bg-gray-100'
              }`}
              title="Centrer sur un membre"
            >
              <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
              </svg>
            </button>
          </div>
        </div>

        {/* Chip personne sélectionnée — ligne séparée pour éviter le débordement */}
        {focusedMember && (
          <div className="flex items-center gap-1.5">
            <div className="flex items-center gap-1.5 bg-primary rounded-lg shadow-sm px-2.5 py-1 shrink-0 max-w-full">
              <svg className="h-3 w-3 text-white/70 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
              </svg>
              <span className="text-xs font-semibold text-white truncate">
                {focusedMember.firstName} {focusedMember.lastName}
              </span>
              <button
                onClick={() => setFocusedMemberId(null)}
                className="ml-0.5 shrink-0 text-white/80 active:text-white"
              >
                <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
          </div>
        )}

        {/* Chips génération */}
        {generationCounts.length > 1 && !focusedMemberId && (
          <div className="flex items-center gap-1.5 overflow-x-auto scrollbar-none">
            <div className="flex items-center gap-1 bg-white/90 backdrop-blur-sm rounded-lg shadow-sm px-2 py-1 shrink-0">
              <button
                onClick={() => setSelectedGen(null)}
                className={`rounded-md px-2 py-0.5 text-xs font-semibold transition-all ${
                  selectedGen === null ? 'bg-primary text-white' : 'text-gray-500 active:bg-gray-100'
                }`}
              >
                Toutes
              </button>
              {generationCounts.map(({ gen, count }) => (
                <button
                  key={gen}
                  onClick={() => setSelectedGen(selectedGen === gen ? null : gen)}
                  className={`rounded-md px-2 py-0.5 text-xs font-semibold whitespace-nowrap transition-all ${
                    selectedGen === gen ? 'bg-primary text-white' : 'text-gray-500 active:bg-gray-100'
                  }`}
                >
                  G{gen + 1} · {count}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* ── Legend button — low left ── */}
      <button
        onClick={() => setShowLegend(v => !v)}
        className="absolute z-20 bg-white rounded-2xl shadow-md p-2.5 active:bg-gray-50"
        style={{ bottom: '20px', left: '16px' }}
        title="Légende"
      >
        <svg className="h-5 w-5 text-gray-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
      </button>

      {/* ── Legend panel ── */}
      {showLegend && (
        <div
          className="absolute z-20 bg-white rounded-2xl shadow-xl p-4 space-y-3 w-52"
          style={{ bottom: '70px', left: '16px' }}
        >
          <div className="flex items-center justify-between">
            <p className="text-xs font-bold text-gray-700 uppercase tracking-wider">Légende</p>
            <button onClick={() => setShowLegend(false)} className="text-gray-300 p-0.5">
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          <div className="space-y-2">
            <p className="text-[10px] font-semibold text-gray-400 uppercase">Relations</p>
            <div className="flex items-center gap-3">
              <svg width="28" height="10"><line x1="0" y1="5" x2="28" y2="5" stroke="#9CA3AF" strokeWidth="2" /></svg>
              <span className="text-xs text-gray-600">Parent → Enfant</span>
            </div>
            <div className="flex items-center gap-3">
              <svg width="28" height="10"><line x1="0" y1="5" x2="28" y2="5" stroke="#F472B6" strokeWidth="2" /></svg>
              <span className="text-xs text-gray-600">Marié(e) 💍</span>
            </div>
            <div className="flex items-center gap-3">
              <svg width="28" height="10"><line x1="0" y1="5" x2="28" y2="5" stroke="#F472B6" strokeWidth="2" /></svg>
              <span className="text-xs text-gray-600">En couple ♥</span>
            </div>
            <div className="flex items-center gap-3">
              <svg width="28" height="10"><line x1="0" y1="5" x2="28" y2="5" stroke="#9CA3AF" strokeWidth="1.5" strokeDasharray="5 3" /></svg>
              <span className="text-xs text-gray-600">Frère / Sœur</span>
            </div>
            <div className="flex items-center gap-3">
              <svg width="28" height="10"><line x1="0" y1="5" x2="28" y2="5" stroke="#9CA3AF" strokeWidth="1.5" strokeDasharray="2 4" /></svg>
              <span className="text-xs text-gray-600">Demi-frère/sœur</span>
            </div>
            <div className="flex items-center gap-3">
              <svg width="28" height="10"><line x1="0" y1="5" x2="28" y2="5" stroke="#FB923C" strokeWidth="1.5" strokeDasharray="6 4" /></svg>
              <span className="text-xs text-gray-600">Séparé(e) / Divorcé(e) 💔</span>
            </div>
          </div>

          <div className="flex items-center gap-2 border-t border-gray-100 pt-3">
            <div className="h-7 w-7 rounded-xl bg-gray-100 border border-gray-200 flex items-center justify-center opacity-60">
              <span className="text-[9px] text-gray-500">†</span>
            </div>
            <span className="text-xs text-gray-600">Décédé(e)</span>
          </div>
        </div>
      )}

      {/* ── Siblings suggestion badge ── */}
      {isAdmin && siblingsSuggestions.length > 0 && !showSuggestions && (
        <button
          onClick={() => setShowSuggestions(true)}
          className="absolute z-20 bg-white rounded-2xl shadow-md px-3 py-2 flex items-center gap-2 active:bg-gray-50"
          style={{ bottom: '20px', left: '60px' }}
        >
          <span className="h-5 w-5 rounded-full bg-primary flex items-center justify-center text-white text-[10px] font-bold">
            {siblingsSuggestions.length}
          </span>
          <span className="text-xs font-semibold text-gray-700">Liens suggérés</span>
        </button>
      )}

      {/* ── Tree ── */}
      <div className="absolute inset-0 overflow-hidden">
        <ReactFlowProvider>
          <FamilyTree
            key={treeKey}
            members={filteredMembers}
            relations={relations}
            families={families}
            currentMemberId={user?.memberId}
            onNodeClick={m => navigate(`/profile/${m.id}`)}
            highlightGeneration={selectedGen}
            onGenerationMap={setGenerationMap}
            focusMemberIds={focusMemberIds}
          />
        </ReactFlowProvider>
      </div>

      {/* ── Siblings suggestion modal ── */}
      {showSuggestions && siblingsSuggestions.length > 0 && (
        <SiblingsSuggestionModal
          suggestions={siblingsSuggestions}
          onClose={() => setShowSuggestions(false)}
          onCreated={() => reloadRelations()}
        />
      )}

      {/* ── Person focus sheet ── */}
      {showPersonSheet && (
        <PersonFocusSheet
          members={filteredMembers}
          onSelect={id => { setFocusedMemberId(id); setSelectedGen(null) }}
          onClose={() => setShowPersonSheet(false)}
        />
      )}
      </div>
    </div>
  )
}

function PersonFocusSheet({ members, onSelect, onClose }) {
  const [search, setSearch] = useState('')
  const sheetRef = useRef(null)

  // Remonte la sheet quand le clavier iOS apparaît
  useEffect(() => {
    const vv = window.visualViewport
    if (!vv) return
    const update = () => {
      if (!sheetRef.current) return
      const keyboardHeight = Math.max(0, window.innerHeight - vv.height)
      sheetRef.current.style.transform = `translateY(-${keyboardHeight}px)`
      sheetRef.current.style.maxHeight = `${vv.height * 0.9}px`
    }
    vv.addEventListener('resize', update)
    vv.addEventListener('scroll', update)
    return () => {
      vv.removeEventListener('resize', update)
      vv.removeEventListener('scroll', update)
    }
  }, [])

  const filtered = useMemo(() => {
    if (!search.trim()) return members
    return members.filter(m =>
      matchesSearch(`${m.firstName} ${m.lastName}`, search)
    )
  }, [members, search])

  return (
    <div className="fixed inset-0 z-50 flex flex-col justify-end">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      <div ref={sheetRef} className="relative bg-white rounded-t-2xl max-h-[70vh] flex flex-col shadow-2xl" style={{ transition: 'transform 0.15s, max-height 0.15s' }}>
        {/* Handle */}
        <div className="flex justify-center pt-3 pb-1 shrink-0">
          <div className="w-10 h-1 rounded-full bg-gray-200" />
        </div>
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-2 shrink-0">
          <p className="text-sm font-bold text-gray-800">Centrer sur un membre</p>
          <button onClick={onClose} className="p-1 text-gray-400 active:text-gray-600">
            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
        {/* Search */}
        <div className="px-4 pb-3 shrink-0">
          <input
            autoFocus
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Rechercher un membre…"
            className="w-full rounded-xl bg-gray-100 px-3 py-2 text-sm focus:outline-none focus:bg-gray-200"
          />
        </div>
        {/* List */}
        <div className="overflow-y-auto flex-1 pb-8">
          {filtered.map((m, idx) => (
            <button
              key={m.id}
              onClick={() => { onSelect(m.id); onClose() }}
              className={`flex items-center gap-3 w-full px-4 py-2.5 active:bg-gray-50 ${idx < filtered.length - 1 ? 'border-b border-gray-50' : ''}`}
            >
              <Avatar src={m.profilePictureUrl} name={`${m.firstName} ${m.lastName}`} size="sm" />
              <span className="text-sm font-medium text-gray-800">{m.firstName} {m.lastName}</span>
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}
