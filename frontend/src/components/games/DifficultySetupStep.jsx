import { DIFFICULTY_PRESETS } from '../../utils/memoryGame'

export default function DifficultySetupStep({ photoCount, onStart, presets = DIFFICULTY_PRESETS, unitLabel = 'paires', sectionLabel = 'Difficulté' }) {
  return (
    <div className="px-4 mt-5">
      <h2 className="text-xs font-bold text-gray-400 uppercase tracking-wide mb-2.5">{sectionLabel}</h2>
      <div className="flex gap-2.5">
        {presets.map(preset => {
          const disabled = photoCount < (preset.minRequired ?? preset.value)
          return (
            <button
              key={preset.value}
              disabled={disabled}
              onClick={() => onStart(preset.value)}
              className="flex-1 rounded-2xl bg-white shadow-sm p-4 text-center disabled:opacity-40 active:opacity-70"
            >
              <div className="text-2xl">{preset.emoji}</div>
              <p className="mt-1.5 font-extrabold text-sm text-gray-800">{preset.label}</p>
              <p className="mt-0.5 text-[11px] font-bold text-gray-400">{preset.value} {unitLabel}</p>
            </button>
          )
        })}
      </div>
    </div>
  )
}
