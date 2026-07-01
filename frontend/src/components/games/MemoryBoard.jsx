import MemoryCard from './MemoryCard'
import { PLAYER_COLORS } from '../../utils/memoryGame'

const GRID_COLS = { 6: 3, 8: 4, 12: 4 }
const MIN_CARD_SIZE = 56 // px — plancher pour garder les cartes lisibles
const MAX_BOARD_WIDTH = 420 // px — plafond pour ne pas grossir sur tablette

export default function MemoryBoard({ deck, flippedIds, matchedBy, onCardClick, disabled }) {
  const cols = GRID_COLS[deck.length / 2] ?? 4
  const rows = Math.ceil(deck.length / cols)

  return (
    <div
      className="grid gap-2"
      style={{
        gridTemplateColumns: `repeat(${cols}, 1fr)`,
        gridTemplateRows: `repeat(${rows}, 1fr)`,
        aspectRatio: `${cols} / ${rows}`,
        maxWidth: MAX_BOARD_WIDTH,
        maxHeight: '100%',
        minWidth: cols * MIN_CARD_SIZE,
      }}
    >
      {deck.map(card => {
        const matchedByPlayer = matchedBy.get(card.memberId)
        return (
          <MemoryCard
            key={card.cardId}
            card={card}
            isFlipped={flippedIds.includes(card.cardId)}
            isMatched={matchedByPlayer !== undefined}
            matchedRingClass={PLAYER_COLORS[matchedByPlayer % PLAYER_COLORS.length]?.ring}
            onClick={() => onCardClick(card)}
            disabled={disabled}
          />
        )
      })}
    </div>
  )
}
