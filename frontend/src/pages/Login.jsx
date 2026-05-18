import { useState, useEffect } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'
import { authApi } from '../services/api'

export default function Login() {
  const { token } = useParams()
  const { login, user } = useAuth()
  const navigate = useNavigate()

  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [inviteDone, setInviteDone] = useState(false)
  const inviteMode = !!token

  useEffect(() => {
    if (user && !inviteMode) navigate('/', { replace: true })
  }, [user, navigate, inviteMode])

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
      await authApi.acceptInvitation(token, password)
      setInviteDone(true)
    } catch {
      setError('Lien invalide ou expiré.')
    } finally {
      setLoading(false)
    }
  }

  if (inviteDone) {
    return (
      <div className="flex h-full flex-col items-center justify-center bg-dark px-6">
        <div className="w-full max-w-sm space-y-6 text-center">
          <div className="mx-auto h-16 w-16 rounded-full bg-emerald-500/20 flex items-center justify-center">
            <svg className="h-8 w-8 text-emerald-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
            </svg>
          </div>
          <div>
            <h1 className="text-2xl font-bold text-white">Compte créé !</h1>
            <p className="mt-2 text-gray-400">Votre mot de passe a été enregistré. Vous pouvez maintenant vous connecter.</p>
          </div>
          <button
            onClick={() => navigate('/login')}
            className="w-full rounded-xl bg-primary py-3 font-semibold text-white active:bg-primary-dark"
          >
            Se connecter
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="flex h-full flex-col items-center justify-center bg-dark px-6">
      <div className="w-full max-w-sm space-y-8">
        <div className="text-center">
          <h1 className="text-4xl font-bold text-white">Famille</h1>
          <p className="mt-2 text-gray-400">
            {inviteMode ? 'Créer votre compte' : 'Connexion'}
          </p>
          {inviteMode && (
            <p className="mt-1 text-sm text-gray-500">Choisissez un mot de passe pour accéder à l'application.</p>
          )}
        </div>

        <form onSubmit={inviteMode ? handleAcceptInvite : handleLogin} className="space-y-4">
          {!inviteMode && (
            <input
              type="email"
              placeholder="Email"
              value={email}
              onChange={e => setEmail(e.target.value)}
              required
              className="w-full rounded-xl border border-gray-600 bg-white/10 px-4 py-3 text-white placeholder-gray-400 focus:border-primary focus:outline-none"
            />
          )}
          <input
            type="password"
            placeholder={inviteMode ? 'Choisir un mot de passe' : 'Mot de passe'}
            value={password}
            onChange={e => setPassword(e.target.value)}
            required
            minLength={inviteMode ? 8 : undefined}
            className="w-full rounded-xl border border-gray-600 bg-white/10 px-4 py-3 text-white placeholder-gray-400 focus:border-primary focus:outline-none"
          />
          {inviteMode && (
            <p className="text-xs text-gray-500 -mt-2">Minimum 8 caractères.</p>
          )}

          {error && <p className="text-red-400 text-sm text-center">{error}</p>}

          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-xl bg-primary py-3 font-semibold text-white min-h-touch active:bg-primary-dark disabled:opacity-50 transition-colors"
          >
            {loading ? '...' : inviteMode ? 'Créer mon compte' : 'Se connecter'}
          </button>
        </form>
      </div>
    </div>
  )
}
