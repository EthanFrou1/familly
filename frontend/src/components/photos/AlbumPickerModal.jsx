import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { albumsApi, photosApi } from '../../services/api'

export default function AlbumPickerModal({ open, photo, onClose, onLinked }) {
  const [albums, setAlbums] = useState([])
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(null)

  useEffect(() => {
    if (!open) return
    setLoading(true)
    albumsApi.getAll().then(({ data }) => setAlbums(data)).finally(() => setLoading(false))
  }, [open])

  async function handlePick(albumId) {
    setSaving(albumId)
    try {
      await photosApi.setAlbum(photo.id, albumId)
      onLinked(albumId)
      onClose()
    } finally {
      setSaving(null)
    }
  }

  async function handleRemove() {
    setSaving('none')
    try {
      await photosApi.setAlbum(photo.id, null)
      onLinked(null)
      onClose()
    } finally {
      setSaving(null)
    }
  }

  if (!open) return null

  return createPortal(
    <div className="fixed inset-0 z-[110] flex items-end justify-center sm:items-center">
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />
      <div className="relative bg-white rounded-t-3xl sm:rounded-2xl w-full sm:max-w-md pb-10 sm:pb-0 animate-slide-up">
        <div className="flex items-center justify-between px-5 pt-5 pb-3 border-b border-gray-100">
          <h2 className="text-base font-bold text-gray-900">Ajouter à un album</h2>
          <button onClick={onClose} className="h-8 w-8 flex items-center justify-center rounded-full text-gray-400 hover:bg-gray-100">
            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="max-h-72 overflow-y-auto">
          {loading ? (
            <div className="flex h-24 items-center justify-center">
              <div className="h-6 w-6 animate-spin rounded-full border-2 border-primary border-t-transparent" />
            </div>
          ) : albums.length === 0 ? (
            <p className="text-sm text-gray-400 text-center py-8">Aucun album disponible</p>
          ) : (
            <div className="py-2">
              {albums.map(album => {
                const isCurrent = photo.albumId === album.id
                const isLoading = saving === album.id
                return (
                  <button
                    key={album.id}
                    onClick={() => !isCurrent && handlePick(album.id)}
                    disabled={isLoading}
                    className={`flex items-center gap-3 w-full px-5 py-3 active:bg-gray-50 transition-colors ${isCurrent ? 'opacity-50 cursor-default' : ''}`}
                  >
                    <div className="h-10 w-10 rounded-xl bg-gray-100 overflow-hidden shrink-0">
                      {album.coverUrl
                        ? <img src={album.coverUrl} alt="" className="h-full w-full object-cover" />
                        : <div className="h-full w-full flex items-center justify-center text-gray-300">
                            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                              <path strokeLinecap="round" strokeLinejoin="round" d="m2.25 15.75 5.159-5.159a2.25 2.25 0 0 1 3.182 0l5.159 5.159" />
                            </svg>
                          </div>
                      }
                    </div>
                    <div className="text-left flex-1 min-w-0">
                      <p className="text-sm font-medium text-gray-900 truncate">{album.name}</p>
                      <p className="text-xs text-gray-400">{album.photoCount} photo{album.photoCount !== 1 ? 's' : ''}</p>
                    </div>
                    {isCurrent && <span className="text-xs text-primary font-semibold shrink-0">Déjà ajouté</span>}
                    {isLoading && <div className="h-4 w-4 animate-spin rounded-full border-2 border-primary border-t-transparent shrink-0" />}
                    {!isCurrent && !isLoading && (
                      <svg className="h-4 w-4 text-gray-300 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                      </svg>
                    )}
                  </button>
                )
              })}
            </div>
          )}
        </div>

        {photo.albumId && (
          <div className="border-t border-gray-100 px-5 py-3">
            <button onClick={handleRemove} disabled={saving === 'none'}
              className="w-full text-sm text-red-500 font-medium py-2 active:opacity-70 disabled:opacity-50">
              {saving === 'none' ? 'Retrait…' : 'Retirer de l\'album'}
            </button>
          </div>
        )}
      </div>
    </div>,
    document.body
  )
}
