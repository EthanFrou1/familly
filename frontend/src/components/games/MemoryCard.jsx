export default function MemoryCard({ card, isFlipped, isMatched, matchedRingClass, onClick, disabled }) {
  const revealed = isFlipped || isMatched

  return (
    <button
      onClick={onClick}
      disabled={disabled || revealed}
      className="relative w-full h-full active:scale-95 transition-transform"
    >
      {/* Dos de la carte */}
      <div
        className="absolute inset-0 rounded-xl overflow-hidden shadow-sm bg-primary flex items-center justify-center transition-all duration-300"
        style={{ opacity: revealed ? 0 : 1, transform: revealed ? 'scale(0.85)' : 'scale(1)' }}
      >
        <img src="/icons/icon-192x192.png" alt="" className="h-1/4 w-1/4 object-contain rounded-lg" />
      </div>

      {/* Photo du membre */}
      <div
        className={`absolute inset-0 rounded-xl overflow-hidden shadow-sm transition-all duration-300 ${isMatched ? `ring-2 ${matchedRingClass}` : ''}`}
        style={{ opacity: revealed ? (isMatched ? 0.7 : 1) : 0, transform: revealed ? 'scale(1)' : 'scale(0.85)' }}
      >
        <img src={card.photoUrl} alt={card.name} className="h-full w-full object-cover" />
      </div>
    </button>
  )
}
