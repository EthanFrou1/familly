import { createPortal } from 'react-dom'

export default function PhotoDeleteModal({ open, loading, onClose, onRemoveFromAlbum, onDeletePermanently, count = 1 }) {
  if (!open) return null
  const label = count > 1 ? `ces ${count} photos` : 'cette photo'
  return createPortal(
    <div className="fixed inset-0 z-[120] flex items-end justify-center sm:items-center">
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />
      <div className="relative bg-white rounded-t-3xl sm:rounded-2xl w-full sm:max-w-sm animate-slide-up">
        <div className="px-5 pt-6 pb-3 text-center border-b border-gray-100">
          <h2 className="text-base font-bold text-gray-900">Que faire de {label} ?</h2>
        </div>
        <div className="px-5 pt-4 pb-8 flex flex-col gap-3">
          <button
            onClick={onRemoveFromAlbum}
            disabled={loading}
            className="w-full rounded-xl bg-gray-100 py-3 text-sm font-semibold text-gray-800 active:bg-gray-200 disabled:opacity-50"
          >
            Retirer de l'album uniquement
          </button>
          <button
            onClick={onDeletePermanently}
            disabled={loading}
            className="w-full rounded-xl bg-red-500 py-3 text-sm font-semibold text-white active:opacity-80 disabled:opacity-50"
          >
            Supprimer définitivement
          </button>
          <button
            onClick={onClose}
            disabled={loading}
            className="w-full py-2 text-sm text-gray-400 active:text-gray-600"
          >
            Annuler
          </button>
        </div>
      </div>
    </div>,
    document.body
  )
}
