import { useState } from 'react'

export default function PlayerSetupStep({ onContinue }) {
  const [count, setCount] = useState(2)
  const [names, setNames] = useState(['', ''])

  function setCountAndNames(n) {
    setCount(n)
    setNames(prev => Array.from({ length: n }, (_, i) => prev[i] ?? ''))
  }

  return (
    <div className="px-4 mt-5 space-y-5">
      <div>
        <h2 className="text-sm font-semibold text-gray-500 mb-2">Nombre de joueurs</h2>
        <div className="flex gap-2">
          {[2, 3, 4].map(n => (
            <button
              key={n}
              onClick={() => setCountAndNames(n)}
              className={`flex-1 rounded-xl py-3 text-sm font-semibold ${count === n ? 'bg-primary text-white' : 'bg-white text-gray-600 shadow-sm'}`}
            >
              {n} joueurs
            </button>
          ))}
        </div>
      </div>

      <div className="space-y-2">
        <h2 className="text-sm font-semibold text-gray-500">Prénoms (optionnel)</h2>
        {names.map((name, i) => (
          <input
            key={i}
            value={name}
            onChange={e => setNames(prev => prev.map((n, idx) => idx === i ? e.target.value : n))}
            placeholder={`Joueur ${i + 1}`}
            className="w-full rounded-xl bg-white shadow-sm px-4 py-2.5 text-sm focus:outline-none"
          />
        ))}
      </div>

      <button
        onClick={() => onContinue(names.map((n, i) => n.trim() || `Joueur ${i + 1}`))}
        className="w-full rounded-xl bg-primary py-3 text-sm font-semibold text-white active:bg-primary-dark"
      >
        Continuer
      </button>
    </div>
  )
}
