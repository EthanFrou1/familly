import { useState } from 'react'
import { useAuth } from '../../hooks/useAuth'
import { useMembers } from '../../store/MembersContext'
import { matchesSearch } from '../../utils/normalize'
import Avatar from '../shared/Avatar'

export default function PlayerSetupStep({ onContinue }) {
  const { user } = useAuth()
  const { members } = useMembers()
  const [count, setCount] = useState(2)
  const [slots, setSlots] = useState([{ search: '', memberId: null }])

  const currentMember = members.find(m => m.id === user?.memberId)

  function setCountAndSlots(n) {
    setCount(n)
    setSlots(prev => Array.from({ length: n - 1 }, (_, i) => prev[i] ?? { search: '', memberId: null }))
  }

  function updateSlot(i, patch) {
    setSlots(prev => prev.map((s, idx) => idx === i ? { ...s, ...patch } : s))
  }

  const takenMemberIds = new Set([user?.memberId, ...slots.map(s => s.memberId).filter(Boolean)])

  function handleContinue() {
    const players = [
      { name: `${user.firstName} ${user.lastName}`, memberId: user.memberId, isGuest: false },
      ...slots.map((slot, i) => {
        if (slot.memberId) {
          const m = members.find(mm => mm.id === slot.memberId)
          return { name: `${m.firstName} ${m.lastName}`, memberId: m.id, isGuest: false }
        }
        return { name: slot.search.trim() || `Joueur ${i + 2}`, memberId: null, isGuest: true }
      }),
    ]
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

        <div className="flex items-center gap-3 rounded-xl bg-white shadow-sm px-4 py-2.5">
          <Avatar member={currentMember} name={`${user?.firstName ?? ''} ${user?.lastName ?? ''}`} size="sm" />
          <div className="flex-1">
            <p className="text-sm font-medium text-gray-800">{user?.firstName} {user?.lastName}</p>
            <p className="text-xs text-gray-400">Vous</p>
          </div>
        </div>

        {slots.map((slot, i) => (
          <PlayerSlot
            key={i}
            index={i}
            slot={slot}
            members={members.filter(m => !takenMemberIds.has(m.id))}
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

function PlayerSlot({ index, slot, members, onChange }) {
  const filtered = slot.search.trim()
    ? members.filter(m => matchesSearch(`${m.firstName} ${m.lastName}`, slot.search))
    : []

  return (
    <div className="space-y-1">
      <div className="relative">
        <input
          value={slot.search}
          onChange={e => onChange({ search: e.target.value, memberId: null })}
          placeholder={`Joueur ${index + 2} — membre ou invité`}
          className={`w-full rounded-xl bg-white shadow-sm px-4 py-2.5 text-sm focus:outline-none ${slot.memberId ? 'ring-2 ring-primary' : ''}`}
        />
        {slot.memberId && (
          <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-primary font-semibold">membre</span>
        )}
      </div>

      {slot.search.trim() && !slot.memberId && (
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
          <p className="px-1 text-xs text-gray-400">Aucun membre trouvé — sera ajouté comme invité « {slot.search.trim()} »</p>
        )
      )}
    </div>
  )
}
