import { createPortal } from 'react-dom'

export default function ConfirmModal({ open, title, message, confirmLabel = 'Supprimer', onConfirm, onCancel, danger = true, zClassName = 'z-[70]' }) {
  if (!open) return null

  return createPortal(
    <div className={`fixed inset-0 ${zClassName} flex items-end justify-center sm:items-center`}>
      <div className="absolute inset-0 bg-black/50" onClick={onCancel} />
      <div className="relative bg-white rounded-t-3xl animate-slide-up sm:rounded-2xl w-full sm:max-w-sm px-5 pt-6 pb-10 sm:pb-6">
        <div className="flex flex-col items-center text-center gap-4">
          <div className={`h-14 w-14 rounded-full flex items-center justify-center ${danger ? 'bg-red-50' : 'bg-amber-50'}`}>
            <svg className={`h-7 w-7 ${danger ? 'text-red-400' : 'text-amber-400'}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" />
            </svg>
          </div>

          <div>
            <h2 className="text-base font-bold text-gray-900">{title}</h2>
            {message && <p className="text-sm text-gray-500 mt-1.5 leading-relaxed">{message}</p>}
          </div>

          <div className="flex gap-3 w-full mt-1">
            <button
              type="button"
              onClick={onCancel}
              className="flex-1 rounded-xl border border-gray-200 py-3 text-sm font-semibold text-gray-700 active:bg-gray-50"
            >
              Annuler
            </button>
            <button
              type="button"
              onClick={onConfirm}
              className={`flex-1 rounded-xl py-3 text-sm font-semibold text-white active:opacity-80 ${danger ? 'bg-red-500' : 'bg-amber-500'}`}
            >
              {confirmLabel}
            </button>
          </div>
        </div>
      </div>
    </div>,
    document.body
  )
}
