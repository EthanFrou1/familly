import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../../hooks/useAuth'
import { adminApi, settingsApi } from '../../services/api'

export default function SuccessAddModal({ member, onClose }) {
  const { user } = useAuth()
  const navigate = useNavigate()
  const isAdmin = user?.role === 'Admin'

  const [inviteStep, setInviteStep] = useState('idle') // idle | loading | done | error
  const [inviteLink, setInviteLink] = useState('')
  const [copied, setCopied] = useState(false)
  const [copiedMsg, setCopiedMsg] = useState(false)
  const [familyGroupName, setFamilyGroupName] = useState(null)

  useEffect(() => {
    settingsApi.get().then(({ data }) => setFamilyGroupName(data.familyGroupName ?? null)).catch(() => {})
  }, [])

  useEffect(() => {
    if (!member) return
    const t = setTimeout(onClose, 5000)
    return () => clearTimeout(t)
  }, [member])

  if (!member) return null

  async function handleInvite() {
    setInviteStep('loading')
    try {
      const { data } = await adminApi.generateInvitation(
        member.email, 'Member', member.id,
        window.location.origin,
        member.firstName,
        familyGroupName ?? undefined
      )
      const link = `${window.location.origin}/invite/${data.token}`
      setInviteLink(link)
      setInviteStep('done')
    } catch (err) {
      const msg = err.response?.data?.message
      if (msg?.includes('déjà utilisé') || err.response?.status === 409) {
        setInviteStep('error-conflict')
      } else {
        setInviteStep('error')
      }
    }
  }

  async function handleCopy() {
    await navigator.clipboard.writeText(inviteLink)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  async function handleCopyMessage() {
    const greeting = familyGroupName
      ? `Bonjour ! Vous êtes invité(e) à rejoindre la Famille ${familyGroupName}.\n\n`
      : `Bonjour ! Vous êtes invité(e) à rejoindre notre espace famille.\n\n`
    const msg = `${greeting}Créez votre compte en cliquant sur ce lien :\n${inviteLink}`
    await navigator.clipboard.writeText(msg)
    setCopiedMsg(true)
    setTimeout(() => setCopiedMsg(false), 2000)
  }

  function handleViewProfile() {
    onClose()
    navigate(`/profile/${member.id}`)
  }

  return (
    <div className="fixed inset-0 z-[70] flex items-end justify-center">
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />
      <div className="relative bg-white rounded-t-3xl animate-slide-up w-full max-w-lg px-6 pt-8 pb-10 flex flex-col items-center gap-5">

        {/* Icône succès */}
        <div className="h-16 w-16 rounded-full bg-emerald-100 flex items-center justify-center">
          <svg className="h-8 w-8 text-emerald-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
          </svg>
        </div>

        <div className="text-center">
          <h2 className="text-xl font-bold text-gray-900">Membre ajouté !</h2>
          <p className="text-gray-500 mt-1">
            {member.firstName} {member.lastName} fait maintenant partie de la famille.
          </p>
        </div>

        {/* Section invitation */}
        {isAdmin && (
          <div className="w-full rounded-2xl bg-gray-50 p-4 space-y-3">
            <p className="text-sm font-semibold text-gray-700">Accès à l'application</p>

            {!member.email ? (
              <p className="text-xs text-gray-400">
                Ce membre n'a pas d'email. Il apparaît dans l'arbre familial mais ne peut pas se connecter.
                Vous pourrez lui ajouter un email plus tard pour l'inviter.
              </p>
            ) : inviteStep === 'idle' && (
              <>
                <p className="text-xs text-gray-400">
                  Envoyez un lien d'invitation à {member.email} pour qu'il puisse créer son mot de passe et accéder à l'appli.
                </p>
                <button
                  onClick={handleInvite}
                  className="w-full rounded-xl border-2 border-primary py-2.5 text-sm font-semibold text-primary active:bg-primary/5"
                >
                  Générer un lien d'invitation
                </button>
              </>
            )}

            {inviteStep === 'loading' && (
              <p className="text-xs text-center text-gray-400 py-2">Génération du lien...</p>
            )}

            {inviteStep === 'done' && (
              <div className="space-y-3">
                {/* Message pré-rédigé */}
                <div className="rounded-xl bg-white border border-gray-200 px-3 py-3 space-y-2">
                  <p className="text-xs font-semibold text-gray-600">Message à envoyer</p>
                  <p className="text-xs text-gray-500 leading-relaxed whitespace-pre-line">
                    {familyGroupName
                      ? `Bonjour ! Vous êtes invité(e) à rejoindre la Famille ${familyGroupName}.\n\nCréez votre compte ici :\n${inviteLink}`
                      : `Bonjour ! Vous êtes invité(e) à rejoindre notre espace famille.\n\nCréez votre compte ici :\n${inviteLink}`}
                  </p>
                  <button
                    onClick={handleCopyMessage}
                    className="w-full rounded-lg bg-primary/10 py-2 text-xs font-semibold text-primary active:bg-primary/20"
                  >
                    {copiedMsg ? 'Message copié !' : 'Copier le message'}
                  </button>
                </div>

                {/* Lien seul */}
                <div className="flex items-center gap-2 bg-white rounded-xl border border-gray-200 px-3 py-2">
                  <span className="flex-1 text-xs text-gray-400 truncate font-mono">{inviteLink}</span>
                  <button onClick={handleCopy} className="shrink-0 text-xs font-semibold text-primary">
                    {copied ? 'Copié !' : 'Lien seul'}
                  </button>
                </div>
              </div>
            )}

            {inviteStep === 'error-conflict' && (
              <p className="text-xs text-center text-amber-600 bg-amber-50 rounded-xl px-3 py-2">
                Un compte existe déjà pour cet email.
              </p>
            )}

            {inviteStep === 'error' && (
              <p className="text-xs text-center text-red-500 bg-red-50 rounded-xl px-3 py-2">
                Erreur lors de la génération. Réessayez plus tard.
              </p>
            )}
          </div>
        )}

        {!isAdmin && !member.email && (
          <div className="w-full rounded-2xl bg-gray-50 p-4">
            <p className="text-xs text-gray-400 text-center">
              Ce membre apparaît dans l'arbre familial mais n'a pas de compte.
            </p>
          </div>
        )}

        {/* Actions */}
        <div className="w-full space-y-3">
          <button
            onClick={handleViewProfile}
            className="w-full rounded-xl bg-primary py-3 font-semibold text-white active:bg-primary-dark"
          >
            Voir le profil
          </button>
          <button
            onClick={onClose}
            className="w-full rounded-xl border border-gray-200 py-3 text-sm font-medium text-gray-600 active:bg-gray-50"
          >
            Fermer
          </button>
        </div>
      </div>
    </div>
  )
}
