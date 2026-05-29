import { useState } from 'react'
import { createPortal } from 'react-dom'
import { useMembers } from '../../store/MembersContext'
import Select from '../shared/Select'

const RELATION_OPTIONS = [
  { value: 'ParentChild_A', label: 'est parent de', apiType: 'ParentChild', memberAIsCurrent: true },
  { value: 'ParentChild_B', label: "est l'enfant de", apiType: 'ParentChild', memberAIsCurrent: false },
  { value: 'Spouse', label: 'est conjoint(e) de', apiType: 'Spouse', memberAIsCurrent: true },
  { value: 'Separated', label: 'est séparé(e) / divorcé(e) de', apiType: 'Separated', memberAIsCurrent: true },
  { value: 'Sibling', label: 'est frère / sœur de', apiType: 'Sibling', memberAIsCurrent: true },
  { value: 'HalfSibling', label: 'est demi-frère / demi-sœur de', apiType: 'HalfSibling', memberAIsCurrent: true },
]

export default function RelationFormModal({ open, onClose, onSubmit, currentMember }) {
  const { members } = useMembers()
  const [relationType, setRelationType] = useState('')
  const [otherMemberId, setOtherMemberId] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const [search, setSearch] = useState('')

  const otherMembers = members.filter(m => m.id !== currentMember?.id)
  const filteredMembers = search.trim()
    ? otherMembers.filter(m =>
        `${m.firstName} ${m.lastName}`.toLowerCase().includes(search.toLowerCase())
      )
    : otherMembers

  async function handleSubmit(e) {
    e.preventDefault()
    if (!relationType || !otherMemberId) return
    setLoading(true)
    setError('')

    const opt = RELATION_OPTIONS.find(o => o.value === relationType)
    const payload = {
      memberAId: opt.memberAIsCurrent ? currentMember.id : otherMemberId,
      memberBId: opt.memberAIsCurrent ? otherMemberId : currentMember.id,
      type: opt.apiType,
    }

    try {
      await onSubmit(payload)
      setRelationType('')
      setOtherMemberId('')
      onClose()
    } catch (err) {
      const msg = err.response?.data?.message
      setError(msg || 'Une erreur est survenue.')
    } finally {
      setLoading(false)
    }
  }

  function handleClose() {
    setRelationType('')
    setOtherMemberId('')
    setSearch('')
    setError('')
    onClose()
  }

  if (!open) return null

  const selectedOther = members.find(m => m.id === otherMemberId)
  const selectedOpt = RELATION_OPTIONS.find(o => o.value === relationType)

  return createPortal(
    <div className="fixed inset-0 z-[60] flex flex-col justify-end">
      <div className="absolute inset-0 bg-black/50" onClick={handleClose} />
      <div className="relative bg-white rounded-t-3xl animate-slide-up px-5 pt-6 pb-10">
        <div className="flex items-center justify-between mb-5">
          <h2 className="text-lg font-semibold text-gray-900">Ajouter un lien familial</h2>
          <button onClick={handleClose} className="text-gray-400 p-1">
            <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Aperçu de la relation */}
        {currentMember && (
          <div className="mb-5 rounded-2xl bg-gray-50 px-4 py-3 text-sm text-gray-600 text-center leading-relaxed">
            <span className="font-semibold text-gray-900">{currentMember.firstName} {currentMember.lastName}</span>
            {selectedOpt && <span className="text-primary mx-1">{selectedOpt.label}</span>}
            {selectedOther && <span className="font-semibold text-gray-900">{selectedOther.firstName} {selectedOther.lastName}</span>}
            {(!selectedOpt || !selectedOther) && <span className="text-gray-400"> …</span>}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-1.5">
            <label className="text-sm font-medium text-gray-600">Type de lien</label>
            <Select value={relationType} onChange={e => setRelationType(e.target.value)} required placeholder="Sélectionner…">
              {RELATION_OPTIONS.map(opt => (
                <option key={opt.value} value={opt.value}>{opt.label}</option>
              ))}
            </Select>
          </div>

          <div className="space-y-1.5">
            <label className="text-sm font-medium text-gray-600">Avec quel membre ?</label>
            <div className="relative">
              <input
                type="text"
                value={search}
                onChange={e => { setSearch(e.target.value); setOtherMemberId('') }}
                placeholder="Filtrer par prénom…"
                className="w-full rounded-xl border border-gray-200 bg-white pl-9 pr-4 py-2.5 text-sm text-gray-700 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
              />
              <svg className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400 pointer-events-none" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-4.35-4.35M17 11A6 6 0 111 11a6 6 0 0116 0z" />
              </svg>
            </div>

            {search.trim() ? (
              filteredMembers.length > 0 ? (
                <ul className="rounded-xl border border-gray-200 bg-white overflow-hidden max-h-44 overflow-y-auto">
                  {filteredMembers.map(m => (
                    <li key={m.id}>
                      <button
                        type="button"
                        onClick={() => { setOtherMemberId(m.id); setSearch(`${m.firstName} ${m.lastName}`) }}
                        className={`w-full px-4 py-3 text-left text-sm flex items-center justify-between gap-2 active:bg-primary/10
                          ${otherMemberId === m.id ? 'bg-primary/10 text-primary font-semibold' : 'text-gray-800 hover:bg-gray-50'}`}
                      >
                        <span>{m.firstName} {m.lastName}</span>
                        {m.familyName && <span className="text-xs text-gray-400 shrink-0">{m.familyName}</span>}
                      </button>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="rounded-xl border border-gray-200 px-4 py-3 text-sm text-gray-400">Aucun membre trouvé</p>
              )
            ) : (
              <Select value={otherMemberId} onChange={e => setOtherMemberId(e.target.value)} required placeholder="Sélectionner…">
                {otherMembers.map(m => (
                  <option key={m.id} value={m.id}>{m.firstName} {m.lastName}{m.familyName ? ` — ${m.familyName}` : ''}</option>
                ))}
              </Select>
            )}
          </div>

          {error && (
            <p className="rounded-xl bg-red-50 px-4 py-3 text-sm text-red-600 text-center">{error}</p>
          )}

          <button
            type="submit"
            disabled={loading || !relationType || !otherMemberId}
            className="w-full rounded-xl bg-primary py-3.5 font-semibold text-white disabled:opacity-50 active:bg-primary-dark"
          >
            {loading ? '...' : 'Créer le lien'}
          </button>
        </form>
      </div>
    </div>,
    document.body
  )
}
