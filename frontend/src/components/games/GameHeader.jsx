export default function GameHeader({ title, onBack }) {
  return (
    <div className="bg-dark px-5 pt-12 pb-4 flex items-center gap-3">
      <button onClick={onBack} className="text-white/70">
        <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
        </svg>
      </button>
      <h1 className="text-xl font-bold text-white">{title}</h1>
    </div>
  )
}
