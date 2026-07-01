import MemoryCard from './MemoryCard'

const GRID_COLS = { 6: 'grid-cols-3', 8: 'grid-cols-4', 12: 'grid-cols-4' }

export default function MemoryBoard({ deck, flippedIds, matchedMemberIds, onCardClick, disabled }) {
  return (
    <div className={`grid ${GRID_COLS[deck.length / 2] ?? 'grid-cols-4'} gap-2`}>
      {deck.map(card => (
        <MemoryCard
          key={card.cardId}
          card={card}
          isFlipped={flippedIds.includes(card.cardId)}
          isMatched={matchedMemberIds.has(card.memberId)}
          onClick={() => onCardClick(card)}
          disabled={disabled}
        />
      ))}
    </div>
  )
}
