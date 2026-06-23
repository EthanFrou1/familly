import { useState, useEffect, useMemo } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { ReactFlowProvider } from '@xyflow/react'
import { useFamily } from '../hooks/useFamily'
import { useAuth } from '../hooks/useAuth'
import { familiesApi } from '../services/api'
import { usePageRefresh } from '../hooks/usePageRefresh'
import FamilyTree from '../components/tree/FamilyTree'
import Select from '../components/shared/Select'
import SiblingsSuggestionModal from '../components/tree/SiblingsSuggestionModal'
import { detectImplicitSiblings } from '../components/tree/treeLayout'

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

  // Key to reset ReactFlow when filter changes
  const treeKey = `${viewMode}-${familyId}`

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
      <div className="absolute top-3 left-3 right-3 z-20 justify-center pb-3 flex items-center gap-2 overflow-x-auto scrollbar-none">
        <div className="flex items-center gap-2 bg-white rounded-2xl shadow-md px-3 py-2 shrink-0">
          <svg className="h-4 w-4 text-gray-400 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2a1 1 0 01-.293.707L13 13.414V19a1 1 0 01-.553.894l-4 2A1 1 0 017 21v-7.586L3.293 6.707A1 1 0 013 6V4z" />
          </svg>
          <button
            onClick={() => setViewMode('all')}
            className={`rounded-xl px-3 py-1 text-sm font-semibold transition-all ${
              viewMode === 'all' ? 'bg-primary text-white' : 'text-gray-600 active:bg-gray-100'
            }`}
          >
            Tous
          </button>
          <button
            onClick={() => setViewMode('branch')}
            className={`rounded-xl px-3 py-1 text-sm font-semibold transition-all ${
              viewMode === 'branch' ? 'bg-primary text-white' : 'text-gray-600 active:bg-gray-100'
            }`}
          >
            Ma branche
          </button>
          {families.length > 0 && (
            <div className="w-36 shrink-0">
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
        </div>
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
      </div>
    </div>
  )
}
