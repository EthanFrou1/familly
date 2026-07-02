export default function GameHeader({ title, subtitle, onBack }) {
  return (
    <div className="bg-dark px-5 pt-12 pb-5 flex items-center gap-3">
      <button
        onClick={onBack}
        className="shrink-0 h-9 w-9 rounded-xl bg-white/15 flex items-center justify-center text-white active:bg-white/25"
      >
        <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
        </svg>
      </button>
      <div className="min-w-0">
        <h1 className="text-xl font-black text-white leading-tight truncate">{title}</h1>
        {subtitle && <p className="text-xs font-semibold text-white/70 mt-0.5 truncate">{subtitle}</p>}
      </div>
    </div>
  )
}
