import { useState, useEffect } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'
import { authApi, setToken } from '../services/api'
import ThemePicker from '../components/shared/ThemePicker'

function ForgotPasswordModal({ onClose }) {
  const [email, setEmail] = useState('')
  const [loading, setLoading] = useState(false)
  const [sent, setSent] = useState(false)

  async function handleSubmit(e) {
    e.preventDefault()
    setLoading(true)
    try {
      await authApi.forgotPassword(email)
    } finally {
      setLoading(false)
      setSent(true)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 px-6" onClick={onClose}>
      <div
        className="w-full max-w-sm rounded-3xl bg-white/[0.08] border border-white/10 backdrop-blur-sm p-6 space-y-4"
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-center justify-between">
          <h2 className="text-white font-bold text-lg">Mot de passe oublié</h2>
          <button onClick={onClose} className="text-white/50 active:text-white/80">
            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {sent ? (
          <div className="text-center space-y-3 py-2">
            <div className="text-3xl">📬</div>
            <p className="text-white text-sm">Si un compte existe avec cette adresse, tu recevras un email avec un lien de réinitialisation.</p>
            <button
              onClick={onClose}
              className="w-full rounded-2xl bg-primary py-3 font-bold text-white text-sm"
            >
              Fermer
            </button>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-3">
            <p className="text-white/60 text-sm">Entre ton adresse email pour recevoir un lien de réinitialisation.</p>
            <div className="relative">
              <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-white/50">
                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                </svg>
              </span>
              <input
                type="email"
                placeholder="Ton adresse email"
                value={email}
                onChange={e => setEmail(e.target.value)}
                required
                autoComplete="email"
                className="w-full rounded-xl border border-white/20 bg-white/10 pl-10 pr-4 py-3 text-white placeholder-white/40 focus:border-primary focus:outline-none focus:bg-white/15 transition-colors text-sm"
              />
            </div>
            <button
              type="submit"
              disabled={loading}
              className="w-full rounded-2xl bg-primary py-3 font-bold text-white shadow-lg shadow-primary/30 active:bg-primary-dark disabled:opacity-50 transition-all text-sm"
            >
              {loading ? (
                <span className="flex items-center justify-center gap-2">
                  <div className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
                  En cours…
                </span>
              ) : 'Envoyer le lien'}
            </button>
          </form>
        )}
      </div>
    </div>
  )
}

export default function Login() {
  const { token } = useParams()
  const { login, user, setUser } = useAuth()
  const navigate = useNavigate()

  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [inviteNeedsEmail, setInviteNeedsEmail] = useState(false)
  const [showForgot, setShowForgot] = useState(false)
  const [showTheme, setShowTheme] = useState(false)
  const inviteMode = !!token

  useEffect(() => {
    if (user && !inviteMode) navigate('/', { replace: true })
  }, [user, navigate, inviteMode])

  useEffect(() => {
    if (!token) return
    authApi.inviteInfo(token)
      .then(({ data }) => setInviteNeedsEmail(data.needsEmail))
      .catch(() => {})
  }, [token])

  async function handleLogin(e) {
    e.preventDefault()
    setLoading(true)
    setError('')
    try {
      await login(email, password)
      navigate('/')
    } catch {
      setError('Email ou mot de passe incorrect.')
    } finally {
      setLoading(false)
    }
  }

  async function handleAcceptInvite(e) {
    e.preventDefault()
    setLoading(true)
    setError('')
    try {
      const { data } = await authApi.acceptInvitation(token, password, inviteNeedsEmail ? email : undefined)
      setToken(data.token)
      setUser(data.user)
      localStorage.setItem(`onboarding_${data.user.id}`, '1')
      navigate('/', { replace: true })
    } catch {
      setError('Lien invalide ou expiré.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="relative flex h-full flex-col items-center justify-center overflow-hidden bg-dark px-6">
      <Background />

      {/* Floating theme button */}
      <button
        onClick={() => setShowTheme(true)}
        className="fixed bottom-6 right-4 z-40 h-10 w-10 rounded-full bg-white/10 border border-white/20 backdrop-blur-sm flex items-center justify-center active:scale-90 transition-transform"
        aria-label="Changer le thème"
      >
        <PaletteIcon className="h-5 w-5 text-white/60" />
      </button>

      <ThemePicker open={showTheme} onClose={() => setShowTheme(false)} />

      <div className="relative z-10 w-full max-w-sm">

        {/* Logo + branding */}
        <div className="text-center mb-10">
          <img src="/icons/icon-192x192.png" alt="MyBigFamily" className="h-40 w-40 rounded-2xl shadow-lg shadow-primary/40 mb-4 mx-auto" />
          <h1 className="text-3xl font-black text-white tracking-tight">MyBigFamily</h1>
          <p className="text-white/70 text-sm mt-1.5">
            {inviteMode
              ? 'Tu as été invité(e) à rejoindre la famille 🎉'
              : 'Votre histoire familiale, au même endroit.'}
          </p>
        </div>

        {/* Glass card */}
        <div className="rounded-3xl bg-white/[0.07] border border-white/10 backdrop-blur-sm p-6 space-y-4">
          {inviteMode && (
            <div className="rounded-2xl bg-primary/20 border border-primary/30 px-4 py-3 text-center">
              <p className="text-sm font-semibold text-primary-200 text-white">
                Choisis un mot de passe pour accéder à l'app
              </p>
              <p className="text-xs text-white mt-0.5">Minimum 8 caractères</p>
            </div>
          )}

          <form onSubmit={inviteMode ? handleAcceptInvite : handleLogin} className="space-y-3">
            {(!inviteMode || inviteNeedsEmail) && (
              <div className="relative">
                <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-white/50">
                  <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                  </svg>
                </span>
                <input
                  type="email"
                  placeholder={inviteNeedsEmail ? 'Ton adresse email (pour te connecter)' : 'Email'}
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  required
                  className="w-full rounded-xl border border-white/20 bg-white/10 pl-10 pr-4 py-3 text-white placeholder-white/40 focus:border-primary focus:outline-none focus:bg-white/15 transition-colors text-sm"
                />
              </div>
            )}

            <div className="relative">
              <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-white/50">
                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                </svg>
              </span>
              <input
                type={showPassword ? 'text' : 'password'}
                placeholder={inviteMode ? 'Choisir un mot de passe' : 'Mot de passe'}
                value={password}
                onChange={e => setPassword(e.target.value)}
                required
                minLength={inviteMode ? 8 : undefined}
                className="w-full rounded-xl border border-white/20 bg-white/10 pl-10 pr-10 py-3 text-white placeholder-white/40 focus:border-primary focus:outline-none focus:bg-white/15 transition-colors text-sm"
              />
              <button
                type="button"
                onClick={() => setShowPassword(v => !v)}
                className="absolute right-3.5 top-1/2 -translate-y-1/2 text-white/50 active:text-white/80"
              >
                {showPassword ? (
                  <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" />
                  </svg>
                ) : (
                  <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                    <path strokeLinecap="round" strokeLinejoin="round" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                  </svg>
                )}
              </button>
            </div>

            {error && (
              <div className="rounded-xl bg-red-500/10 border border-red-500/20 px-4 py-2.5 text-center">
                <p className="text-red-400 text-sm">{error}</p>
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full rounded-2xl bg-primary py-3.5 font-bold text-white shadow-lg shadow-primary/30 active:bg-primary-dark disabled:opacity-50 transition-all text-sm mt-1"
            >
              {loading
                ? '...'
                : inviteMode ? 'Créer mon compte' : 'Se connecter'}
            </button>

            {!inviteMode && (
              <button
                type="button"
                onClick={() => setShowForgot(true)}
                className="w-full text-center text-xs text-white/50 active:text-white/80 pt-1"
              >
                Mot de passe oublié ?
              </button>
            )}
          </form>
        </div>

        {showForgot && <ForgotPasswordModal onClose={() => setShowForgot(false)} />}

        <p className="text-center text-xs text-white/50 mt-6">
          Accès sur invitation uniquement
        </p>

        <p className="text-center text-xs text-white/25 mt-3">
          Réalisé par{' '}
          <a
            href="https://website-etnof-web.vercel.app/"
            target="_blank"
            rel="noopener noreferrer"
            className="text-white/40 hover:text-white/60 underline transition-colors"
          >
            etnof-web
          </a>
        </p>
      </div>
    </div>
  )
}

function PaletteIcon({ className }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10c.83 0 1.5-.67 1.5-1.5 0-.39-.15-.74-.39-1.01-.23-.26-.38-.61-.38-.99 0-.83.67-1.5 1.5-1.5H16c2.76 0 5-2.24 5-5 0-4.42-4.03-8-9-8z" />
      <circle cx="6.5"  cy="11.5" r="1.5" fill="currentColor" stroke="none" />
      <circle cx="9.5"  cy="7.5"  r="1.5" fill="currentColor" stroke="none" />
      <circle cx="14.5" cy="7.5"  r="1.5" fill="currentColor" stroke="none" />
      <circle cx="17.5" cy="11.5" r="1.5" fill="currentColor" stroke="none" />
    </svg>
  )
}

function Background() {
  return (
    <>
      {/* Orbes d'ambiance */}
      <div className="pointer-events-none absolute -top-32 -left-32 h-96 w-96 rounded-full bg-primary/20 blur-3xl" />
      <div className="pointer-events-none absolute -bottom-20 -right-20 h-80 w-80 rounded-full bg-amber-800/20 blur-3xl" />
      <div className="pointer-events-none absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 h-64 w-64 rounded-full bg-orange-600/10 blur-3xl" />

      {/* Grille subtile */}
      <div
        className="pointer-events-none absolute inset-0 opacity-[0.03]"
        style={{
          backgroundImage: 'linear-gradient(#fff 1px, transparent 1px), linear-gradient(90deg, #fff 1px, transparent 1px)',
          backgroundSize: '48px 48px',
        }}
      />

      {/* Étoiles / points décoratifs */}
      {[
        { top: '12%', left: '8%', size: 3 },
        { top: '25%', right: '10%', size: 2 },
        { top: '60%', left: '5%', size: 2 },
        { top: '75%', right: '8%', size: 3 },
        { top: '40%', right: '20%', size: 2 },
        { top: '18%', left: '30%', size: 2 },
      ].map((dot, i) => (
        <div
          key={i}
          className="pointer-events-none absolute rounded-full bg-white/20"
          style={{ top: dot.top, left: dot.left, right: dot.right, height: dot.size, width: dot.size }}
        />
      ))}
    </>
  )
}
