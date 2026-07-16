import { useState } from 'react'
import { pushApi } from '../../services/api'
import Avatar from '../shared/Avatar'

// Envoie une notif push (lien direct vers la partie) aux membres choisis.
// Ne liste que ceux joignables : notifs activées + app installée en PWA.
export default function ChallengeButton({ gameType, roomCode }) {
  const [open, setOpen] = useState(false)
  const [members, setMembers] = useState(null)
  const [selected, setSelected] = useState(new Set())
  const [sending, setSending] = useState(false)
  const [sent, setSent] = useState(false)
  const [error, setError] = useState('')

  function openModal() {
    setOpen(true)
    setError('')
    setSent(false)
    if (members === null) {
      pushApi.getChallengeableMembers()
        .then(({ data }) => setMembers(data))
        .catch(() => setMembers([]))
    }
  }

  function toggle(userId) {
    setSelected(prev => {
      const next = new Set(prev)
      if (next.has(userId)) next.delete(userId)
      else next.add(userId)
      return next
    })
  }

  async function handleSend() {
    if (selected.size === 0 || !roomCode) return
    setSending(true)
    setError('')
    try {
      await pushApi.sendChallenge([...selected], gameType, roomCode)
      setSent(true)
      setSelected(new Set())
    } catch {
      setError("Impossible d'envoyer le défi.")
    } finally {
      setSending(false)
    }
  }

  return (
    <>
      <button
        onClick={openModal}
        className="w-full rounded-xl bg-white border border-primary/30 py-3 text-sm font-semibold text-primary active:bg-primary/5 mb-3"
      >
        🔔 Défier des membres
      </button>

      {open && (
        <div
          className="fixed inset-0 z-[60] flex items-end justify-center bg-black/40"
          onClick={() => setOpen(false)}
        >
          <div
            className="w-full max-w-md bg-white rounded-t-3xl px-4 pt-4 pb-8 max-h-[75vh] flex flex-col"
            onClick={e => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-3 shrink-0">
              <h2 className="text-base font-black text-gray-800">Défier des membres</h2>
              <button
                onClick={() => setOpen(false)}
                className="h-8 w-8 flex items-center justify-center text-gray-400"
              >
                ✕
              </button>
            </div>

            {members === null ? (
              <p className="text-center text-sm text-gray-400 py-8">Chargement…</p>
            ) : members.length === 0 ? (
              <p className="text-center text-sm text-gray-400 py-8">
                Personne n'est joignable pour l'instant : le défi ne fonctionne que pour les membres
                ayant activé les notifications et installé l'app sur leur téléphone.
              </p>
            ) : (
              <div className="flex-1 min-h-0 overflow-y-auto space-y-1.5">
                {members.map(m => {
                  const isSelected = selected.has(m.userId)
                  return (
                    <button
                      key={m.userId}
                      onClick={() => toggle(m.userId)}
                      className={`w-full flex items-center gap-3 rounded-2xl px-3 py-2.5 border ${
                        isSelected ? 'bg-primary/10 border-primary/40' : 'bg-gray-50 border-transparent'
                      }`}
                    >
                      <Avatar src={m.profilePictureUrl} name={`${m.firstName} ${m.lastName}`} size="sm" />
                      <span className="flex-1 text-left text-sm font-semibold text-gray-700">
                        {m.firstName} {m.lastName}
                      </span>
                      {isSelected && <span className="text-primary text-lg">✓</span>}
                    </button>
                  )
                })}
              </div>
            )}

            {error && <p className="text-xs text-red-500 text-center mt-2 shrink-0">{error}</p>}

            {members?.length > 0 && (
              <button
                onClick={handleSend}
                disabled={selected.size === 0 || sending}
                className="w-full rounded-xl bg-primary py-3.5 text-sm font-semibold text-white mt-3 shrink-0 active:bg-primary-dark disabled:opacity-40"
              >
                {sent ? 'Défi envoyé ! 🎉' : sending ? 'Envoi…' : `Envoyer (${selected.size})`}
              </button>
            )}
          </div>
        </div>
      )}
    </>
  )
}
