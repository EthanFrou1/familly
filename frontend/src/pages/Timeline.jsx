import { useEffect, useState, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import imageCompression from 'browser-image-compression'
import { timelineApi, familiesApi, membersApi } from '../services/api'
import { useAuth } from '../hooks/useAuth'
import Avatar from '../components/shared/Avatar'
import ConfirmModal from '../components/shared/ConfirmModal'

const EVENT_TYPES = [
  { value: 'Birth',          label: 'Naissance',          icon: '👶' },
  { value: 'Marriage',       label: 'Mariage',             icon: '💍' },
  { value: 'Death',          label: 'Décès',               icon: '🕯️' },
  { value: 'Move',           label: 'Déménagement',        icon: '🏠' },
  { value: 'FamilyCreation', label: 'Création de famille', icon: '👨‍👩‍👧‍👦' },
  { value: 'Memory',         label: 'Souvenir',            icon: '📸' },
  { value: 'Other',          label: 'Événement libre',     icon: '📌' },
]

const TYPE_COLORS = {
  Birth:          { bg: 'bg-green-50',  border: 'border-green-200',  dot: 'bg-green-400',  text: 'text-green-700'  },
  Marriage:       { bg: 'bg-pink-50',   border: 'border-pink-200',   dot: 'bg-pink-400',   text: 'text-pink-700'   },
  Death:          { bg: 'bg-gray-50',   border: 'border-gray-200',   dot: 'bg-gray-400',   text: 'text-gray-600'   },
  Move:           { bg: 'bg-blue-50',   border: 'border-blue-200',   dot: 'bg-blue-400',   text: 'text-blue-700'   },
  FamilyCreation: { bg: 'bg-violet-50', border: 'border-violet-200', dot: 'bg-violet-400', text: 'text-violet-700' },
  Memory:         { bg: 'bg-amber-50',  border: 'border-amber-200',  dot: 'bg-amber-400',  text: 'text-amber-700'  },
  Other:          { bg: 'bg-gray-50',   border: 'border-gray-200',   dot: 'bg-primary/40', text: 'text-gray-600'   },
}

function formatDate(event) {
  if (event.exactDate) {
    const d = new Date(event.exactDate)
    return d.toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' })
  }
  if (event.year) return String(event.year)
  return 'Date inconnue'
}

export default function Timeline() {
  const { user } = useAuth()
  const navigate = useNavigate()
  const isAdmin = user?.role === 'Admin'

  const [events, setEvents] = useState([])
  const [loading, setLoading] = useState(true)
  const [showAdd, setShowAdd] = useState(false)
  const [editEvent, setEditEvent] = useState(null)
  const [confirmDelete, setConfirmDelete] = useState(null)
  const [filterType, setFilterType] = useState('all')

  useEffect(() => {
    timelineApi.getAll()
      .then(({ data }) => setEvents(data))
      .finally(() => setLoading(false))
  }, [])

  async function handleSave(data, photoFile) {
    if (editEvent) {
      const { data: updated } = await timelineApi.update(editEvent.id, data)
      if (photoFile) {
        const { data: photoData } = await timelineApi.uploadPhoto(updated.id, photoFile)
        updated.photoUrl = photoData.photoUrl
      }
      setEvents(prev => prev.map(e => e.id === updated.id ? updated : e))
    } else {
      const { data: created } = await timelineApi.create(data)
      if (photoFile) {
        const { data: photoData } = await timelineApi.uploadPhoto(created.id, photoFile)
        created.photoUrl = photoData.photoUrl
      }
      setEvents(prev => [created, ...prev])
    }
    setShowAdd(false)
    setEditEvent(null)
  }

  async function handleDelete(id) {
    await timelineApi.delete(id)
    setEvents(prev => prev.filter(e => e.id !== id))
    setConfirmDelete(null)
  }

  const filtered = filterType === 'all'
    ? events
    : events.filter(e => e.type === filterType)

  if (loading) return (
    <div className="flex h-full items-center justify-center">
      <div className="h-10 w-10 animate-spin rounded-full border-4 border-primary border-t-transparent" />
    </div>
  )

  return (
    <div className="overflow-y-auto h-full bg-gray-50 pb-24">

      {/* Header */}
      <div className="bg-dark px-5 pt-12 pb-4">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h1 className="text-2xl font-bold text-white">Histoire familiale</h1>
            <p className="text-white/70 text-sm mt-0.5">{events.length} événement{events.length !== 1 ? 's' : ''}</p>
          </div>
          <button
            onClick={() => { setEditEvent(null); setShowAdd(true) }}
            className="flex items-center gap-2 rounded-2xl bg-primary px-4 py-2.5 text-sm font-semibold text-white active:bg-primary-dark"
          >
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
            </svg>
            Ajouter
          </button>
        </div>

        {/* Filtre par type */}
        <div className="flex gap-2 overflow-x-auto scrollbar-none pb-1">
          <button
            onClick={() => setFilterType('all')}
            className="shrink-0 rounded-full px-3 py-1.5 text-xs font-semibold transition-colors"
            style={filterType === 'all'
              ? { background: 'var(--c-primary)', color: '#fff' }
              : { background: 'rgba(255,255,255,0.1)', color: 'rgba(255,255,255,0.6)' }
            }
          >
            Tout
          </button>
          {EVENT_TYPES.map(t => (
            <button
              key={t.value}
              onClick={() => setFilterType(t.value)}
              className="shrink-0 rounded-full px-3 py-1.5 text-xs font-semibold transition-colors"
              style={filterType === t.value
                ? { background: 'var(--c-primary)', color: '#fff' }
                : { background: 'rgba(255,255,255,0.1)', color: 'rgba(255,255,255,0.6)' }
              }
            >
              {t.icon} {t.label}
            </button>
          ))}
        </div>
      </div>

      {/* État vide */}
      {filtered.length === 0 && (
        <div className="mx-4 mt-8 rounded-2xl bg-white shadow-sm p-8 text-center">
          <div className="text-4xl mb-3">📖</div>
          <p className="text-gray-700 font-semibold">L'histoire familiale commence ici</p>
          <p className="text-gray-400 text-sm mt-1">
            {filterType !== 'all'
              ? 'Aucun événement de ce type pour l\'instant.'
              : 'Ajoutez le premier événement marquant de votre famille.'}
          </p>
          {filterType === 'all' && (
            <button
              onClick={() => { setEditEvent(null); setShowAdd(true) }}
              className="mt-4 rounded-xl bg-primary px-6 py-2.5 text-sm font-semibold text-white active:bg-primary-dark"
            >
              Ajouter un événement
            </button>
          )}
        </div>
      )}

      {/* Timeline */}
      {filtered.length > 0 && (
        <div className="px-4 mt-6">
          <div className="relative">
            {/* Ligne verticale */}
            <div className="absolute left-5 top-0 bottom-0 w-0.5 bg-gray-200" />

            <div className="space-y-0">
              {filtered.map((event, idx) => (
                <TimelineCard
                  key={event.id}
                  event={event}
                  isFirst={idx === 0}
                  isLast={idx === filtered.length - 1}
                  isAdmin={isAdmin}
                  currentUserId={user?.memberId}
                  onEdit={() => { setEditEvent(event); setShowAdd(true) }}
                  onDelete={() => setConfirmDelete(event)}
                  onViewMember={id => navigate(`/profile/${id}`)}
                />
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Modal ajout/édition */}
      {showAdd && (
        <EventFormModal
          event={editEvent}
          onClose={() => { setShowAdd(false); setEditEvent(null) }}
          onSave={handleSave}
        />
      )}

      <ConfirmModal
        open={!!confirmDelete}
        title="Supprimer cet événement ?"
        message={`"${confirmDelete?.title}" sera définitivement supprimé.`}
        confirmLabel="Supprimer"
        onConfirm={() => handleDelete(confirmDelete.id)}
        onCancel={() => setConfirmDelete(null)}
      />
    </div>
  )
}

function TimelineCard({ event, isAdmin, currentUserId, onEdit, onDelete, onViewMember }) {
  const [expanded, setExpanded] = useState(false)
  const colors = TYPE_COLORS[event.type] ?? TYPE_COLORS.Other
  const typeInfo = EVENT_TYPES.find(t => t.value === event.type)
  const canEdit = isAdmin || event.createdById === currentUserId

  return (
    <div className="flex gap-4 pb-6">
      {/* Point sur la timeline */}
      <div className="flex flex-col items-center shrink-0" style={{ width: 40 }}>
        <div className={`h-10 w-10 rounded-full ${colors.bg} border-2 ${colors.border} flex items-center justify-center text-lg z-10 relative bg-white`}>
          {typeInfo?.icon}
        </div>
      </div>

      {/* Carte */}
      <div className={`flex-1 rounded-2xl ${colors.bg} border ${colors.border} overflow-hidden`}>
        {/* Photo */}
        {event.photoUrl && (
          <img
            src={event.photoUrl}
            alt={event.title}
            className="w-full h-40 object-cover"
          />
        )}

        <div className="p-4">
          {/* Date + type */}
          <div className="flex items-center gap-2 mb-1">
            <span className={`text-xs font-semibold ${colors.text}`}>{typeInfo?.label}</span>
            <span className="text-gray-300">·</span>
            <span className="text-xs text-gray-500">{formatDate(event)}</span>
            {event.familyName && (
              <>
                <span className="text-gray-300">·</span>
                <span className="text-xs text-gray-500">{event.familyName}</span>
              </>
            )}
          </div>

          {/* Titre */}
          <h3 className="font-semibold text-gray-900 text-sm leading-snug">{event.title}</h3>

          {/* Description */}
          {event.description && (
            <p className={`text-xs text-gray-500 mt-1.5 leading-relaxed ${!expanded && 'line-clamp-2'}`}>
              {event.description}
            </p>
          )}
          {event.description && event.description.length > 120 && (
            <button
              onClick={() => setExpanded(e => !e)}
              className={`text-xs font-medium mt-0.5 ${colors.text}`}
            >
              {expanded ? 'Voir moins' : 'Voir plus'}
            </button>
          )}

          {/* Membres liés */}
          {event.linkedMembers?.length > 0 && (
            <div className="flex items-center gap-2 mt-3 flex-wrap">
              {event.linkedMembers.map(m => (
                <button
                  key={m.id}
                  onClick={() => onViewMember(m.id)}
                  className="flex items-center gap-1.5 rounded-full bg-white/80 px-2.5 py-1 active:opacity-70"
                >
                  <Avatar src={m.profilePictureUrl} name={m.name} size="xs" />
                  <span className="text-xs text-gray-700 font-medium">{m.name}</span>
                </button>
              ))}
            </div>
          )}

          {/* Actions */}
          {canEdit && (
            <div className="flex gap-2 mt-3 pt-3 border-t border-white/60">
              <button
                onClick={onEdit}
                className="text-xs font-medium text-gray-500 active:text-gray-700"
              >
                Modifier
              </button>
              <span className="text-gray-300">·</span>
              <button
                onClick={onDelete}
                className="text-xs font-medium text-red-400 active:text-red-600"
              >
                Supprimer
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

function EventFormModal({ event, onClose, onSave }) {
  const [title, setTitle]         = useState(event?.title ?? '')
  const [description, setDesc]    = useState(event?.description ?? '')
  const [type, setType]           = useState(event?.type ?? 'Memory')
  const [year, setYear]           = useState(event?.year ?? '')
  const [exactDate, setExactDate] = useState(
    event?.exactDate ? new Date(event.exactDate).toISOString().split('T')[0] : ''
  )
  const [dateMode, setDateMode]   = useState(event?.exactDate ? 'date' : 'year')
  const [familyId, setFamilyId]   = useState(event?.familyId ?? '')
  const [linkedIds, setLinkedIds] = useState(event?.linkedMembers?.map(m => m.id) ?? [])
  const [photoFile, setPhotoFile] = useState(null)
  const [photoPreview, setPhotoPreview] = useState(event?.photoUrl ?? null)
  const [saving, setSaving]       = useState(false)
  const [families, setFamilies]   = useState([])
  const [members, setMembers]     = useState([])
  const [memberSearch, setMemberSearch] = useState('')
  const fileRef = useRef(null)

  useEffect(() => {
    familiesApi.getAll().then(({ data }) => setFamilies(data)).catch(() => {})
    membersApi.getAll().then(({ data }) => setMembers(data)).catch(() => {})
  }, [])

  async function handlePhoto(e) {
    const file = e.target.files[0]
    if (!file) return
    const compressed = await imageCompression(file, { maxSizeMB: 1, maxWidthOrHeight: 1200 })
    setPhotoFile(compressed)
    setPhotoPreview(URL.createObjectURL(compressed))
  }

  async function handleSubmit(e) {
    e.preventDefault()
    if (!title.trim() || !type) return
    setSaving(true)
    try {
      const payload = {
        title: title.trim(),
        description: description.trim() || null,
        type,
        year: dateMode === 'year' && year ? parseInt(year) : null,
        exactDate: dateMode === 'date' && exactDate ? new Date(exactDate).toISOString() : null,
        familyId: familyId || null,
        linkedMemberIds: linkedIds,
      }
      await onSave(payload, photoFile)
    } finally {
      setSaving(false)
    }
  }

  const filteredMembers = members.filter(m =>
    `${m.firstName} ${m.lastName}`.toLowerCase().includes(memberSearch.toLowerCase())
  )

  function toggleMember(id) {
    setLinkedIds(prev =>
      prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]
    )
  }

  return (
    <div className="fixed inset-0 z-[60] flex flex-col justify-end">
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />
      <div className="relative bg-white rounded-t-3xl animate-slide-up max-h-[90vh] flex flex-col">

        {/* En-tête */}
        <div className="px-5 pt-5 pb-4 border-b border-gray-100 flex items-center justify-between shrink-0">
          <h2 className="text-lg font-semibold text-gray-900">
            {event ? 'Modifier l\'événement' : 'Ajouter un événement'}
          </h2>
          <button onClick={onClose} className="text-gray-400 p-1">
            <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <form onSubmit={handleSubmit} className="overflow-y-auto flex-1 px-5 py-4 space-y-5">

          {/* Type d'événement */}
          <div>
            <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Type</label>
            <div className="grid grid-cols-4 gap-2">
              {EVENT_TYPES.map(t => (
                <button
                  key={t.value}
                  type="button"
                  onClick={() => setType(t.value)}
                  className={`flex flex-col items-center gap-1 rounded-xl p-2.5 border text-center transition-colors ${
                    type === t.value
                      ? 'border-primary bg-primary/5 text-primary'
                      : 'border-gray-100 bg-gray-50 text-gray-500'
                  }`}
                >
                  <span className="text-xl">{t.icon}</span>
                  <span className="text-xs font-medium leading-tight">{t.label}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Titre */}
          <div>
            <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Titre *</label>
            <input
              value={title}
              onChange={e => setTitle(e.target.value)}
              placeholder="Ex: Mariage de Jean et Marie"
              className="w-full rounded-xl border border-gray-200 bg-gray-50 px-4 py-3 text-sm text-gray-900 focus:border-primary focus:outline-none focus:bg-white focus:ring-2 focus:ring-primary/10"
              required
            />
          </div>

          {/* Description */}
          <div>
            <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Description (optionnelle)</label>
            <textarea
              value={description}
              onChange={e => setDesc(e.target.value)}
              placeholder="Décrivez cet événement…"
              rows={3}
              className="w-full rounded-xl border border-gray-200 bg-gray-50 px-4 py-3 text-sm text-gray-900 focus:border-primary focus:outline-none focus:bg-white focus:ring-2 focus:ring-primary/10 resize-none"
            />
          </div>

          {/* Date */}
          <div>
            <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Date</label>
            <div className="flex gap-2 mb-3">
              <button
                type="button"
                onClick={() => setDateMode('year')}
                className={`flex-1 rounded-xl py-2 text-sm font-medium border transition-colors ${
                  dateMode === 'year' ? 'border-primary bg-primary/5 text-primary' : 'border-gray-100 bg-gray-50 text-gray-400'
                }`}
              >
                Année seulement
              </button>
              <button
                type="button"
                onClick={() => setDateMode('date')}
                className={`flex-1 rounded-xl py-2 text-sm font-medium border transition-colors ${
                  dateMode === 'date' ? 'border-primary bg-primary/5 text-primary' : 'border-gray-100 bg-gray-50 text-gray-400'
                }`}
              >
                Date précise
              </button>
            </div>
            {dateMode === 'year' ? (
              <input
                type="number"
                value={year}
                onChange={e => setYear(e.target.value)}
                placeholder="Ex: 1965"
                min={1800}
                max={new Date().getFullYear()}
                className="w-full rounded-xl border border-gray-200 bg-gray-50 px-4 py-3 text-sm text-gray-900 focus:border-primary focus:outline-none focus:bg-white focus:ring-2 focus:ring-primary/10"
              />
            ) : (
              <input
                type="date"
                value={exactDate}
                onChange={e => setExactDate(e.target.value)}
                className="w-full rounded-xl border border-gray-200 bg-gray-50 px-4 py-3 text-sm text-gray-900 focus:border-primary focus:outline-none focus:bg-white focus:ring-2 focus:ring-primary/10"
              />
            )}
          </div>

          {/* Famille liée */}
          {families.length > 0 && (
            <div>
              <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Famille liée (optionnelle)</label>
              <select
                value={familyId}
                onChange={e => setFamilyId(e.target.value)}
                className="w-full rounded-xl border border-gray-200 bg-gray-50 px-4 py-3 text-sm text-gray-900 focus:border-primary focus:outline-none focus:bg-white focus:ring-2 focus:ring-primary/10"
              >
                <option value="">— Aucune famille —</option>
                {families.map(f => (
                  <option key={f.id} value={f.id}>{f.name}</option>
                ))}
              </select>
            </div>
          )}

          {/* Personnes liées */}
          <div>
            <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">
              Personnes liées ({linkedIds.length})
            </label>
            <input
              value={memberSearch}
              onChange={e => setMemberSearch(e.target.value)}
              placeholder="Rechercher un membre…"
              className="w-full rounded-xl border border-gray-200 bg-gray-50 px-4 py-2.5 text-sm mb-2 focus:border-primary focus:outline-none focus:bg-white focus:ring-2 focus:ring-primary/10"
            />
            <div className="max-h-36 overflow-y-auto rounded-xl border border-gray-100 divide-y divide-gray-50">
              {filteredMembers.slice(0, 30).map(m => (
                <button
                  key={m.id}
                  type="button"
                  onClick={() => toggleMember(m.id)}
                  className="flex items-center gap-3 w-full px-3 py-2.5 active:bg-gray-50"
                >
                  <Avatar src={m.profilePictureUrl} name={`${m.firstName} ${m.lastName}`} size="sm" />
                  <span className="flex-1 text-left text-sm text-gray-700">{m.firstName} {m.lastName}</span>
                  {linkedIds.includes(m.id) && (
                    <svg className="h-4 w-4 text-primary shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                    </svg>
                  )}
                </button>
              ))}
            </div>
          </div>

          {/* Photo */}
          <div>
            <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Photo (optionnelle)</label>
            {photoPreview ? (
              <div className="relative rounded-xl overflow-hidden">
                <img src={photoPreview} alt="Aperçu" className="w-full h-40 object-cover" />
                <button
                  type="button"
                  onClick={() => { setPhotoFile(null); setPhotoPreview(null) }}
                  className="absolute top-2 right-2 h-8 w-8 rounded-full bg-black/50 text-white flex items-center justify-center"
                >
                  <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => fileRef.current?.click()}
                className="w-full h-24 rounded-xl border-2 border-dashed border-gray-200 flex flex-col items-center justify-center gap-1 text-gray-400 active:bg-gray-50"
              >
                <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                </svg>
                <span className="text-xs">Ajouter une photo</span>
              </button>
            )}
            <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={handlePhoto} />
          </div>

          {/* Bouton submit */}
          <button
            type="submit"
            disabled={saving || !title.trim()}
            className="w-full rounded-xl bg-primary py-3.5 font-semibold text-white disabled:opacity-50 active:bg-primary-dark"
          >
            {saving ? 'Enregistrement…' : event ? 'Enregistrer' : 'Ajouter l\'événement'}
          </button>
        </form>
      </div>
    </div>
  )
}
