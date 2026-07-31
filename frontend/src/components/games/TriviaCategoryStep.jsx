import { CATEGORIES } from '../../utils/familyTriviaGame'

export default function TriviaCategoryStep({ selected, onToggle, onContinue }) {
  return (
    <div className="px-4 mt-5">
      <h2 className="text-xs font-bold text-gray-400 uppercase tracking-wide mb-2.5">Catégories de questions</h2>
      <p className="text-xs text-gray-400 mb-3">
        Le numéro de téléphone est une donnée sensible : désactivez-le si besoin.
      </p>

      <div className="space-y-2 mb-6">
        {CATEGORIES.map(category => {
          const active = selected.includes(category.key)
          return (
            <button
              key={category.key}
              onClick={() => onToggle(category.key)}
              className={`w-full flex items-center gap-3 rounded-2xl px-4 py-3 text-left transition-colors ${
                active ? 'bg-primary/10 ring-2 ring-primary' : 'bg-white shadow-sm'
              }`}
            >
              <span className="text-xl shrink-0">{category.emoji}</span>
              <span className={`flex-1 text-sm font-semibold ${active ? 'text-primary' : 'text-gray-700'}`}>
                {category.label}
              </span>
              <span
                className={`h-5 w-5 shrink-0 rounded-full flex items-center justify-center ${
                  active ? 'bg-primary text-white' : 'bg-gray-100'
                }`}
              >
                {active && (
                  <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                  </svg>
                )}
              </span>
            </button>
          )
        })}
      </div>

      <button
        onClick={onContinue}
        disabled={selected.length === 0}
        className="w-full rounded-xl bg-primary py-3.5 text-sm font-semibold text-white active:bg-primary-dark disabled:opacity-40"
      >
        Continuer
      </button>
    </div>
  )
}
