import { useState } from 'react'
import { useAuth } from '../../hooks/useAuth'
import { useMembers } from '../../store/MembersContext'
import { matchesSearch } from '../../utils/normalize'
import { DIFFICULTY_PRESETS, PLAYER_COLORS } from '../../utils/memoryGame'
import Avatar from '../shared/Avatar'

export default function GameConfigScreen({
  photoCount,
  onStart,
  presets = DIFFICULTY_PRESETS,
  sectionLabel = 'Difficulté',
  unitLabel = 'paires',
}) {
  const { user } = useAuth()
  const { members } = useMembers()
  const [count, setCount] = useState(2)
  const [slots, setSlots] = useState(() => [
    { mode: 'member', search: `${user.firstName} ${user.lastName}`, memberId: user.memberId },
    { mode: 'guest', search: '', memberId: null },
  ])
  const [selectedValue, setSelectedValue] = useState(() => {
    const isAvailable = p => photoCount >= (p.minRequired ?? p.value)
    const preferred = presets.find(p => p.value === 8 && isAvailable(p))
    return preferred?.value ?? presets.find(isAvailable)?.value ?? null
  })

  function setCountAndSlots(n) {
    setCount(n)
    setSlots(prev => Array.from({ length: n }, (_, i) => prev[i] ?? { mode: 'guest', search: '', memberId: null }))
  }

  function updateSlot(i, patch) {
    setSlots(prev => prev.map((s, idx) => idx === i ? { ...s, ...patch } : s))
  }

  const memberById = id => members.find(m => m.id === id)

  function handleStart() {
    if (!selectedValue) return
    const players = slots.map((slot, i) => {
      if (slot.mode === 'member' && slot.memberId) {
        const m = memberById(slot.memberId)
        return { name: `${m.firstName} ${m.lastName}`, memberId: m.id, isGuest: false, colorIndex: i }
      }
      return { name: slot.search.trim() || `Joueur ${i + 1}`, memberId: null, isGuest: true, colorIndex: i }
    })
    onStart(players, selectedValue)
  }

  return (
    <div className="px-4 mt-5 pb-4 space-y-6">
      <div>
        <h2 className="text-xs font-bold text-gray-400 uppercase tracking-wide mb-2.5">Joueurs</h2>
        <div className="flex gap-2 mb-4">
          {[2, 3, 4].map(n => (
            <button
              key={n}
              onClick={() => setCountAndSlots(n)}
              className={`flex-1 rounded-2xl py-3 text-sm font-black transition-colors ${
                count === n ? 'bg-primary text-white shadow-md shadow-primary/30' : 'bg-white text-gray-600 shadow-sm'
              }`}
            >
              {n}
            </button>
          ))}
        </div>

        <div className="space-y-2.5">
          {slots.map((slot, i) => (
            <PlayerSlot
              key={i}
              index={i}
              isSelf={i === 0}
              slot={slot}
              member={slot.memberId ? memberById(slot.memberId) : null}
              candidates={members.filter(m => !slots.some((s, idx) => idx !== i && s.memberId === m.id))}
              onChange={patch => updateSlot(i, patch)}
            />
          ))}
        </div>
      </div>

      <div>
        <h2 className="text-xs font-bold text-gray-400 uppercase tracking-wide mb-2.5">{sectionLabel}</h2>
        <div className="flex gap-2.5">
          {presets.map(preset => {
            const disabled = photoCount < (preset.minRequired ?? preset.value)
            const selected = selectedValue === preset.value
            return (
              <button
                key={preset.value}
                disabled={disabled}
                onClick={() => setSelectedValue(preset.value)}
                className={`flex-1 rounded-2xl p-4 text-center transition-all disabled:opacity-40 ${
                  selected ? 'bg-primary shadow-lg shadow-primary/30 scale-[1.06]' : 'bg-white shadow-sm'
                }`}
              >
                <div className="text-2xl">{preset.emoji}</div>
                <p className={`mt-1.5 font-extrabold text-sm ${selected ? 'text-white' : 'text-gray-800'}`}>{preset.label}</p>
                <p className={`mt-0.5 text-[11px] font-bold ${selected ? 'text-white/75' : 'text-gray-400'}`}>{preset.value} {unitLabel}</p>
              </button>
            )
          })}
        </div>
      </div>

      <button
        onClick={handleStart}
        disabled={!selectedValue}
        className="w-full rounded-2xl bg-dark py-4 text-base font-black text-white shadow-lg shadow-dark/30 active:opacity-90 disabled:opacity-40 flex items-center justify-center gap-2"
      >
        C'est parti !
        <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M5 12h14M13 6l6 6-6 6" />
        </svg>
      </button>
    </div>
  )
}

function PlayerSlot({ index, isSelf, slot, member, candidates, onChange }) {
  const linked = isSelf || (slot.mode === 'member' && !!slot.memberId)
  const searching = !isSelf && slot.mode === 'member' && !slot.memberId
  const color = PLAYER_COLORS[index % PLAYER_COLORS.length]

  const filtered = searching && slot.search.trim()
    ? candidates.filter(m => matchesSearch(`${m.firstName} ${m.lastName}`, slot.search))
    : []

  function toggleLink() {
    if (linked) onChange({ mode: 'guest', memberId: null })
    else if (searching) onChange({ mode: 'guest' })
    else onChange({ mode: 'member', memberId: null })
  }

  return (
    <div className="space-y-1.5">
      <div className={`flex items-center gap-3 bg-white rounded-2xl shadow-sm py-2.5 pl-2.5 pr-3 border-l-4 ${linked ? color.border : 'border-gray-200'}`}>
        <Avatar member={member} name={slot.search} size="sm" className={linked ? `ring-2 ${color.ring}` : ''} />
        <div className="flex-1 min-w-0">
          {linked ? (
            <p className="font-bold text-sm text-gray-800 truncate">{slot.search}</p>
          ) : (
            <input
              value={slot.search}
              onChange={e => onChange({ search: e.target.value, memberId: null })}
              placeholder={`Joueur ${index + 1} — nom libre`}
              className="w-full bg-transparent text-sm font-semibold text-gray-800 focus:outline-none placeholder:font-medium placeholder:text-gray-400"
            />
          )}
          <p className={`text-[11px] font-bold ${linked ? color.text : 'text-gray-400'}`}>Joueur {index + 1}</p>
        </div>
        {isSelf ? (
          <span className="shrink-0 text-[11px] font-bold text-gray-400 bg-gray-100 rounded-full px-3 py-1.5">Vous</span>
        ) : linked ? (
          <button type="button" onClick={toggleLink} className="shrink-0 text-[11px] font-bold text-primary bg-primary/10 rounded-full px-3 py-1.5 active:bg-primary/20">
            Lié ✓
          </button>
        ) : (
          <button
            type="button"
            onClick={toggleLink}
            className={`shrink-0 text-[11px] font-bold rounded-full px-3 py-1.5 ${searching ? 'bg-gray-200 text-gray-600' : 'bg-primary/10 text-primary'}`}
          >
            {searching ? 'Annuler' : 'Lier'}
          </button>
        )}
      </div>

      {searching && (
        slot.search.trim() ? (
          filtered.length > 0 ? (
            <ul className="ml-2 rounded-xl border border-gray-200 bg-white overflow-hidden max-h-40 overflow-y-auto">
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
            <p className="pl-3 text-xs text-gray-400">Aucun membre trouvé</p>
          )
        ) : (
          <p className="pl-3 text-xs text-gray-400">Tapez un nom pour rechercher un membre à lier</p>
        )
      )}

      {!searching && !linked && (
        <p className="pl-3 text-xs text-gray-400">Joueur invité, non comptabilisé dans les classements</p>
      )}
    </div>
  )
}
