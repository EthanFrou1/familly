export default function MemoryCard({ card, isFlipped, isMatched, onClick, disabled }) {
  const revealed = isFlipped || isMatched

  return (
    <button
      onClick={onClick}
      disabled={disabled || revealed}
      className={`aspect-square rounded-xl overflow-hidden shadow-sm transition-transform active:scale-95 ${isMatched ? 'ring-2 ring-primary opacity-70' : ''}`}
    >
      {revealed ? (
        <img src={card.photoUrl} alt={card.name} className="h-full w-full object-cover" />
      ) : (
        <div className="h-full w-full bg-primary flex items-center justify-center text-white text-2xl">
          🌳
        </div>
      )}
    </button>
  )
}
