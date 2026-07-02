export default function QuizRoundScreen({ prompt, correctKey, options, selectedKey, onAnswer, disabled, timeLeft, timeLimit }) {
  const revealed = selectedKey != null

  function optionClass(option) {
    if (!revealed) return 'bg-white shadow-sm active:opacity-70'
    if (option.key === correctKey) return 'bg-primary text-white shadow-md shadow-primary/30'
    if (option.key === selectedKey) return 'bg-red-50 text-red-500'
    return 'bg-white shadow-sm opacity-50'
  }

  return (
    <div className="flex-1 min-h-0 px-4 pb-safe-lg flex flex-col">
      {timeLimit != null && <AnswerTimer timeLeft={timeLeft} timeLimit={timeLimit} frozen={revealed} />}

      <div className="flex-1 min-h-0 flex items-center justify-center">{prompt}</div>

      <div className="grid grid-cols-2 gap-2.5 shrink-0 mt-6">
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

function AnswerTimer({ timeLeft, timeLimit, frozen }) {
  const pct = Math.max(0, Math.min(100, (timeLeft / timeLimit) * 100))
  const low = !frozen && timeLeft <= timeLimit * 0.3

  return (
    <div className="shrink-0 pt-2 pb-1">
      <div className="h-1.5 w-full rounded-full bg-gray-200 overflow-hidden">
        <div
          className={`h-full rounded-full ${low ? 'bg-red-500' : 'bg-primary'} ${low && !frozen ? 'animate-pulse' : ''}`}
          style={{ width: `${pct}%`, transition: frozen ? 'none' : 'width 100ms linear, background-color 200ms' }}
        />
      </div>
    </div>
  )
}
