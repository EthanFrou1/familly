import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.jsx'
import './index.css'
import { registerSW } from 'virtual:pwa-register'
import { loadSavedTheme } from './hooks/useTheme'

loadSavedTheme()

// Enregistre le SW et recharge automatiquement la page quand une nouvelle version est disponible
registerSW({ immediate: true })

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
)
