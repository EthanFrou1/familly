import { useState } from 'react'
import SpinWheel from './SpinWheel'

/**
 * Tire l'ordre de jeu complet d'une liste de joueurs à l'aide de SpinWheel :
 * élimine le joueur tiré à chaque tour jusqu'à ce qu'il n'en reste qu'un,
 * puis renvoie l'ordre complet via onOrderReady.
 */
export default function TurnOrderWheel({ players, onOrderReady }) {
  const [remaining, setRemaining] = useState(players)
  const [order, setOrder] = useState([])

  const items = remaining.map((p, i) => ({ id: i, label: p.name }))

  function handleSpinEnd(picked) {
    const winner = remaining[picked.id]
    const newOrder = [...order, winner]
    const newRemaining = remaining.filter((_, i) => i !== picked.id)

    setOrder(newOrder)
    setRemaining(newRemaining)

    if (newRemaining.length <= 1) {
      const final = newRemaining.length === 1 ? [...newOrder, newRemaining[0]] : newOrder
      onOrderReady(final)
    }
  }

  return (
    <div className="px-4 mt-6 flex flex-col items-center">
      <p className="text-sm font-semibold text-gray-500 mb-4">Qui commence ?</p>

      {order.length > 0 && (
        <div className="w-full mb-6 flex flex-wrap gap-2 justify-center">
          {order.map((p, i) => (
            <span key={p.name + i} className="rounded-full bg-white shadow-sm px-3 py-1.5 text-xs font-semibold text-gray-600">
              {i + 1}. {p.name}
            </span>
          ))}
        </div>
      )}

      <SpinWheel
        items={items}
        onSpinEnd={handleSpinEnd}
        spinLabel={order.length === 0 ? 'Tourner la roue' : 'Tourner pour la suite'}
      />
    </div>
  )
}
