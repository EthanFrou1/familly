import { useState } from 'react'
import { relationsApi } from '../../services/api'
import Select from '../shared/Select'
import Avatar from '../shared/Avatar'

const RELATION_OPTS = [
  { value: '', label: 'Sélectionner…' },
  { value: 'Sibling',      label: 'Frère / Sœur',            apiType: 'Sibling',      aIsNew: true  },
  { value: 'HalfSibling',  label: 'Demi-frère / Demi-sœur', apiType: 'HalfSibling',  aIsNew: true  },
  { value: 'ParentChild_A',label: 'Est le parent de',        apiType: 'ParentChild',  aIsNew: true  },
  { value: 'ParentChild_B',label: "Est l'enfant de",         apiType: 'ParentChild',  aIsNew: false },
  { value: 'Spouse',       label: 'Conjoint(e)',             apiType: 'Spouse',       aIsNew: true  },
]

export default function RelationSuggestionModal({ newMember, matches, onClose, onCreated }) {
  // row state: { [matchId]: { relType: string, done: bool, loading: bool } }
  const [rows, setRows] = useState(() =>
    Object.fromEntries(matches.map(m => [m.id, { relType: '', done: false, loading: false }]))
  )

  function setRow(id, patch) {
    setRows(prev => ({ ...prev, [id]: { ...prev[id], ...patch } }))
  }

  async function createOne(match) {
    const { relType } = rows[match.id]
    if (!relType) return
    const opt = RELATION_OPTS.find(o => o.value === relType)
    const payload = {
      memberAId: opt.aIsNew ? newMember.id : match.id,
      memberBId: opt.aIsNew ? match.id : newMember.id,
      type: opt.apiType,
    }
    setRow(match.id, { loading: true })
    try {
      await relationsApi.create(payload)
      setRow(match.id, { done: true, loading: false })
      onCreated?.()
    } catch {
      setRow(match.id, { loading: false })
    }
  }

  const allDone = matches.every(m => rows[m.id]?.done)

  return (
    <div className="fixed inset-0 z-[70] flex items-end justify-center bg-black/40" onClick={onClose}>
      <div
        className="w-full max-w-md bg-white rounded-t-3xl shadow-2xl pb-20 max-h-[85vh] flex flex-col"
        onClick={e => e.stopPropagation()}
      >
        {/* Handle */}
        <div className="flex justify-center pt-3 pb-1">
          <div className="h-1 w-10 rounded-full bg-gray-200" />
        </div>

        {/* Header */}
        <div className="flex items-start gap-3 px-5 pt-3 pb-4 border-b border-gray-100">
          <div className="flex-shrink-0 h-10 w-10 rounded-full bg-violet-100 flex items-center justify-center">
            <svg className="h-5 w-5 text-primary" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
          </div>
          <div className="flex-1 min-w-0">
            <p className="font-bold text-gray-900 text-sm">Liens potentiels détectés</p>
            <p className="text-xs text-gray-500 mt-0.5 leading-snug">
              {matches.length} membre{matches.length > 1 ? 's' : ''} porte{matches.length > 1 ? 'nt' : ''} le nom{' '}
              <span className="font-semibold text-gray-700">{newMember.lastName}</span>.
            </p>
          </div>
          <button onClick={onClose} className="text-gray-300 p-1 shrink-0">
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Rows */}
        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-3">
          {matches.map(match => {
            const row = rows[match.id]
            return (
              <div key={match.id} className={`rounded-2xl p-3 ${row.done ? 'bg-green-50' : 'bg-gray-50'}`}>
                {/* Names row */}
                <div className="flex items-center gap-2 mb-2.5">
                  <Avatar name={`${newMember.firstName} ${newMember.lastName}`} src={newMember.profilePictureUrl} size="xs" />
                  <span className="text-sm font-semibold text-gray-900 truncate">{newMember.firstName}</span>
                  <span className="text-gray-300 text-xs">·</span>
                  <Avatar name={`${match.firstName} ${match.lastName}`} src={match.profilePictureUrl} size="xs" />
                  <span className="text-sm font-semibold text-gray-900 truncate">{match.firstName}</span>
                </div>

                {row.done ? (
                  <div className="flex items-center gap-1.5 text-green-600 text-xs font-semibold">
                    <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                    </svg>
                    Lien créé
                  </div>
                ) : (
                  <div className="flex items-center gap-2">
                    <div className="flex-1">
                      <Select
                        value={row.relType}
                        onChange={e => setRow(match.id, { relType: e.target.value })}
                        placeholder="Type de lien…"
                      >
                        {RELATION_OPTS.slice(1).map(o => (
                          <option key={o.value} value={o.value}>{o.label}</option>
                        ))}
                      </Select>
                    </div>
                    <button
                      onClick={() => createOne(match)}
                      disabled={!row.relType || row.loading}
                      className="shrink-0 rounded-xl bg-primary text-white text-xs font-semibold px-3 py-2.5 disabled:opacity-40 active:opacity-80"
                    >
                      {row.loading ? '…' : 'Créer'}
                    </button>
                  </div>
                )}
              </div>
            )
          })}
        </div>

        {/* Footer */}
        <div className="px-5 pt-3 border-t border-gray-100">
          <button
            onClick={onClose}
            className="w-full rounded-2xl py-3 text-sm font-semibold bg-gray-100 text-gray-600 active:bg-gray-200"
          >
            {allDone ? 'Fermer' : 'Ignorer'}
          </button>
        </div>
      </div>
    </div>
  )
}
