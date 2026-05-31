export const PRESETS = [
  { id: 'famille',  name: 'Famille',  primary: '#2D7A42', primaryDark: '#1E5830', dark: '#C49A36', darkBg: '#0E3D1E', surface: '#F5F8F2' },
  { id: 'emeraude', name: 'Émeraude', primary: '#1A7A4A', primaryDark: '#0F5533', dark: '#D4B044', darkBg: '#0A3825', surface: '#F0FAF2' },
  { id: 'sapin',    name: 'Sapin',    primary: '#1B5E34', primaryDark: '#113D22', dark: '#B87E28', darkBg: '#091F12', surface: '#F2F7F3' },
  { id: 'olive',    name: 'Olive',    primary: '#6B7C3D', primaryDark: '#4A5628', dark: '#C8983A', darkBg: '#2E3419', surface: '#F8F7EC' },
  { id: 'prairie',  name: 'Prairie',  primary: '#3D9E56', primaryDark: '#2A7040', dark: '#DDB94A', darkBg: '#1A4A28', surface: '#EDFAF2' },
  { id: 'automne',  name: 'Automne',  primary: '#C49A36', primaryDark: '#A07828', dark: '#2D7A42', darkBg: '#3C2810', surface: '#FBF6EC' },
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
