import { useEffect, useState } from 'react'

const SPIN_DURATION = 3200
const REVEAL_DELAY = 1100
const SLICE_COLORS = ['var(--c-primary)', 'var(--c-dark)']

function buildGradient(n) {
  const angle = 360 / n
  const stops = []
  for (let i = 0; i < n; i++) {
    stops.push(`${SLICE_COLORS[i % 2]} ${i * angle}deg ${(i + 1) * angle}deg`)
  }
  return `conic-gradient(${stops.join(', ')})`
}

export default function TurnOrderWheel({ players, onOrderReady }) {
  const [remaining, setRemaining] = useState(players)
  const [order, setOrder] = useState([])
  const [rotation, setRotation] = useState(0)
  const [spinning, setSpinning] = useState(false)
  const [justDrawn, setJustDrawn] = useState(null)

  const sliceAngle = 360 / remaining.length

  useEffect(() => {
    if (!justDrawn) return
    const timer = setTimeout(() => {
      const newOrder = [...order, justDrawn]
      const newRemaining = remaining.filter(p => p !== justDrawn)
      setOrder(newOrder)
      setRemaining(newRemaining)
      setJustDrawn(null)

      if (newRemaining.length <= 1) {
        const final = newRemaining.length === 1 ? [...newOrder, newRemaining[0]] : newOrder
        setTimeout(() => onOrderReady(final), 400)
      }
    }, REVEAL_DELAY)
    return () => clearTimeout(timer)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [justDrawn])

  function spin() {
    if (spinning || justDrawn || remaining.length <= 1) return

    const winnerIndex = Math.floor(Math.random() * remaining.length)
    const winner = remaining[winnerIndex]
    const targetAngle = (360 - (winnerIndex * sliceAngle + sliceAngle / 2) + 360) % 360

    setSpinning(true)
    setRotation(prev => {
      const base = ((prev % 360) + 360) % 360
      const delta = (targetAngle - base + 360) % 360
      return prev + 5 * 360 + delta
    })

    setTimeout(() => {
      setSpinning(false)
      setJustDrawn(winner)
    }, SPIN_DURATION)
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

      <div className="relative" style={{ width: 260, height: 260 }}>
        <div
          className="absolute left-1/2 -translate-x-1/2 -top-1 z-20 h-0 w-0"
          style={{ borderLeft: '10px solid transparent', borderRight: '10px solid transparent', borderTop: '18px solid var(--c-primary-dark)' }}
        />

        <div
          className="h-full w-full rounded-full border-4 border-white shadow-xl overflow-hidden relative"
          style={{
            background: buildGradient(remaining.length),
            transform: `rotate(${rotation}deg)`,
            transition: spinning ? 'transform 3.2s cubic-bezier(0.15,0.65,0.2,1)' : 'none',
          }}
        >
          {remaining.map((p, i) => {
            const mid = i * sliceAngle + sliceAngle / 2
            return (
              <div key={p.name + i} className="absolute inset-0 flex justify-center" style={{ transform: `rotate(${mid}deg)` }}>
                <span className="mt-4 max-w-[72px] truncate text-[11px] font-bold text-white" style={{ textShadow: '0 1px 2px rgba(0,0,0,0.35)' }}>
                  {p.name}
                </span>
              </div>
            )
          })}
        </div>

        {justDrawn && (
          <div className="absolute inset-0 flex items-center justify-center z-30">
            <div className="animate-scale-in rounded-2xl bg-white shadow-xl px-5 py-4 text-center">
              <p className="text-2xl">🎉</p>
              <p className="text-sm font-bold text-primary mt-1">{justDrawn.name}</p>
            </div>
          </div>
        )}
      </div>

      <button
        onClick={spin}
        disabled={spinning || !!justDrawn || remaining.length <= 1}
        className="mt-8 w-full max-w-xs rounded-xl bg-primary py-3.5 text-sm font-semibold text-white shadow-lg active:bg-primary-dark disabled:opacity-40"
      >
        {spinning ? 'Ça tourne…' : order.length === 0 ? 'Tourner la roue' : 'Tourner pour la suite'}
      </button>
    </div>
  )
}
