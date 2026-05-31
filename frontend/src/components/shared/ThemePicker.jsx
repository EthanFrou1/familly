import { useState, useEffect } from 'react'
import { PRESETS, applyTheme, getCurrentThemeColors } from '../../hooks/useTheme'

export default function ThemePicker({ open, onClose }) {
  const [activePreset, setActivePreset] = useState('famille')

  useEffect(() => {
    if (!open) return
    const current = getCurrentThemeColors()
    const match = PRESETS.find(p => p.primary.toLowerCase() === current.primary.toLowerCase())
    setActivePreset(match?.id ?? null)
  }, [open])

  function handlePreset(preset) {
    setActivePreset(preset.id)
    applyTheme(preset)
  }

  if (!open) return null

  return (
    <div className="fixed inset-0 z-[60] flex flex-col justify-end" onClick={onClose}>
      <div className="absolute inset-0 bg-black/50" />

      <div
        className="relative rounded-t-2xl overflow-hidden animate-slide-up"
        style={{ background: 'var(--c-dark-bg)', paddingBottom: 'env(safe-area-inset-bottom)' }}
        onClick={e => e.stopPropagation()}
      >
        {/* Handle */}
        <div className="flex justify-center pt-3 pb-1">
          <div className="w-10 h-1 rounded-full bg-white/20" />
        </div>

        {/* Header */}
        <div className="flex items-center justify-between px-5 py-3">
          <h2 className="text-white font-semibold text-base">Thème de l'application</h2>
          <button onClick={onClose} className="text-white/50 p-1 -mr-1 active:text-white transition-colors">
            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Presets */}
        <div className="px-5 pb-5">
          <p className="text-white/40 text-xs uppercase tracking-wider mb-3">Thèmes prédéfinis</p>
          <div className="grid grid-cols-3 gap-2">
            {PRESETS.map(preset => (
              <button
                key={preset.id}
                onClick={() => handlePreset(preset)}
                className="flex flex-col items-center gap-2 py-3 rounded-xl transition-all active:scale-95"
                style={{ background: activePreset === preset.id ? 'rgba(255,255,255,0.12)' : 'rgba(255,255,255,0.04)' }}
              >
                <div className="relative">
                  <div
                    className="h-10 w-10 rounded-full shadow-lg"
                    style={{
                      background: `linear-gradient(135deg, ${preset.primary} 0%, ${preset.dark} 100%)`,
                      outline: activePreset === preset.id ? '2px solid rgba(255,255,255,0.6)' : '2px solid transparent',
                      outlineOffset: '2px',
                    }}
                  />
                  {activePreset === preset.id && (
                    <div className="absolute inset-0 flex items-center justify-center">
                      <svg className="h-5 w-5 text-white drop-shadow-lg" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                      </svg>
                    </div>
                  )}
                </div>
                <span className="text-white/70 text-xs font-medium">{preset.name}</span>
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
