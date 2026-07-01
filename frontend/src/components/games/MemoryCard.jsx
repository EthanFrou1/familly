export default function MemoryCard({ card, isFlipped, isMatched, matchedRingClass, onClick, disabled }) {
  const revealed = isFlipped || isMatched

  return (
    <button
      onClick={onClick}
      disabled={disabled || revealed}
      className="w-full h-full active:scale-95 transition-transform"
      style={{ perspective: 800 }}
    >
      <div
        className={`relative w-full h-full transition-all duration-500 ${isMatched ? 'opacity-70' : ''}`}
        style={{ transformStyle: 'preserve-3d', transform: revealed ? 'rotateY(180deg)' : 'rotateY(0deg)' }}
      >
        {/* Dos de la carte */}
        <div
          className="absolute inset-0 rounded-xl overflow-hidden shadow-sm bg-primary flex items-center justify-center text-white text-2xl"
          style={{ backfaceVisibility: 'hidden' }}
        >
          🌳
        </div>

        {/* Photo du membre */}
        <div
          className={`absolute inset-0 rounded-xl overflow-hidden shadow-sm ${isMatched ? `ring-2 ${matchedRingClass}` : ''}`}
          style={{ backfaceVisibility: 'hidden', transform: 'rotateY(180deg)' }}
        >
          <img src={card.photoUrl} alt={card.name} className="h-full w-full object-cover" />
        </div>
      </div>
    </button>
  )
}
