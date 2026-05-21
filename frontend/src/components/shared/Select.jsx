import { useState, useRef, useEffect } from 'react'

export default function Select({ value, onChange, children, placeholder = 'Sélectionner…', required, className = '' }) {
  const [open, setOpen] = useState(false)
  const [dropStyle, setDropStyle] = useState({})
  const ref = useRef(null)
  const triggerRef = useRef(null)

  // Parse options from children
  const options = []
  if (placeholder) options.push({ value: '', label: placeholder, isPlaceholder: true })
  ;(Array.isArray(children) ? children : [children]).forEach(child => {
    if (!child) return
    options.push({ value: child.props.value, label: child.props.children })
  })

  const selected = options.find(o => String(o.value) === String(value) && !o.isPlaceholder)
  const displayLabel = selected?.label ?? placeholder

  // Close on outside click
  useEffect(() => {
    function handler(e) {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false)
    }
    if (open) document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [open])

  function handleToggle() {
    if (!open && triggerRef.current) {
      const rect = triggerRef.current.getBoundingClientRect()
      const spaceBelow = window.innerHeight - rect.bottom
      if (spaceBelow < 230) {
        setDropStyle({ position: 'fixed', bottom: window.innerHeight - rect.top + 6, left: rect.left, width: rect.width })
      } else {
        setDropStyle({ position: 'fixed', top: rect.bottom + 6, left: rect.left, width: rect.width })
      }
    }
    setOpen(o => !o)
  }

  function select(val) {
    onChange({ target: { value: val } })
    setOpen(false)
  }

  return (
    <div ref={ref} className={`relative ${className}`}>
      {/* Trigger */}
      <button
        ref={triggerRef}
        type="button"
        onClick={handleToggle}
        className={`
          w-full flex items-center justify-between
          rounded-xl border bg-gray-50 pl-3.5 pr-3 py-2.5
          text-sm transition-all
          ${open
            ? 'border-primary bg-white ring-2 ring-primary/15'
            : 'border-gray-200 hover:border-gray-300'}
          ${!value ? 'text-gray-400' : 'text-gray-900'}
        `}
      >
        <span className="truncate">{displayLabel}</span>
        <svg
          className={`h-4 w-4 shrink-0 ml-2 transition-transform duration-200 ${open ? 'rotate-180 text-primary' : 'text-gray-400'}`}
          fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}
        >
          <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {/* Dropdown panel — fixed to escape any overflow-hidden ancestor */}
      {open && (
        <div className="z-[9999] rounded-2xl border border-gray-100 bg-white shadow-xl overflow-hidden" style={dropStyle}>
          <div className="max-h-52 overflow-y-auto py-1">
            {options.map((opt, i) => {
              const isSelected = String(opt.value) === String(value)
              const isPlaceholder = opt.isPlaceholder

              return (
                <button
                  key={i}
                  type="button"
                  onClick={() => select(opt.value)}
                  className={`
                    w-full flex items-center justify-between px-4 py-2.5 text-sm text-left
                    transition-colors
                    ${isSelected
                      ? 'bg-primary/8 text-primary font-semibold'
                      : isPlaceholder
                        ? 'text-gray-400 hover:bg-gray-50'
                        : 'text-gray-800 hover:bg-gray-50 active:bg-gray-100'}
                  `}
                >
                  <span>{opt.label}</span>
                  {isSelected && !isPlaceholder && (
                    <svg className="h-4 w-4 text-primary shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                    </svg>
                  )}
                </button>
              )
            })}
          </div>
        </div>
      )}

      {/* Hidden native select for form validation */}
      {required && (
        <select
          value={value}
          onChange={() => {}}
          required={required}
          tabIndex={-1}
          aria-hidden="true"
          className="absolute inset-0 opacity-0 pointer-events-none"
        >
          {options.map((opt, i) => (
            <option key={i} value={opt.value}>{opt.label}</option>
          ))}
        </select>
      )}
    </div>
  )
}
