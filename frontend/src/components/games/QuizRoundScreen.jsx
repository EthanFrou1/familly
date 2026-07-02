export default function QuizRoundScreen({ prompt, correctKey, options, selectedKey, onAnswer, disabled }) {
  const revealed = selectedKey != null

  function optionClass(option) {
    if (!revealed) return 'bg-white shadow-sm active:opacity-70'
    if (option.key === correctKey) return 'bg-primary text-white shadow-md shadow-primary/30'
    if (option.key === selectedKey) return 'bg-red-50 text-red-500'
    return 'bg-white shadow-sm opacity-50'
  }

  return (
    <div className="flex-1 min-h-0 px-4 pb-4 flex flex-col">
      <div className="flex-1 min-h-0 flex items-center justify-center">{prompt}</div>

      <div className="grid grid-cols-2 gap-2.5 shrink-0">
        {options.map(option => (
          <button
            key={option.key}
            onClick={() => onAnswer(option.key)}
            disabled={disabled || revealed}
            className={`rounded-2xl py-3.5 px-2 text-sm font-bold transition-colors ${optionClass(option)}`}
          >
            {option.label}
          </button>
        ))}
      </div>
    </div>
  )
}
