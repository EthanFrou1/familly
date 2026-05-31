export const PRESETS = [
  { id: 'famille',   name: 'Famille',    primary: '#2D7A42', primaryDark: '#1E5830', dark: '#C49A36', darkBg: '#0E3D1E', surface: '#F5F8F2' },
  { id: 'ocean',     name: 'Océan',      primary: '#0A78BE', primaryDark: '#055A96', dark: '#23ADFF', darkBg: '#0A3250', surface: '#E6F6FF' },
  { id: 'foret',     name: 'Forêt',      primary: '#16A34A', primaryDark: '#15803D', dark: '#4ADE80', darkBg: '#052E16', surface: '#F0FDF4' },
  { id: 'violet',    name: 'Violet',     primary: '#7C3AED', primaryDark: '#6D28D9', dark: '#A78BFA', darkBg: '#1E0A3C', surface: '#F5F3FF' },
  { id: 'soleil',    name: 'Soleil',     primary: '#D97706', primaryDark: '#B45309', dark: '#FCD34D', darkBg: '#3C1A00', surface: '#FFFBEB' },
  { id: 'rose',      name: 'Rose',       primary: '#DB2777', primaryDark: '#BE185D', dark: '#F9A8D4', darkBg: '#3C0A1A', surface: '#FFF0F5' },
  { id: 'turquoise', name: 'Turquoise',  primary: '#0D9488', primaryDark: '#0F766E', dark: '#2DD4BF', darkBg: '#042F2E', surface: '#F0FDFA' },
]

function hexToRgb(hex) {
  const r = parseInt(hex.slice(1, 3), 16)
  const g = parseInt(hex.slice(3, 5), 16)
  const b = parseInt(hex.slice(5, 7), 16)
  return `${r} ${g} ${b}`
}

export function darkenHex(hex, factor = 0.7) {
  const r = Math.round(parseInt(hex.slice(1, 3), 16) * factor)
  const g = Math.round(parseInt(hex.slice(3, 5), 16) * factor)
  const b = Math.round(parseInt(hex.slice(5, 7), 16) * factor)
  return `#${r.toString(16).padStart(2, '0')}${g.toString(16).padStart(2, '0')}${b.toString(16).padStart(2, '0')}`
}

export function applyTheme(theme) {
  const root = document.documentElement
  root.style.setProperty('--c-primary',      theme.primary)
  root.style.setProperty('--c-primary-dark', theme.primaryDark)
  root.style.setProperty('--c-dark',         theme.dark)
  root.style.setProperty('--c-dark-bg',      theme.darkBg)
  root.style.setProperty('--c-surface',      theme.surface)
  root.style.setProperty('--color-primary',      hexToRgb(theme.primary))
  root.style.setProperty('--color-primary-dark', hexToRgb(theme.primaryDark))
  root.style.setProperty('--color-dark',         hexToRgb(theme.dark))
  root.style.setProperty('--color-surface',      hexToRgb(theme.surface))
  localStorage.setItem('app-theme', JSON.stringify(theme))
}

export function loadSavedTheme() {
  try {
    const saved = localStorage.getItem('app-theme')
    if (saved) {
      const theme = JSON.parse(saved)
      // Migrate old famille theme (beige/mauve) to new green/gold theme
      if (theme.primary === '#D9B99B') {
        applyTheme(PRESETS[0])
        localStorage.setItem('app-theme', JSON.stringify(PRESETS[0]))
      } else {
        applyTheme(theme)
      }
    }
  } catch { /* ignore */ }
}

export function getCurrentThemeColors() {
  const s = getComputedStyle(document.documentElement)
  return {
    primary:     s.getPropertyValue('--c-primary').trim(),
    primaryDark: s.getPropertyValue('--c-primary-dark').trim(),
    dark:        s.getPropertyValue('--c-dark').trim(),
    darkBg:      s.getPropertyValue('--c-dark-bg').trim(),
    surface:     s.getPropertyValue('--c-surface').trim(),
  }
}
