import { useState } from 'react'

const SPIN_DURATION = 3200
const REVEAL_HOLD = 1100
const SLICE_COLORS = ['var(--c-primary)', 'var(--c-dark)']

function buildGradient(n) {
  const angle = 360 / n
  const stops = []
  for (let i = 0; i < n; i++) {
    stops.push(`${SLICE_COLORS[i % 2]} ${i * angle}deg ${(i + 1) * angle}deg`)
  }
  return `conic-gradient(${stops.join(', ')})`
}

/**
 * Roue de tirage au sort générique, réutilisable pour n'importe quel jeu :
 * items = [{ id, label }], onSpinEnd(item) est appelé une fois l'animation
 * (rotation + révélation) terminée.
 */
export default function SpinWheel({ items, onSpinEnd, size = 260, spinLabel = 'Tourner', disabled = false }) {
  const [rotation, setRotation] = useState(0)
  const [spinning, setSpinning] = useState(false)
  const [winner, setWinner] = useState(null)

  const sliceAngle = 360 / items.length

  function spin() {
    if (spinning || winner || disabled || items.length < 2) return

    const winnerIndex = Math.floor(Math.random() * items.length)
    const picked = items[winnerIndex]
    const targetAngle = (360 - (winnerIndex * sliceAngle + sliceAngle / 2) + 360) % 360

    setSpinning(true)
    setRotation(prev => {
      const base = ((prev % 360) + 360) % 360
      const delta = (targetAngle - base + 360) % 360
      return prev + 5 * 360 + delta
    })

    setTimeout(() => {
      setSpinning(false)
      setWinner(picked)
      setTimeout(() => {
        setWinner(null)
        onSpinEnd(picked)
      }, REVEAL_HOLD)
    }, SPIN_DURATION)
  }

  return (
    <div className="flex flex-col items-center">
      <div className="relative" style={{ width: size, height: size }}>
        <div
          className="absolute left-1/2 -translate-x-1/2 -top-1 z-20 h-0 w-0"
          style={{ borderLeft: '10px solid transparent', borderRight: '10px solid transparent', borderTop: '18px solid var(--c-primary-dark)' }}
        />

        <div
          className="h-full w-full rounded-full border-4 border-white shadow-xl overflow-hidden relative"
          style={{
            background: buildGradient(items.length),
            transform: `rotate(${rotation}deg)`,
            transition: spinning ? 'transform 3.2s cubic-bezier(0.15,0.65,0.2,1)' : 'none',
          }}
        >
          {items.map((item, i) => {
            const mid = i * sliceAngle + sliceAngle / 2
            return (
              <div key={item.id} className="absolute inset-0 flex justify-center" style={{ transform: `rotate(${mid}deg)` }}>
                <span className="mt-4 max-w-[72px] truncate text-[11px] font-bold text-white" style={{ textShadow: '0 1px 2px rgba(0,0,0,0.35)' }}>
                  {item.label}
                </span>
              </div>
            )
          })}
        </div>

        {winner && (
          <div className="absolute inset-0 flex items-center justify-center z-30">
            <div className="animate-scale-in rounded-2xl bg-white shadow-xl px-5 py-4 text-center">
              <p className="text-2xl">🎉</p>
              <p className="text-sm font-bold text-primary mt-1">{winner.label}</p>
            </div>
          </div>
        )}
      </div>

      <button
        onClick={spin}
        disabled={disabled || spinning || !!winner || items.length < 2}
        className="mt-8 w-full max-w-xs rounded-xl bg-primary py-3.5 text-sm font-semibold text-white shadow-lg active:bg-primary-dark disabled:opacity-40"
      >
        {spinning ? 'Ça tourne…' : spinLabel}
      </button>
    </div>
  )
}
