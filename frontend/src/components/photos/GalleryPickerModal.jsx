import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { photosApi } from '../../services/api'

export default function GalleryPickerModal({ open, albumId, existingPhotoIds, onClose, onAdded }) {
  const [photos, setPhotos] = useState([])
  const [loading, setLoading] = useState(false)
  const [selected, setSelected] = useState(new Set())
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (!open) { setSelected(new Set()); return }
    setLoading(true)
    photosApi.getAll()
      .then(({ data }) => setPhotos(data.filter(p => !existingPhotoIds.has(p.id))))
      .finally(() => setLoading(false))
  }, [open])

  function toggleSelect(photoId) {
    setSelected(prev => {
      const next = new Set(prev)
      if (next.has(photoId)) next.delete(photoId)
      else next.add(photoId)
      return next
    })
  }

  async function handleConfirm() {
    if (selected.size === 0) return
    setSaving(true)
    try {
      await Promise.all([...selected].map(photoId => photosApi.setAlbum(photoId, albumId)))
      onAdded(photos.filter(p => selected.has(p.id)))
      onClose()
    } finally {
      setSaving(false)
    }
  }

  if (!open) return null

  return createPortal(
    <div className="fixed inset-0 z-[110] flex items-end justify-center sm:items-center">
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />
      <div className="relative bg-white rounded-t-3xl sm:rounded-2xl w-full sm:max-w-md animate-slide-up flex flex-col" style={{ maxHeight: '85vh' }}>
        <div className="flex items-center justify-between px-5 pt-5 pb-3 border-b border-gray-100 shrink-0">
          <h2 className="text-base font-bold text-gray-900">Ajouter depuis la galerie</h2>
          <button onClick={onClose} className="h-8 w-8 flex items-center justify-center rounded-full text-gray-400 hover:bg-gray-100">
            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="flex-1 overflow-y-auto">
          {loading ? (
            <div className="flex h-40 items-center justify-center">
              <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
            </div>
          ) : photos.length === 0 ? (
            <p className="text-sm text-gray-400 text-center py-10">Aucune photo disponible dans la galerie</p>
          ) : (
            <div className="grid grid-cols-3 gap-0.5 p-0.5">
              {photos.map(photo => {
                const isSelected = selected.has(photo.id)
                return (
                  <button
                    key={photo.id}
                    onClick={() => toggleSelect(photo.id)}
                    className="aspect-square relative overflow-hidden active:opacity-80"
                  >
                    <img src={photo.cloudinaryUrl} alt="" className="h-full w-full object-cover" />
                    {isSelected && (
                      <>
                        <div className="absolute inset-0 bg-primary/40" />
                        <span className="absolute top-1 right-1 h-5 w-5 rounded-full bg-primary flex items-center justify-center">
                          <svg className="h-3 w-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
                          </svg>
                        </span>
                      </>
                    )}
                  </button>
                )
              })}
            </div>
          )}
        </div>

        <div className="px-5 pt-3 pb-8 sm:pb-4 shrink-0 border-t border-gray-100">
          <button
            onClick={handleConfirm}
            disabled={selected.size === 0 || saving}
            className="w-full rounded-xl bg-primary py-2.5 text-sm font-semibold text-white disabled:opacity-40 active:opacity-80"
          >
            {saving ? 'Ajout en cours…' : selected.size > 0 ? `Ajouter ${selected.size} photo${selected.size > 1 ? 's' : ''}` : 'Sélectionner des photos'}
          </button>
        </div>
      </div>
    </div>,
    document.body
  )
}
