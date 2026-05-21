import { useEffect, useCallback, useState } from 'react'
import { createPortal } from 'react-dom'
import AlbumPickerModal from './AlbumPickerModal'
import ConfirmModal from '../shared/ConfirmModal'

export default function PhotoViewer({ photos, index, onClose, onPrev, onNext, onDelete, onDeleteRequest, onAlbumLinked, onShared }) {
  const [showAlbumPicker, setShowAlbumPicker] = useState(false)
  const [sharing, setSharing] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const photo = photos[index]

  const handleKey = useCallback((e) => {
    if (e.key === 'Escape') onClose()
    if (e.key === 'ArrowLeft') onPrev()
    if (e.key === 'ArrowRight') onNext()
  }, [onClose, onPrev, onNext])

  useEffect(() => {
    document.addEventListener('keydown', handleKey)
    return () => document.removeEventListener('keydown', handleKey)
  }, [handleKey])

  if (!photo) return null

  const date = new Date(photo.createdAt).toLocaleDateString('fr-FR', {
    day: 'numeric', month: 'long', year: 'numeric'
  })

  async function handleShare() {
    setSharing(true)
    const proxyUrl = `/api/photos/${photo.id}/download`
    try {
      let done = false
      if (typeof navigator.canShare === 'function') {
        try {
          const response = await fetch(proxyUrl, { credentials: 'include' })
          const blob = await response.blob()
          const file = new File([blob], 'photo.jpg', { type: blob.type || 'image/jpeg' })
          if (navigator.canShare({ files: [file] })) {
            await navigator.share({ files: [file] })
            onShared?.(photo.id)
            done = true
          }
        } catch (e) {
          if (e.name === 'AbortError') return
        }
      }
      if (!done) {
        const a = document.createElement('a')
        a.href = proxyUrl
        a.download = 'photo.jpg'
        a.rel = 'noopener'
        document.body.appendChild(a)
        a.click()
        document.body.removeChild(a)
        onShared?.(photo.id)
      }
    } catch (e) {
      if (e.name !== 'AbortError') console.error('Share failed', e)
    } finally {
      setSharing(false)
    }
  }

  return (
    <>
      {createPortal(
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/75" onClick={onClose}>
          <div className="relative rounded-2xl overflow-hidden w-full max-w-lg shadow-2xl flex flex-col" style={{ backgroundColor: '#2A1208', maxHeight: 'calc(100vh - 32px)' }} onClick={e => e.stopPropagation()}>
            {/* Header */}
            <div className="flex-none flex items-center justify-between px-3 bg-primary py-2 border-b border-white/10">
              {photos.length > 1 && (
                <span className="text-xs text-white/50 font-medium">{index + 1} / {photos.length}</span>
              )}
              <div className="flex items-center gap-1 ml-auto">
                {onAlbumLinked && (
                  <button
                    onClick={() => setShowAlbumPicker(true)}
                    className="h-8 w-8 flex items-center justify-center rounded-full text-white/60 hover:text-white hover:bg-white/10"
                    title="Ajouter à un album"
                  >
                    <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 12.75V12A2.25 2.25 0 014.5 9.75h15A2.25 2.25 0 0121.75 12v.75m-8.69-6.44-2.12-2.12a1.5 1.5 0 00-1.061-.44H4.5A2.25 2.25 0 002.25 6v12a2.25 2.25 0 002.25 2.25h15A2.25 2.25 0 0021.75 18V9a2.25 2.25 0 00-2.25-2.25h-5.379a1.5 1.5 0 01-1.06-.44z" />
                    </svg>
                  </button>
                )}
                <button
                  onClick={handleShare}
                  disabled={sharing}
                  className="h-8 w-8 flex items-center justify-center rounded-full text-white/60 hover:text-white hover:bg-white/10 disabled:opacity-40"
                  title="Enregistrer dans Photos"
                >
                  {sharing
                    ? <div className="h-4 w-4 animate-spin rounded-full border-2 border-white/60 border-t-transparent" />
                    : <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5m-13.5-9L12 3m0 0l4.5 4.5M12 3v13.5" />
                      </svg>
                  }
                </button>
                {(onDelete || onDeleteRequest) && (
                  <button onClick={() => onDeleteRequest ? onDeleteRequest(photo.id) : setConfirmDelete(true)} className="h-8 w-8 flex items-center justify-center rounded-full text-red-400 hover:bg-white/10">
                    <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6M9 7V4h6v3M3 7h18" />
                    </svg>
                  </button>
                )}
                <button onClick={onClose} className="h-8 w-8 flex items-center justify-center rounded-full text-white/60 hover:text-white hover:bg-white/10">
                  <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
            </div>

            {/* Image */}
            <div className="relative flex-1 min-h-[200px] bg-white">
              <img src={photo.cloudinaryUrl} alt="" className="w-full h-full object-contain" />
              {index > 0 && (
                <button onClick={onPrev} className="absolute left-2 top-1/2 -translate-y-1/2 h-9 w-9 flex items-center justify-center rounded-full bg-black/50 text-white">
                  <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
                  </svg>
                </button>
              )}
              {index < photos.length - 1 && (
                <button onClick={onNext} className="absolute right-2 top-1/2 -translate-y-1/2 h-9 w-9 flex items-center justify-center rounded-full bg-black/50 text-white">
                  <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                  </svg>
                </button>
              )}
            </div>

            {/* Info panel — always visible */}
            <div className="flex-none px-4 py-3 flex flex-col gap-2 bg-primary">
              {photo.uploaderName && (
                <div className="flex items-center gap-2 text-xs text-white/70">
                  <svg className="h-3.5 w-3.5 shrink-0 text-white/40" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2" /><circle cx="12" cy="7" r="4" />
                  </svg>
                  <span>{photo.uploaderName}</span>
                </div>
              )}
              <div className="flex items-center gap-2 text-xs text-white/50">
                <svg className="h-3.5 w-3.5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <rect x="3" y="4" width="18" height="18" rx="2" /><line x1="16" y1="2" x2="16" y2="6" /><line x1="8" y1="2" x2="8" y2="6" /><line x1="3" y1="10" x2="21" y2="10" />
                </svg>
                <span>{date}</span>
              </div>
              {photo.expiresAt && (
                <div className="flex items-center gap-2 text-xs text-amber-400">
                  <svg className="h-3.5 w-3.5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <circle cx="12" cy="12" r="10" /><path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6l4 2" />
                  </svg>
                  <span>Éphémère · expire le {new Date(photo.expiresAt).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long' })}</span>
                </div>
              )}
            </div>
          </div>
        </div>,
        document.body
      )}

      <AlbumPickerModal
        open={showAlbumPicker}
        photo={photo}
        onClose={() => setShowAlbumPicker(false)}
        onLinked={(albumId) => {
          onAlbumLinked?.(photo.id, albumId)
          setShowAlbumPicker(false)
        }}
      />

      <ConfirmModal
        open={confirmDelete}
        title="Supprimer cette photo ?"
        message="Cette action est irréversible."
        confirmLabel={deleting ? 'Suppression…' : 'Supprimer'}
        zClassName="z-[120]"
        onCancel={() => setConfirmDelete(false)}
        onConfirm={async () => {
          setDeleting(true)
          try {
            await onDelete(photo.id)
          } finally {
            setDeleting(false)
            setConfirmDelete(false)
          }
        }}
      />
    </>
  )
}
