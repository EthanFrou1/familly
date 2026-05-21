import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { eventsApi, externalMediaApi, membersApi } from '../../services/api'

export default function AddVideoModal({ open, onClose, onAdded }) {
  const [url, setUrl] = useState('')
  const [title, setTitle] = useState('')
  const [eventId, setEventId] = useState('')
  const [linkedMemberId, setLinkedMemberId] = useState('')
  const [events, setEvents] = useState([])
  const [members, setMembers] = useState([])
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState(null)

  useEffect(() => {
    if (!open) return
    eventsApi.getAll().then(({ data }) => setEvents(data)).catch(() => {})
    membersApi.getAll().then(({ data }) => setMembers(data)).catch(() => {})
  }, [open])

  function reset() {
    setUrl('')
    setTitle('')
    setEventId('')
    setLinkedMemberId('')
    setError(null)
  }

  function handleClose() {
    reset()
    onClose()
  }

  async function handleSubmit(e) {
    e.preventDefault()
    if (!url.trim()) {
      setError('Le lien Google Photos est obligatoire.')
      return
    }
    setSubmitting(true)
    setError(null)
    try {
      const { data } = await externalMediaApi.create({
        title: title.trim() || null,
        externalUrl: url.trim(),
        eventId: eventId || null,
        linkedMemberId: linkedMemberId || null,
      })
      onAdded(data)
      handleClose()
    } catch (err) {
      setError(err.response?.data?.message ?? 'Une erreur est survenue.')
    } finally {
      setSubmitting(false)
    }
  }

  if (!open) return null

  return createPortal(
    <div className="fixed inset-0 z-[70] flex items-end justify-center sm:items-center">
      <div className="absolute inset-0 bg-black/50" onClick={handleClose} />
      <div className="relative bg-white rounded-t-3xl animate-slide-up sm:rounded-2xl w-full sm:max-w-md px-5 pt-6 pb-10 sm:pb-6">
        <div className="flex items-center justify-between mb-5">
          <h2 className="text-base font-bold text-gray-900">Ajouter une vidéo</h2>
          <button
            type="button"
            onClick={handleClose}
            className="h-8 w-8 flex items-center justify-center rounded-full text-gray-400 hover:text-gray-600 hover:bg-gray-100"
          >
            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <div>
            <label className="block text-xs font-semibold text-gray-500 mb-1.5">
              Lien Google Photos <span className="text-red-500">*</span>
            </label>
            <input
              type="url"
              value={url}
              onChange={e => setUrl(e.target.value)}
              placeholder="https://photos.google.com/photo/..."
              className="w-full rounded-xl border border-gray-200 px-3.5 py-3 text-sm text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary"
              autoFocus
            />
            <p className="mt-1 text-xs text-gray-400">
              Partage → Copier le lien depuis Google Photos
            </p>
          </div>

          <div>
            <label className="block text-xs font-semibold text-gray-500 mb-1.5">Titre (optionnel)</label>
            <input
              type="text"
              value={title}
              onChange={e => setTitle(e.target.value)}
              placeholder="Ex : Vacances été 2025"
              className="w-full rounded-xl border border-gray-200 px-3.5 py-3 text-sm text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary"
            />
          </div>

          {events.length > 0 && (
            <div>
              <label className="block text-xs font-semibold text-gray-500 mb-1.5">Événement (optionnel)</label>
              <select
                value={eventId}
                onChange={e => setEventId(e.target.value)}
                className="w-full rounded-xl border border-gray-200 px-3.5 py-3 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary bg-white"
              >
                <option value="">— Aucun événement —</option>
                {events.map(ev => (
                  <option key={ev.id} value={ev.id}>{ev.title}</option>
                ))}
              </select>
            </div>
          )}

          {members.length > 0 && (
            <div>
              <label className="block text-xs font-semibold text-gray-500 mb-1.5">Membre lié (optionnel)</label>
              <select
                value={linkedMemberId}
                onChange={e => setLinkedMemberId(e.target.value)}
                className="w-full rounded-xl border border-gray-200 px-3.5 py-3 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary bg-white"
              >
                <option value="">— Aucun membre —</option>
                {members.map(m => (
                  <option key={m.id} value={m.id}>{m.firstName} {m.lastName}</option>
                ))}
              </select>
            </div>
          )}

          {error && (
            <p className="rounded-xl bg-red-50 px-3.5 py-3 text-sm text-red-600">{error}</p>
          )}

          <button
            type="submit"
            disabled={submitting}
            className="w-full rounded-xl bg-primary py-3 font-semibold text-white min-h-touch active:bg-primary-dark disabled:opacity-50 mt-1"
          >
            {submitting ? 'Ajout en cours…' : 'Ajouter la vidéo'}
          </button>
        </form>
      </div>
    </div>,
    document.body
  )
}
