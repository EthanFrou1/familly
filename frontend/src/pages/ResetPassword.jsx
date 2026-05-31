import { useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { authApi } from '../services/api'

export default function ResetPassword() {
  const { token } = useParams()
  const navigate = useNavigate()

  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [done, setDone] = useState(false)

  async function handleSubmit(e) {
    e.preventDefault()
    if (password !== confirm) {
      setError('Les mots de passe ne correspondent pas.')
      return
    }
    setLoading(true)
    setError('')
    try {
      await authApi.resetPassword(token, password)
      setDone(true)
    } catch {
      setError('Lien invalide ou expiré. Demande un nouveau lien.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="relative flex h-full flex-col items-center justify-center overflow-hidden bg-dark px-6">
      <Background />

      <div className="relative z-10 w-full max-w-sm">
        <div className="text-center mb-10">
          <img src="/icons/icon-192x192.png" alt="MyBigFamily" className="h-40 w-40 rounded-2xl shadow-lg shadow-primary/40 mb-4 mx-auto" />
          <h1 className="text-3xl font-black text-white tracking-tight">MyBigFamily</h1>
          <p className="text-white/70 text-sm mt-1.5">Nouveau mot de passe</p>
        </div>

        <div className="rounded-3xl bg-white/[0.07] border border-white/10 backdrop-blur-sm p-6 space-y-4">
          {done ? (
            <div className="text-center space-y-4 py-2">
              <div className="text-4xl">✅</div>
              <p className="text-white font-semibold">Mot de passe modifié !</p>
              <p className="text-white/60 text-sm">Tu peux maintenant te connecter avec ton nouveau mot de passe.</p>
              <button
                onClick={() => navigate('/login', { replace: true })}
                className="w-full rounded-2xl bg-primary py-3.5 font-bold text-white shadow-lg shadow-primary/30 active:bg-primary-dark transition-all text-sm"
              >
                Se connecter
              </button>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-3">
              <div className="rounded-2xl bg-primary/20 border border-primary/30 px-4 py-3 text-center">
                <p className="text-sm font-semibold text-white">Choisis ton nouveau mot de passe</p>
                <p className="text-xs text-white/70 mt-0.5">Minimum 8 caractères</p>
              </div>

              <div className="relative">
                <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-white/50">
                  <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                  </svg>
                </span>
                <input
                  type={showPassword ? 'text' : 'password'}
                  placeholder="Nouveau mot de passe"
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  required
                  minLength={8}
                  autoComplete="new-password"
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

              <div className="relative">
                <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-white/50">
                  <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                  </svg>
                </span>
                <input
                  type={showPassword ? 'text' : 'password'}
                  placeholder="Confirmer le mot de passe"
                  value={confirm}
                  onChange={e => setConfirm(e.target.value)}
                  required
                  minLength={8}
                  autoComplete="new-password"
                  className="w-full rounded-xl border border-white/20 bg-white/10 pl-10 pr-4 py-3 text-white placeholder-white/40 focus:border-primary focus:outline-none focus:bg-white/15 transition-colors text-sm"
                />
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
                {loading ? (
                  <span className="flex items-center justify-center gap-2">
                    <div className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
                    En cours…
                  </span>
                ) : 'Enregistrer le mot de passe'}
              </button>
            </form>
          )}
        </div>

        <p className="text-center text-xs text-white/50 mt-6">Accès sur invitation uniquement</p>
      </div>
    </div>
  )
}

function Background() {
  return (
    <>
      <div className="pointer-events-none absolute -top-32 -left-32 h-96 w-96 rounded-full bg-primary/20 blur-3xl" />
      <div className="pointer-events-none absolute -bottom-20 -right-20 h-80 w-80 rounded-full bg-amber-800/20 blur-3xl" />
      <div className="pointer-events-none absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 h-64 w-64 rounded-full bg-orange-600/10 blur-3xl" />
      <div
        className="pointer-events-none absolute inset-0 opacity-[0.03]"
        style={{
          backgroundImage: 'linear-gradient(#fff 1px, transparent 1px), linear-gradient(90deg, #fff 1px, transparent 1px)',
          backgroundSize: '48px 48px',
        }}
      />
    </>
  )
}
