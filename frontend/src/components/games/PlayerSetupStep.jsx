import { useState } from 'react'
import { useAuth } from '../../hooks/useAuth'
import { useMembers } from '../../store/MembersContext'
import { matchesSearch } from '../../utils/normalize'
import Avatar from '../shared/Avatar'

export default function PlayerSetupStep({ onContinue }) {
  const { user } = useAuth()
  const { members } = useMembers()
  const [count, setCount] = useState(2)
  const [slots, setSlots] = useState(() => [
    { mode: 'member', search: `${user.firstName} ${user.lastName}`, memberId: user.memberId },
    { mode: 'guest', search: '', memberId: null },
  ])

  function setCountAndSlots(n) {
    setCount(n)
    setSlots(prev => Array.from({ length: n }, (_, i) => prev[i] ?? { mode: 'guest', search: '', memberId: null }))
  }

  function updateSlot(i, patch) {
    setSlots(prev => prev.map((s, idx) => idx === i ? { ...s, ...patch } : s))
  }

  const memberById = id => members.find(m => m.id === id)

  function handleContinue() {
    const players = slots.map((slot, i) => {
      if (slot.mode === 'member' && slot.memberId) {
        const m = memberById(slot.memberId)
        return { name: `${m.firstName} ${m.lastName}`, memberId: m.id, isGuest: false, colorIndex: i }
      }
      return { name: slot.search.trim() || `Joueur ${i + 1}`, memberId: null, isGuest: true, colorIndex: i }
    })
    onContinue(players)
  }

  return (
    <div className="px-4 mt-5 space-y-5">
      <div>
        <h2 className="text-sm font-semibold text-gray-500 mb-2">Nombre de joueurs</h2>
        <div className="flex gap-2">
          {[2, 3, 4].map(n => (
            <button
              key={n}
              onClick={() => setCountAndSlots(n)}
              className={`flex-1 rounded-xl py-3 text-sm font-semibold ${count === n ? 'bg-primary text-white' : 'bg-white text-gray-600 shadow-sm'}`}
            >
              {n} joueurs
            </button>
          ))}
        </div>
      </div>

      <div className="space-y-3">
        <h2 className="text-sm font-semibold text-gray-500">Joueurs</h2>
        {slots.map((slot, i) => (
          <PlayerSlot
            key={i}
            index={i}
            isSelf={i === 0}
            isOwnAccount={slot.memberId === user.memberId}
            slot={slot}
            member={slot.memberId ? memberById(slot.memberId) : null}
            candidates={members.filter(m => !slots.some((s, idx) => idx !== i && s.memberId === m.id))}
            onChange={patch => updateSlot(i, patch)}
          />
        ))}
      </div>

      <button
        onClick={handleContinue}
        className="w-full rounded-xl bg-primary py-3 text-sm font-semibold text-white active:bg-primary-dark"
      >
        Continuer
      </button>
    </div>
  )
}

function PlayerSlot({ index, isSelf, isOwnAccount, slot, member, candidates, onChange }) {
  const linked = isSelf || (slot.mode === 'member' && !!slot.memberId)
  const searching = !isSelf && slot.mode === 'member' && !slot.memberId

  const filtered = searching && slot.search.trim()
    ? candidates.filter(m => matchesSearch(`${m.firstName} ${m.lastName}`, slot.search))
    : []

  function toggleLink() {
    if (linked) onChange({ mode: 'guest', memberId: null })
    else if (searching) onChange({ mode: 'guest' })
    else onChange({ mode: 'member', memberId: null })
  }

  return (
    <div className="space-y-1">
      <div className="flex items-center gap-2">
        {linked && <Avatar member={member} name={slot.search} size="sm" />}
        <div className="relative flex-1">
          <input
            value={slot.search}
            disabled={linked}
            onChange={e => onChange({ search: e.target.value, memberId: null })}
            placeholder={isSelf ? 'Votre prénom' : `Joueur ${index + 1} — nom libre`}
            className={`w-full rounded-xl bg-white shadow-sm px-4 py-2.5 text-sm focus:outline-none ${linked ? 'text-gray-500' : ''}`}
          />
          {linked && isOwnAccount && (
            <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-gray-400">Vous</span>
          )}
        </div>
        {!isSelf && (
          <button
            type="button"
            onClick={toggleLink}
            className={`shrink-0 rounded-xl px-3 py-2.5 text-xs font-semibold transition-colors ${
              linked ? 'bg-primary text-white' : searching ? 'bg-gray-200 text-gray-600' : 'bg-primary/10 text-primary'
            }`}
          >
            {linked ? 'Délier' : searching ? 'Annuler' : 'Lier'}
          </button>
        )}
      </div>

      {searching && (
        slot.search.trim() ? (
          filtered.length > 0 ? (
            <ul className="rounded-xl border border-gray-200 bg-white overflow-hidden max-h-40 overflow-y-auto">
              {filtered.map(m => (
                <li key={m.id}>
                  <button
                    type="button"
                    onClick={() => onChange({ memberId: m.id, search: `${m.firstName} ${m.lastName}` })}
                    className="w-full px-4 py-2.5 text-left text-sm text-gray-700 hover:bg-gray-50 active:bg-primary/10"
                  >
                    {m.firstName} {m.lastName}
                  </button>
                </li>
              ))}
            </ul>
          ) : (
            <p className="px-1 text-xs text-gray-400">Aucun membre trouvé</p>
          )
        ) : (
          <p className="px-1 text-xs text-gray-400">Tapez un nom pour rechercher un membre à lier</p>
        )
      )}

      {!searching && !linked && (
        <p className="px-1 text-xs text-gray-400">Joueur invité, non comptabilisé dans les classements</p>
      )}
    </div>
  )
}
