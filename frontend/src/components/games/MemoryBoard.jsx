import { useEffect, useRef, useState } from 'react'
import MemoryCard from './MemoryCard'
import { PLAYER_COLORS } from '../../utils/memoryGame'

const GRID_COLS = { 6: 3, 8: 4, 12: 4 }
const GAP = 8 // px, doit correspondre à gap-2
const MIN_CARD_SIZE = 56 // px — plancher pour garder les cartes lisibles
const MAX_CARD_SIZE = 120 // px — plafond pour ne pas grossir sur tablette

export default function MemoryBoard({ deck, flippedIds, matchedBy, onCardClick, disabled }) {
  const containerRef = useRef(null)
  const [cardSize, setCardSize] = useState(MIN_CARD_SIZE)

  const cols = GRID_COLS[deck.length / 2] ?? 4
  const rows = Math.ceil(deck.length / cols)

  useEffect(() => {
    const el = containerRef.current
    if (!el) return

    function recompute() {
      const { width, height } = el.getBoundingClientRect()
      const widthPerCard = (width - (cols - 1) * GAP) / cols
      const heightPerCard = (height - (rows - 1) * GAP) / rows
      const size = Math.floor(Math.min(widthPerCard, heightPerCard))
      setCardSize(Math.max(MIN_CARD_SIZE, Math.min(MAX_CARD_SIZE, size)))
    }

    recompute()
    const observer = new ResizeObserver(recompute)
    observer.observe(el)
    return () => observer.disconnect()
  }, [cols, rows])

  return (
    <div ref={containerRef} className="w-full h-full flex items-center justify-center">
      <div
        className="grid gap-2"
        style={{
          gridTemplateColumns: `repeat(${cols}, ${cardSize}px)`,
          gridTemplateRows: `repeat(${rows}, ${cardSize}px)`,
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
    </div>
  )
}
