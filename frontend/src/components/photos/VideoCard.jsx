import { useContext, useState } from 'react'
import { AuthContext } from '../../store/AuthContext'
import { externalMediaApi } from '../../services/api'
import ConfirmModal from '../shared/ConfirmModal'

export default function VideoCard({ video, onDelete }) {
  const { user } = useContext(AuthContext)
  const [confirmOpen, setConfirmOpen] = useState(false)
  const [deleting, setDeleting] = useState(false)

  const canDelete = user && (user.role === 'Admin' || user.memberId === video.uploaderId)

  async function handleDelete() {
    setDeleting(true)
    try {
      await externalMediaApi.delete(video.id)
      onDelete?.(video.id)
    } finally {
      setDeleting(false)
      setConfirmOpen(false)
    }
  }

  const date = new Date(video.createdAt).toLocaleDateString('fr-FR', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  })

  return (
    <>
      <div className="relative rounded-2xl overflow-hidden border border-gray-100 bg-white shadow-sm">
        <a
          href={video.externalUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="block active:opacity-80"
        >
          <div className="relative aspect-video bg-gray-900 flex items-center justify-center">
            <svg className="h-14 w-14 text-white/80" fill="currentColor" viewBox="0 0 24 24">
              <path d="M8 5v14l11-7z" />
            </svg>
            <span className="absolute top-2 left-2 rounded-full bg-black/60 px-2 py-0.5 text-[10px] font-semibold text-white">
              Vidéo
            </span>
            <span className="absolute top-2 right-2 rounded-full bg-white/90 px-2 py-0.5 text-[10px] font-semibold text-gray-700">
              Google Photos
            </span>
          </div>

          <div className="px-3 py-2.5">
            {video.title ? (
              <p className="text-sm font-semibold text-gray-900 truncate">{video.title}</p>
            ) : (
              <p className="text-sm font-semibold text-gray-400 italic">Sans titre</p>
            )}
            <div className="flex items-center gap-1.5 mt-0.5">
              {video.uploaderName && (
                <span className="text-xs text-gray-500 truncate">{video.uploaderName}</span>
              )}
              {video.uploaderName && <span className="text-gray-300">·</span>}
              <span className="text-xs text-gray-400 shrink-0">{date}</span>
            </div>
          </div>
        </a>

        {canDelete && (
          <button
            onClick={() => setConfirmOpen(true)}
            disabled={deleting}
            className="absolute bottom-3 right-3 h-7 w-7 flex items-center justify-center rounded-full bg-white/90 shadow text-gray-400 hover:text-red-500 active:bg-red-50 disabled:opacity-50"
          >
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6M9 7V4h6v3M3 7h18" />
            </svg>
          </button>
        )}
      </div>

      <ConfirmModal
        open={confirmOpen}
        title="Supprimer la vidéo ?"
        message="Ce lien sera supprimé définitivement. La vidéo reste accessible sur Google Photos."
        confirmLabel="Supprimer"
        onConfirm={handleDelete}
        onCancel={() => setConfirmOpen(false)}
      />
    </>
  )
}
