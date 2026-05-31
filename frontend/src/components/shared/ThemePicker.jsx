import { useState, useEffect } from 'react'
import { PRESETS, applyTheme, getCurrentThemeColors, darkenHex } from '../../hooks/useTheme'

export default function ThemePicker({ open, onClose }) {
  const [custom, setCustom] = useState({ primary: '#2D7A42', primaryDark: '#1E5830', dark: '#C49A36', darkBg: '#0E3D1E', surface: '#F5F8F2' })
  const [activePreset, setActivePreset] = useState('famille')
  const [showCustom, setShowCustom] = useState(false)

  useEffect(() => {
    if (!open) return
    const current = getCurrentThemeColors()
    setCustom(current)
    const match = PRESETS.find(p => p.primary.toLowerCase() === current.primary.toLowerCase())
    setActivePreset(match?.id ?? null)
  }, [open])

  function handlePreset(preset) {
    setActivePreset(preset.id)
    setCustom({ primary: preset.primary, primaryDark: preset.primaryDark, dark: preset.dark, darkBg: preset.darkBg, surface: preset.surface })
    applyTheme(preset)
  }

  function handleCustomChange(key, value) {
    const next = { ...custom, [key]: value }
    if (key === 'primary') next.primaryDark = darkenHex(value)
    setCustom(next)
    setActivePreset(null)
    applyTheme(next)
  }

  function handleReset() {
    handlePreset(PRESETS[0])
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
        <div className="px-5 pb-3">
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

        {/* Divider */}
        <div className="h-px bg-white/10 mx-5" />

        {/* Custom section toggle */}
        <button
          onClick={() => setShowCustom(v => !v)}
          className="flex w-full items-center justify-between px-5 py-3 active:bg-white/5 transition-colors"
        >
          <span className="text-white/40 text-xs uppercase tracking-wider">Couleurs personnalisées</span>
          <svg
            className={`h-4 w-4 text-white/40 transition-transform duration-200 ${showCustom ? 'rotate-180' : ''}`}
            fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}
          >
            <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
          </svg>
        </button>

        {showCustom && (
          <div className="px-5 pb-3 space-y-3 animate-fade-in">
            {[
              { key: 'primary',  label: 'Couleur principale' },
              { key: 'dark',     label: 'Couleur accent' },
              { key: 'darkBg',   label: 'Fond sombre (menus)' },
              { key: 'surface',  label: 'Fond clair' },
            ].map(({ key, label }) => (
              <label key={key} className="flex items-center justify-between cursor-pointer">
                <span className="text-white/70 text-sm">{label}</span>
                <div
                  className="relative h-8 w-14 rounded-lg overflow-hidden cursor-pointer"
                  style={{ outline: '2px solid rgba(255,255,255,0.15)', outlineOffset: '-1px' }}
                >
                  <div className="absolute inset-0 rounded-lg" style={{ background: custom[key] ?? '#000000' }} />
                  <input
                    type="color"
                    value={custom[key] ?? '#000000'}
                    onChange={e => handleCustomChange(key, e.target.value)}
                    className="absolute inset-0 opacity-0 w-full h-full cursor-pointer"
                  />
                </div>
              </label>
            ))}
          </div>
        )}

        {/* Footer */}
        <div className="px-5 pt-1 pb-4">
          <button
            onClick={handleReset}
            className="w-full py-3 rounded-xl text-white/40 text-sm active:bg-white/5 transition-colors border border-white/10 hover:text-white/60"
          >
            Réinitialiser par défaut
          </button>
        </div>
      </div>
    </div>
  )
}
