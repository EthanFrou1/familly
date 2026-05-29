import { useEffect, useState, useRef, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import imageCompression from 'browser-image-compression'
import { timelineApi, membersApi, relationsApi } from '../services/api'
import { useAuth } from '../hooks/useAuth'
import { useMembers } from '../store/MembersContext'
import Avatar from '../components/shared/Avatar'
import Select from '../components/shared/Select'
import ConfirmModal from '../components/shared/ConfirmModal'

// Seul type créable manuellement
const MANUAL_TYPE = { value: 'Marriage', label: 'Mariage', icon: '💍' }

// Filtres affichés
const FILTER_TYPES = [
  { value: 'Marriage', label: 'Mariage', icon: '💍' },
]

const TYPE_COLORS = {
  Birth:          { bg: 'bg-green-50',  border: 'border-green-200',  text: 'text-green-700'  },
  Marriage:       { bg: 'bg-pink-50',   border: 'border-pink-200',   text: 'text-pink-700'   },
  Death:          { bg: 'bg-gray-50',   border: 'border-gray-200',   text: 'text-gray-600'   },
  Move:           { bg: 'bg-blue-50',   border: 'border-blue-200',   text: 'text-blue-700'   },
  FamilyCreation: { bg: 'bg-violet-50', border: 'border-violet-200', text: 'text-violet-700' },
  Memory:         { bg: 'bg-amber-50',  border: 'border-amber-200',  text: 'text-amber-700'  },
  Other:          { bg: 'bg-gray-50',   border: 'border-gray-200',   text: 'text-gray-600'   },
}

const ALL_TYPE_LABELS = {
  Birth: '👶 Naissance', Marriage: '💍 Mariage', Death: '🕯️ Décès',
  Move: '🏠 Déménagement', FamilyCreation: '👨‍👩‍👧‍👦 Famille', Memory: '📸 Souvenir', Other: '📌 Événement',
}

function getEventDate(event) {
  return event.exactDate ? new Date(event.exactDate) : (event.year ? new Date(event.year, 0, 1) : null)
}

function formatDate(event) {
  if (event.exactDate) {
    return new Date(event.exactDate).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' })
  }
  if (event.year) return String(event.year)
  return 'Date inconnue'
}

export default function Timeline() {
  const { user } = useAuth()
  const navigate = useNavigate()
  const isAdmin = user?.role === 'Admin'
  const { members } = useMembers()

  const [events, setEvents] = useState([])
  const [loading, setLoading] = useState(true)
  const [showAdd, setShowAdd] = useState(false)
  const [editEvent, setEditEvent] = useState(null)
  const [confirmDelete, setConfirmDelete] = useState(null)
  const [filterType, setFilterType] = useState('all')
  const [sortOrder, setSortOrder] = useState('desc') // 'desc' = plus récent, 'asc' = plus ancien
  const [filterYear, setFilterYear] = useState('')

  useEffect(() => {
    timelineApi.getAll()
      .then(({ data }) => setEvents(data))
      .finally(() => setLoading(false))
  }, [])

  // Événements auto depuis les membres (naissances + décès)
  const autoEvents = useMemo(() => {
    const list = []
    for (const m of members) {
      if (m.birthDate) {
        list.push({
          _auto: true,
          id: `auto-birth-${m.id}`,
          type: 'Birth', typeLabel: 'Naissance', typeIcon: '👶',
          title: `Naissance de ${m.firstName} ${m.lastName}`,
          description: null, exactDate: m.birthDate, year: null,
          photoUrl: null, familyId: m.familyId ?? null, familyName: null,
          linkedMembers: [{ id: m.id, name: `${m.firstName} ${m.lastName}`, profilePictureUrl: m.profilePictureUrl }],
          createdById: null, createdByName: '',
        })
      }
      if (!m.isAlive && m.deathDate) {
        list.push({
          _auto: true,
          id: `auto-death-${m.id}`,
          type: 'Death', typeLabel: 'Décès', typeIcon: '🕯️',
          title: `Décès de ${m.firstName} ${m.lastName}`,
          description: null, exactDate: m.deathDate, year: null,
          photoUrl: null, familyId: m.familyId ?? null, familyName: null,
          linkedMembers: [{ id: m.id, name: `${m.firstName} ${m.lastName}`, profilePictureUrl: m.profilePictureUrl }],
          createdById: null, createdByName: '',
        })
      }
    }
    return list
  }, [members])

  const allEvents = useMemo(() => {
    return [...events, ...autoEvents].sort((a, b) => {
      const da = getEventDate(a)?.getTime() ?? 0
      const db = getEventDate(b)?.getTime() ?? 0
      return sortOrder === 'desc' ? db - da : da - db
    })
  }, [events, autoEvents, sortOrder])

  // Années disponibles pour le filtre
  const availableYears = useMemo(() => {
    const years = new Set()
    for (const e of allEvents) {
      const d = getEventDate(e)
      if (d) years.add(d.getFullYear())
    }
    return [...years].sort((a, b) => b - a)
  }, [allEvents])

  const filtered = useMemo(() => {
    let list = filterType === 'all' ? allEvents : allEvents.filter(e => e.type === filterType)
    if (filterYear) list = list.filter(e => {
      const d = getEventDate(e)
      return d?.getFullYear() === parseInt(filterYear)
    })
    return list
  }, [allEvents, filterType, filterYear])

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
            <p className="text-white/70 text-sm mt-0.5">{allEvents.length} événement{allEvents.length !== 1 ? 's' : ''}</p>
          </div>
          <button
            onClick={() => { setEditEvent(null); setShowAdd(true) }}
            className="flex items-center gap-2 rounded-2xl bg-primary px-4 py-2.5 text-sm font-semibold text-white active:bg-primary-dark shrink-0"
          >
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
            </svg>
            💍 Mariage
          </button>
        </div>

        {/* Filtres sur une ligne */}
        <div className="flex gap-2 mt-1">
          <Select value={filterType} onChange={e => setFilterType(e.target.value)} placeholder="" className="min-w-[110px]">
            <option value="all">Tout</option>
            <option value="Marriage">Mariage</option>
          </Select>
          <Select value={sortOrder} onChange={e => setSortOrder(e.target.value)} placeholder="" className="min-w-[110px]">
            <option value="desc">Récent</option>
            <option value="asc">Ancien</option>
          </Select>
          <Select value={filterYear} onChange={e => setFilterYear(e.target.value)} placeholder="Année" className="min-w-[90px]">
            {availableYears.map(y => (
              <option key={y} value={y}>{y}</option>
            ))}
          </Select>
        </div>
      </div>

      {/* État vide */}
      {filtered.length === 0 && (
        <div className="mx-4 mt-8 rounded-2xl bg-white shadow-sm p-8 text-center">
          <div className="text-4xl mb-3">📖</div>
          <p className="text-gray-700 font-semibold">
            {filterType !== 'all' || filterYear ? 'Aucun événement trouvé' : 'L\'histoire familiale commence ici'}
          </p>
          <p className="text-gray-400 text-sm mt-1">
            {filterType !== 'all' || filterYear
              ? 'Essayez d\'autres filtres.'
              : 'Ajoutez le premier événement marquant de votre famille.'}
          </p>
          {!filterType || filterType === 'all' ? (
            <button
              onClick={() => { setEditEvent(null); setShowAdd(true) }}
              className="mt-4 rounded-xl bg-primary px-6 py-2.5 text-sm font-semibold text-white active:bg-primary-dark"
            >
              💍 Ajouter un mariage
            </button>
          ) : null}
        </div>
      )}

      {/* Timeline */}
      {filtered.length > 0 && (
        <div className="px-4 mt-6">
          <div className="relative">
            <div className="absolute left-5 top-0 bottom-0 w-0.5 bg-gray-200" />
            <div className="space-y-0">
              {filtered.map(event => (
                <TimelineCard
                  key={event.id}
                  event={event}
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
  const canEdit = !event._auto && (isAdmin || event.createdById === currentUserId)
  const typeLabel = event.typeLabel ?? ALL_TYPE_LABELS[event.type] ?? event.type
  const typeIcon = event.typeIcon ?? ''

  return (
    <div className="flex gap-4 pb-6">
      <div className="flex flex-col items-center shrink-0" style={{ width: 40 }}>
        <div className={`h-10 w-10 rounded-full ${colors.bg} border-2 ${colors.border} flex items-center justify-center text-lg z-10 relative`}>
          {typeIcon}
        </div>
      </div>

      <div className={`flex-1 rounded-2xl ${colors.bg} border ${colors.border} overflow-hidden`}>
        {event.photoUrl && (
          <img src={event.photoUrl} alt={event.title} className="w-full h-40 object-cover" />
        )}

        <div className="p-4">
          <div className="flex items-center gap-2 mb-1 flex-wrap">
            <span className={`text-xs font-semibold ${colors.text}`}>{typeLabel}</span>
            <span className="text-gray-300">·</span>
            <span className="text-xs text-gray-500">{formatDate(event)}</span>
            {event._auto && (
              <span className="text-xs text-gray-400 bg-white/70 rounded-full px-2 py-0.5 border border-gray-200">
                Depuis le profil
              </span>
            )}
          </div>

          <h3 className="font-semibold text-gray-900 text-sm leading-snug">{event.title}</h3>

          {event.description && (
            <p className={`text-xs text-gray-500 mt-1.5 leading-relaxed ${!expanded && 'line-clamp-2'}`}>
              {event.description}
            </p>
          )}
          {event.description && event.description.length > 120 && (
            <button onClick={() => setExpanded(e => !e)} className={`text-xs font-medium mt-0.5 ${colors.text}`}>
              {expanded ? 'Voir moins' : 'Voir plus'}
            </button>
          )}

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

          {canEdit && (
            <div className="flex gap-2 mt-3 pt-3 border-t border-white/60">
              <button onClick={onEdit} className="text-xs font-medium text-gray-500 active:text-gray-700">Modifier</button>
              <span className="text-gray-300">·</span>
              <button onClick={onDelete} className="text-xs font-medium text-red-400 active:text-red-600">Supprimer</button>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

function EventFormModal({ event, onClose, onSave }) {
  const [title, setTitle]         = useState(event?.title ?? '')
  const [year, setYear]           = useState(event?.year ?? '')
  const [exactDate, setExactDate] = useState(
    event?.exactDate ? new Date(event.exactDate).toISOString().split('T')[0] : ''
  )
  const [dateMode, setDateMode]   = useState(event?.exactDate ? 'date' : 'year')
  const [coupleKey, setCoupleKey] = useState('')  // "memberAId|memberBId"
  const [photoFile, setPhotoFile] = useState(null)
  const [photoPreview, setPhotoPreview] = useState(event?.photoUrl ?? null)
  const [saving, setSaving]       = useState(false)
  const [members, setMembers]     = useState([])
  const [relations, setRelations] = useState([])
  const fileRef = useRef(null)

  useEffect(() => {
    Promise.all([
      membersApi.getAll(),
      relationsApi.getAll(),
    ]).then(([mRes, rRes]) => {
      setMembers(mRes.data)
      setRelations(rRes.data)

      // Pré-sélectionner le couple si on est en mode édition
      if (event?.linkedMembers?.length >= 2) {
        const [a, b] = event.linkedMembers
        setCoupleKey(`${a.id}|${b.id}`)
      }
    }).catch(() => {})
  }, [])

  // Couples = relations de type Spouse
  const couples = useMemo(() => {
    const memberMap = Object.fromEntries(members.map(m => [m.id, m]))
    return relations
      .filter(r => r.type === 'Spouse')
      .map(r => {
        const a = memberMap[r.memberAId]
        const b = memberMap[r.memberBId]
        if (!a || !b) return null
        return {
          key: `${r.memberAId}|${r.memberBId}`,
          label: `${a.firstName} ${a.lastName} & ${b.firstName} ${b.lastName}`,
          memberAId: r.memberAId,
          memberBId: r.memberBId,
          firstNameA: a.firstName,
          firstNameB: b.firstName,
        }
      })
      .filter(Boolean)
  }, [members, relations])

  function handleCoupleChange(e) {
    const key = e.target.value
    setCoupleKey(key)
    // Auto-remplir le titre si vide
    const couple = couples.find(c => c.key === key)
    if (couple && !title.trim()) {
      setTitle(`Mariage de ${couple.firstNameA} & ${couple.firstNameB}`)
    }
  }

  async function handlePhoto(e) {
    const file = e.target.files[0]
    if (!file) return
    const compressed = await imageCompression(file, { maxSizeMB: 1, maxWidthOrHeight: 1200 })
    setPhotoFile(compressed)
    setPhotoPreview(URL.createObjectURL(compressed))
  }

  async function handleSubmit() {
    if (!title.trim()) return
    setSaving(true)
    try {
      const couple = couples.find(c => c.key === coupleKey)
      const linkedMemberIds = couple ? [couple.memberAId, couple.memberBId] : []
      const payload = {
        title: title.trim(),
        description: null,
        type: 'Marriage',
        year: dateMode === 'year' && year ? parseInt(year) : null,
        exactDate: dateMode === 'date' && exactDate ? new Date(exactDate).toISOString() : null,
        familyId: null,
        linkedMemberIds,
      }
      await onSave(payload, photoFile)
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 z-[60] flex flex-col justify-end">
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />
      <div className="relative bg-white rounded-t-3xl animate-slide-up max-h-[92vh] flex flex-col">

        {/* En-tête */}
        <div className="px-5 pt-5 pb-4 border-b border-gray-100 flex items-center justify-between shrink-0">
          <h2 className="text-lg font-semibold text-gray-900">
            {event ? 'Modifier le mariage' : '💍 Ajouter un mariage'}
          </h2>
          <button onClick={onClose} className="text-gray-400 p-1">
            <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Contenu scrollable */}
        <div className="overflow-y-auto flex-1 px-5 py-4 space-y-5">

          {/* Couple */}
          <div>
            <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Couple</label>
            {couples.length === 0 ? (
              <p className="text-sm text-gray-400 italic">Aucun couple défini dans l'arbre.</p>
            ) : (
              <Select
                value={coupleKey}
                onChange={handleCoupleChange}
                placeholder="— Sélectionner un couple —"
              >
                {couples.map(c => (
                  <option key={c.key} value={c.key}>{c.label}</option>
                ))}
              </Select>
            )}
          </div>

          {/* Titre */}
          <div>
            <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Titre *</label>
            <input
              value={title}
              onChange={e => setTitle(e.target.value)}
              placeholder="Ex: Mariage de Jean et Marie"
              className="w-full rounded-xl border border-gray-200 bg-gray-50 px-4 py-3 text-sm text-gray-900 focus:border-primary focus:outline-none focus:bg-white focus:ring-2 focus:ring-primary/10"
            />
          </div>

          {/* Date */}
          <div>
            <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Date</label>
            <div className="flex gap-2 mb-3">
              {['year', 'date'].map(mode => (
                <button
                  key={mode}
                  type="button"
                  onClick={() => setDateMode(mode)}
                  className={`flex-1 rounded-xl py-2 text-sm font-medium border transition-colors ${
                    dateMode === mode ? 'border-primary bg-primary/5 text-primary' : 'border-gray-100 bg-gray-50 text-gray-400'
                  }`}
                >
                  {mode === 'year' ? 'Année seulement' : 'Date précise'}
                </button>
              ))}
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

          <div className="h-2" />
        </div>

        {/* Bouton fixe en bas */}
        <div className="shrink-0 px-5 py-4 border-t border-gray-100 bg-white">
          <button
            onClick={handleSubmit}
            disabled={saving || !title.trim()}
            className="w-full rounded-xl bg-primary py-3.5 font-semibold text-white disabled:opacity-50 active:bg-primary-dark"
          >
            {saving ? (
              <span className="flex items-center justify-center gap-2">
                <div className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
                En cours…
              </span>
            ) : event ? 'Enregistrer' : 'Ajouter le mariage'}
          </button>
        </div>
      </div>
    </div>
  )
}
