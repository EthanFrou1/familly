export default function QuizRoundScreen({ round, selectedMemberId, onAnswer, disabled }) {
  const revealed = selectedMemberId != null

  function optionClass(option) {
    if (!revealed) return 'bg-white shadow-sm active:opacity-70'
    if (option.memberId === round.targetMemberId) return 'bg-primary text-white shadow-md shadow-primary/30'
    if (option.memberId === selectedMemberId) return 'bg-red-50 text-red-500'
    return 'bg-white shadow-sm opacity-50'
  }

  return (
    <div className="flex-1 min-h-0 px-4 pb-4 flex flex-col">
      <div className="flex-1 min-h-0 flex items-center justify-center">
        <div className="rounded-3xl overflow-hidden shadow-lg shadow-black/10 bg-white p-2 max-h-full aspect-square">
          <img src={round.photoUrl} alt="Qui est-ce ?" className="h-full w-full rounded-2xl object-cover" />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-2.5 shrink-0">
        {round.options.map(option => (
          <button
            key={option.memberId}
            onClick={() => onAnswer(option.memberId)}
            disabled={disabled || revealed}
            className={`rounded-2xl py-3.5 px-2 text-sm font-bold transition-colors ${optionClass(option)}`}
          >
            {option.name}
          </button>
        ))}
      </div>
    </div>
  )
}
