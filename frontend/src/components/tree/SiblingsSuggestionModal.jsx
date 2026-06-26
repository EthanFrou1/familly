import { useState } from 'react'
import { relationsApi } from '../../services/api'

export default function SiblingsSuggestionModal({ suggestions, onClose, onCreated }) {
  const [creating, setCreating] = useState(new Set())
  const [created, setCreated] = useState(new Set())
  const [creatingAll, setCreatingAll] = useState(false)

  // Group by parent
  const byParent = suggestions.reduce((acc, s) => {
    const key = s.parent.id
    if (!acc[key]) acc[key] = { parent: s.parent, pairs: [] }
    acc[key].pairs.push(s)
    return acc
  }, {})

  const pairKey = (s) => `${s.memberA.id}|${s.memberB.id}`

  const createOne = async (s) => {
    const k = pairKey(s)
    if (created.has(k)) return
    setCreating(prev => new Set(prev).add(k))
    try {
      await relationsApi.create({ memberAId: s.memberA.id, memberBId: s.memberB.id, type: 'Sibling' })
      setCreated(prev => new Set(prev).add(k))
      onCreated()
    } finally {
      setCreating(prev => { const n = new Set(prev); n.delete(k); return n })
    }
  }

  const createAll = async () => {
    setCreatingAll(true)
    const pending = suggestions.filter(s => !created.has(pairKey(s)))
    for (const s of pending) {
      const k = pairKey(s)
      try {
        await relationsApi.create({ memberAId: s.memberA.id, memberBId: s.memberB.id, type: 'Sibling' })
        setCreated(prev => new Set(prev).add(k))
      } catch {}
    }
    setCreatingAll(false)
    onCreated()
  }

  const remaining = suggestions.filter(s => !created.has(pairKey(s)))

  return (
    <div className="fixed inset-0 z-[60] flex items-end justify-center bg-black/40" onClick={onClose}>
      <div
        className="w-full max-w-md bg-white rounded-t-3xl shadow-2xl pb-20 max-h-[80vh] flex flex-col"
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
              <path strokeLinecap="round" strokeLinejoin="round" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
          <div className="flex-1">
            <p className="font-bold text-gray-900 text-sm">Relations frère/sœur détectées</p>
            <p className="text-xs text-gray-500 mt-0.5">
              {suggestions.length} lien{suggestions.length > 1 ? 's' : ''} potentiel{suggestions.length > 1 ? 's' : ''} trouvé{suggestions.length > 1 ? 's' : ''} d'après les parents communs.
            </p>
          </div>
          <button onClick={onClose} className="text-gray-300 p-1">
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* List */}
        <div className="flex-1 overflow-y-auto px-5 py-3 space-y-4">
          {Object.values(byParent).map(({ parent, pairs }) => (
            <div key={parent.id}>
              <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-2">
                {parent.firstName} {parent.lastName}
              </p>
              <div className="space-y-2">
                {pairs.map(s => {
                  const k = pairKey(s)
                  const done = created.has(k)
                  const busy = creating.has(k)
                  return (
                    <div
                      key={k}
                      className={`flex items-center justify-between rounded-xl px-3 py-2 ${done ? 'bg-green-50' : 'bg-gray-50'}`}
                    >
                      <span className="text-sm text-gray-700">
                        <span className="font-semibold">{s.memberA.firstName}</span>
                        <span className="text-gray-400 mx-1.5">—</span>
                        <span className="font-semibold">{s.memberB.firstName}</span>
                      </span>
                      {done ? (
                        <span className="text-xs font-semibold text-green-600 flex items-center gap-1">
                          <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                          </svg>
                          Créé
                        </span>
                      ) : (
                        <button
                          onClick={() => createOne(s)}
                          disabled={busy}
                          className="text-xs font-semibold text-primary bg-violet-50 rounded-lg px-3 py-1 active:bg-violet-100 disabled:opacity-50"
                        >
                          {busy ? '...' : 'Créer'}
                        </button>
                      )}
                    </div>
                  )
                })}
              </div>
            </div>
          ))}
        </div>

        {/* Footer */}
        <div className="px-5 pt-3 flex gap-3 border-t border-gray-100">
          <button
            onClick={onClose}
            className="flex-1 rounded-2xl py-3 text-sm font-semibold bg-gray-100 text-gray-600 active:bg-gray-200"
          >
            Ignorer
          </button>
          {remaining.length > 1 && (
            <button
              onClick={createAll}
              disabled={creatingAll}
              className="flex-1 rounded-2xl py-3 text-sm font-semibold bg-primary text-white active:opacity-90 disabled:opacity-50"
            >
              {creatingAll ? 'Création...' : `Créer tout (${remaining.length})`}
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
