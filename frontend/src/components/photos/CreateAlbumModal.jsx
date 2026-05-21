import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { albumsApi, eventsApi } from '../../services/api'
import Select from '../shared/Select'

export default function CreateAlbumModal({ open, onClose, onCreated }) {
  const [name, setName] = useState('')
  const [eventId, setEventId] = useState('')
  const [events, setEvents] = useState([])
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState(null)

  useEffect(() => {
    if (!open) return
    eventsApi.getAll().then(({ data }) => setEvents(data)).catch(() => {})
  }, [open])

  function handleClose() {
    setName('')
    setEventId('')
    setError(null)
    onClose()
  }

  async function handleSubmit(e) {
    e.preventDefault()
    if (!name.trim()) { setError('Le nom est obligatoire.'); return }
    setSubmitting(true)
    setError(null)
    try {
      const { data } = await albumsApi.create({ name: name.trim(), eventId: eventId || null })
      onCreated(data)
      handleClose()
    } catch {
      setError('Une erreur est survenue.')
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
          <h2 className="text-base font-bold text-gray-900">Nouvel album</h2>
          <button type="button" onClick={handleClose} className="h-8 w-8 flex items-center justify-center rounded-full text-gray-400 hover:text-gray-600 hover:bg-gray-100">
            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <div>
            <label className="block text-xs font-semibold text-gray-500 mb-1.5">Nom de l'album <span className="text-red-500">*</span></label>
            <input
              type="text"
              value={name}
              onChange={e => setName(e.target.value)}
              placeholder="Ex : Vacances été 2025"
              autoFocus
              className="w-full rounded-xl border border-gray-200 px-3.5 py-3 text-sm text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary"
            />
          </div>

          {events.length > 0 && (
            <div>
              <label className="block text-xs font-semibold text-gray-500 mb-1.5">Événement lié (optionnel)</label>
              <Select value={eventId} onChange={e => setEventId(e.target.value)} placeholder="— Aucun événement —">
                {events.map(ev => <option key={ev.id} value={ev.id}>{ev.title}</option>)}
              </Select>
            </div>
          )}

          {error && <p className="rounded-xl bg-red-50 px-3.5 py-3 text-sm text-red-600">{error}</p>}

          <button type="submit" disabled={submitting} className="w-full rounded-xl bg-primary py-3 font-semibold text-white min-h-touch active:bg-primary-dark disabled:opacity-50 mt-1">
            {submitting ? 'Création…' : 'Créer l\'album'}
          </button>
        </form>
      </div>
    </div>,
    document.body
  )
}
