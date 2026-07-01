import { DIFFICULTY_PRESETS } from '../../utils/memoryGame'

export default function DifficultySetupStep({ photoCount, onBack, onStart }) {
  return (
    <div className="px-4 mt-5 space-y-3">
      <h2 className="text-sm font-semibold text-gray-500 mb-1">Difficulté</h2>
      {DIFFICULTY_PRESETS.map(preset => {
        const disabled = photoCount < preset.pairsCount
        return (
          <button
            key={preset.pairsCount}
            disabled={disabled}
            onClick={() => onStart(preset.pairsCount)}
            className="w-full rounded-2xl bg-white shadow-sm p-4 flex items-center justify-between disabled:opacity-40"
          >
            <div className="text-left">
              <p className="font-semibold text-gray-800">{preset.label}</p>
              <p className="text-xs text-gray-400">{preset.pairsCount} paires · {preset.pairsCount * 2} cartes</p>
            </div>
            <svg className="h-4 w-4 text-gray-300" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
            </svg>
          </button>
        )
      })}
      <button onClick={onBack} className="w-full rounded-xl border border-gray-200 py-3 text-sm font-semibold text-gray-500">
        Retour
      </button>
    </div>
  )
}
