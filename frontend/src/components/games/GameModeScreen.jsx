export default function GameModeScreen({ onLocal, onRemote }) {
  return (
    <div className="px-4 mt-6 space-y-3">
      <button
        onClick={onLocal}
        className="w-full flex items-center justify-between bg-white rounded-2xl px-4 py-4 shadow-sm active:scale-[0.99] transition-transform"
      >
        <div className="flex items-center gap-4">
          <span className="h-12 w-12 shrink-0 rounded-2xl bg-primary/10 flex items-center justify-center text-2xl">📱</span>
          <div className="text-left">
            <h2 className="font-extrabold text-gray-800">Jouer en local</h2>
            <p className="text-sm text-gray-500 mt-0.5">Passez-vous le téléphone à tour de rôle.</p>
          </div>
        </div>
        <svg className="h-4 w-4 text-gray-300 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
        </svg>
      </button>
      <button
        onClick={onRemote}
        className="w-full flex items-center justify-between bg-white rounded-2xl px-4 py-4 shadow-sm active:scale-[0.99] transition-transform"
      >
        <div className="flex items-center gap-4">
          <span className="h-12 w-12 shrink-0 rounded-2xl bg-dark/10 flex items-center justify-center text-2xl">🌐</span>
          <div className="text-left">
            <h2 className="font-extrabold text-gray-800">Jouer à distance</h2>
            <p className="text-sm text-gray-500 mt-0.5">Chacun sur son téléphone, en temps réel.</p>
          </div>
        </div>
        <svg className="h-4 w-4 text-gray-300 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
        </svg>
      </button>
    </div>
  )
}
