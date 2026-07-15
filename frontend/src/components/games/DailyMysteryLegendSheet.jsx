import { createPortal } from 'react-dom'
import { ATTRIBUTE_COLUMNS } from '../../utils/dailyMystery'

export default function DailyMysteryLegendSheet({ showBranchColumn, onClose }) {
  const columns = ATTRIBUTE_COLUMNS.filter(c => c.key !== 'branch' || showBranchColumn)

  return createPortal(
    <div className="fixed inset-0 z-50 flex items-end" onClick={onClose}>
      <div className="absolute inset-0 bg-black/40" />
      <div
        className="relative w-full bg-white rounded-t-3xl px-5 pt-3 pb-8 max-h-[80vh] overflow-y-auto animate-slide-up"
        onClick={e => e.stopPropagation()}
      >
        <div className="w-10 h-1 bg-gray-200 rounded-full mx-auto mb-5" />
        <h2 className="text-lg font-bold text-gray-900 mb-0.5">Comment lire la grille ?</h2>
        <p className="text-sm text-gray-400 mb-5">Chaque colonne compare le membre proposé à la réponse.</p>

        <div className="space-y-3 mb-5">
          {columns.map(c => (
            <div key={c.key} className="flex items-start gap-3">
              <span className="text-xl shrink-0">{c.emoji}</span>
              <div className="min-w-0">
                <p className="text-sm font-semibold text-gray-900">{c.label}</p>
                <p className="text-xs text-gray-500 mt-0.5">{c.description}</p>
              </div>
            </div>
          ))}
        </div>

        <div className="rounded-2xl bg-gray-50 p-4 space-y-2.5">
          <LegendRow color="bg-green-500" label="Trouvé / identique à la réponse" />
          <LegendRow color="bg-yellow-400" label="Proche (génération voisine ou même pays)" />
          <LegendRow color="bg-gray-200" label="Différent" />
          <p className="text-xs text-gray-500 pt-1">
            ↑ / ↓ indiquent si la réponse est plus jeune/récente ou plus âgée/ancienne que le membre proposé.
          </p>
        </div>

        <button onClick={onClose} className="w-full mt-5 py-3.5 rounded-2xl bg-gray-100 text-sm font-semibold text-gray-600 active:bg-gray-200">
          Fermer
        </button>
      </div>
    </div>,
    document.body
  )
}

function LegendRow({ color, label }) {
  return (
    <div className="flex items-center gap-2.5">
      <span className={`h-5 w-5 rounded-md shrink-0 ${color}`} />
      <span className="text-xs text-gray-600">{label}</span>
    </div>
  )
}
