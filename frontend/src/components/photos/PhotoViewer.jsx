import { useEffect, useCallback, useState } from 'react'
import { createPortal } from 'react-dom'

export default function PhotoViewer({ photos, index, onClose, onPrev, onNext, onDelete }) {
  const [showInfo, setShowInfo] = useState(false)
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

  useEffect(() => { setShowInfo(false) }, [index])

  if (!photo) return null

  const date = new Date(photo.createdAt).toLocaleDateString('fr-FR', {
    day: 'numeric', month: 'long', year: 'numeric'
  })

  return createPortal(
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/70" onClick={onClose}>
      <div
        className="relative bg-black rounded-2xl overflow-hidden w-full max-w-lg shadow-2xl"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-3 py-2 bg-black/80">
          {photos.length > 1 && (
            <span className="text-xs text-white/60 font-medium">{index + 1} / {photos.length}</span>
          )}
          <div className="flex items-center gap-1 ml-auto">
            <button
              onClick={() => setShowInfo(v => !v)}
              className={`h-8 w-8 flex items-center justify-center rounded-full transition-colors ${showInfo ? 'bg-white/20 text-white' : 'text-white/60 hover:text-white'}`}
            >
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <circle cx="12" cy="12" r="10" /><path strokeLinecap="round" strokeLinejoin="round" d="M12 16v-4M12 8h.01" />
              </svg>
            </button>
            {onDelete && (
              <button
                onClick={() => onDelete(photo.id)}
                className="h-8 w-8 flex items-center justify-center rounded-full text-red-400 hover:bg-white/10"
              >
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
        <div className="relative bg-gray-900">
          <img src={photo.cloudinaryUrl} alt="" className="w-full max-h-[60vh] object-contain" />

          {index > 0 && (
            <button
              onClick={onPrev}
              className="absolute left-2 top-1/2 -translate-y-1/2 h-9 w-9 flex items-center justify-center rounded-full bg-black/50 text-white"
            >
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
              </svg>
            </button>
          )}
          {index < photos.length - 1 && (
            <button
              onClick={onNext}
              className="absolute right-2 top-1/2 -translate-y-1/2 h-9 w-9 flex items-center justify-center rounded-full bg-black/50 text-white"
            >
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
              </svg>
            </button>
          )}
        </div>

        {/* Info panel */}
        {showInfo && (
          <div className="bg-gray-900 px-4 py-3 flex flex-col gap-1.5">
            <div className="flex items-center gap-2 text-xs text-gray-400">
              <svg className="h-3.5 w-3.5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <rect x="3" y="4" width="18" height="18" rx="2" /><line x1="16" y1="2" x2="16" y2="6" /><line x1="8" y1="2" x2="8" y2="6" /><line x1="3" y1="10" x2="21" y2="10" />
              </svg>
              <span>{date}</span>
            </div>
            <div className="flex items-center gap-2 text-xs text-gray-400">
              <svg className="h-3.5 w-3.5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101" /><path strokeLinecap="round" strokeLinejoin="round" d="M14.828 14.828a4 4 0 015.656 0l4 4a4 4 0 01-5.656 5.656l-1.1-1.1" />
              </svg>
              <span className="truncate text-gray-500">{photo.cloudinaryUrl.split('/').pop()}</span>
            </div>
            {photo.expiresAt && (
              <div className="flex items-center gap-2 text-xs text-amber-400">
                <svg className="h-3.5 w-3.5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <circle cx="12" cy="12" r="10" /><path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6l4 2" />
                </svg>
                <span>Expire le {new Date(photo.expiresAt).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long' })}</span>
              </div>
            )}
          </div>
        )}
      </div>
    </div>,
    document.body
  )
}
