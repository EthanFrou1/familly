import { useState, useEffect } from 'react'
import { useNavigate, Navigate } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'
import { adminApi } from '../services/api'
import Avatar from '../components/shared/Avatar'

const CONFIDENCE_CONFIG = {
  fort:     { label: 'Fort',     cls: 'bg-red-100 text-red-700',    dot: 'bg-red-500' },
  probable: { label: 'Probable', cls: 'bg-amber-100 text-amber-700', dot: 'bg-amber-500' },
  faible:   { label: 'Faible',   cls: 'bg-gray-100 text-gray-600',   dot: 'bg-gray-400' },
}

const REASON_LABELS = {
  same_email:    { label: 'Même email',          icon: '✉' },
  same_phone:    { label: 'Même téléphone',      icon: '📞' },
  same_name:     { label: 'Même nom complet',    icon: '👤' },
  same_birthdate:{ label: 'Même date de naissance', icon: '🎂' },
  similar_name:  { label: 'Nom similaire',       icon: '🔍' },
}

export default function Duplicates() {
  const { user } = useAuth()
  const navigate = useNavigate()

  const [candidates, setCandidates] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [actionLoading, setActionLoading] = useState(null)
  const [toast, setToast] = useState(null)

  const isAdmin = user?.role === 'Admin'

  useEffect(() => {
    if (!isAdmin) return
    adminApi.getDuplicates()
      .then(({ data }) => setCandidates(data))
      .catch(() => setError('Impossible de charger les doublons.'))
      .finally(() => setLoading(false))
  }, [isAdmin])

  if (!isAdmin) return <Navigate to="/" replace />

  function showToast(msg) {
    setToast(msg)
    setTimeout(() => setToast(null), 3000)
  }

  function removeCandidate(id) {
    setCandidates(prev => prev.filter(c => c.id !== id))
  }

  async function handleIgnore(id) {
    setActionLoading(id + ':ignore')
    try {
      await adminApi.ignoreDuplicate(id)
      removeCandidate(id)
      showToast('Doublon ignoré.')
    } catch {
      showToast('Erreur lors de la mise à jour.')
    } finally {
      setActionLoading(null)
    }
  }

  async function handleResolve(id) {
    setActionLoading(id + ':resolve')
    try {
      await adminApi.resolveDuplicate(id)
      removeCandidate(id)
      showToast('Marqué comme traité.')
    } finally {
      setActionLoading(null)
    }
  }

  const byCon = (level) => candidates.filter(c => c.confidence === level)
  const fortCount = byCon('fort').length
  const probableCount = byCon('probable').length
  const faibleCount = byCon('faible').length

  return (
    <div className="flex flex-col min-h-full bg-gray-50 animate-fade-in">

      {/* Header */}
      <div className="bg-dark px-5 pt-10 pb-5 shrink-0">
        <button
          onClick={() => navigate('/admin')}
          className="flex items-center gap-1.5 text-white/60 text-sm mb-3 active:opacity-70"
        >
          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
          </svg>
          Administration
        </button>
        <h1 className="text-2xl font-bold text-white mb-1">Doublons détectés</h1>
        <p className="text-white/50 text-sm">
          {loading ? 'Analyse en cours…' : `${candidates.length} doublon${candidates.length > 1 ? 's' : ''} à examiner`}
        </p>

        {!loading && candidates.length > 0 && (
          <div className="grid grid-cols-3 gap-2 mt-4">
            <StatChip label="Fort" value={fortCount} color="text-red-400" />
            <StatChip label="Probable" value={probableCount} color="text-amber-400" />
            <StatChip label="Faible" value={faibleCount} color="text-gray-300" />
          </div>
        )}
      </div>

      {/* Content */}
      <div className="flex-1 px-4 py-3 space-y-2">
        {loading ? (
          <div className="flex justify-center py-16">
            <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
          </div>
        ) : error ? (
          <div className="py-12 text-center text-red-500 text-sm">{error}</div>
        ) : candidates.length === 0 ? (
          <div className="flex flex-col items-center py-16 gap-3">
            <span className="text-4xl">✅</span>
            <p className="text-gray-500 text-sm font-medium">Aucun doublon détecté</p>
            <p className="text-gray-400 text-xs text-center max-w-xs">
              L'analyse ne trouve pas de membres susceptibles d'être en doublon.
            </p>
          </div>
        ) : (
          ['fort', 'probable', 'faible'].map(level => {
            const group = byCon(level)
            if (group.length === 0) return null
            const cfg = CONFIDENCE_CONFIG[level]
            return (
              <div key={level}>
                <div className="flex items-center gap-2 px-1 py-2 mb-1">
                  <span className={`h-2 w-2 rounded-full ${cfg.dot}`} />
                  <span className="text-xs font-semibold text-gray-500 uppercase tracking-wide">
                    Confiance {cfg.label} — {group.length}
                  </span>
                </div>
                {group.map(c => (
                  <DuplicateCard
                    key={c.id}
                    candidate={c}
                    onNavigateA={() => navigate(`/profile/${c.memberA.id}`)}
                    onNavigateB={() => navigate(`/profile/${c.memberB.id}`)}
                    onIgnore={() => handleIgnore(c.id)}
                    onResolve={() => handleResolve(c.id)}
                    ignoreLoading={actionLoading === c.id + ':ignore'}
                    resolveLoading={actionLoading === c.id + ':resolve'}
                  />
                ))}
              </div>
            )
          })
        )}
      </div>

      {toast && (
        <div className="fixed bottom-24 left-1/2 -translate-x-1/2 z-[9999] px-5 py-2.5 rounded-2xl text-sm font-medium shadow-lg whitespace-nowrap bg-gray-900 text-white">
          {toast}
        </div>
      )}
    </div>
  )
}

function StatChip({ label, value, color }) {
  return (
    <div className="bg-white/10 rounded-xl px-3 py-2.5 text-center">
      <div className={`text-2xl font-bold ${color}`}>{value}</div>
      <div className="text-white/50 text-xs mt-0.5">{label}</div>
    </div>
  )
}

function DuplicateCard({ candidate: c, onNavigateA, onNavigateB, onIgnore, onResolve, ignoreLoading, resolveLoading }) {
  const cfg = CONFIDENCE_CONFIG[c.confidence] ?? CONFIDENCE_CONFIG.faible
  const a = c.memberA
  const b = c.memberB

  return (
    <div className="bg-white rounded-2xl p-4 shadow-sm border border-gray-100 mb-2">
      {/* Confidence badge */}
      <div className="flex items-center justify-between mb-3">
        <span className={`text-xs px-2.5 py-1 rounded-full font-medium ${cfg.cls}`}>
          Confiance {cfg.label}
        </span>
        <div className="flex flex-wrap gap-1 justify-end">
          {c.reasons.map(r => {
            const info = REASON_LABELS[r]
            if (!info) return null
            return (
              <span key={r} className="text-xs bg-gray-100 text-gray-600 rounded-full px-2 py-0.5 flex items-center gap-1">
                <span>{info.icon}</span> {info.label}
              </span>
            )
          })}
        </div>
      </div>

      {/* Members comparison */}
      <div className="flex items-stretch gap-3">
        <MemberMini member={a} onClick={onNavigateA} />
        <div className="flex flex-col items-center justify-center shrink-0">
          <div className="h-6 w-px bg-gray-200" />
          <span className="text-xs text-gray-400 my-1">vs</span>
          <div className="h-6 w-px bg-gray-200" />
        </div>
        <MemberMini member={b} onClick={onNavigateB} />
      </div>

      {/* Actions */}
      <div className="flex gap-2 mt-3 pt-3 border-t border-gray-50">
        <button
          onClick={onIgnore}
          disabled={ignoreLoading || resolveLoading}
          className="flex-1 py-2 rounded-xl text-xs font-medium text-gray-500 bg-gray-100 active:scale-95 transition-transform disabled:opacity-50"
        >
          {ignoreLoading ? '…' : 'Ignorer'}
        </button>
        <button
          onClick={onResolve}
          disabled={ignoreLoading || resolveLoading}
          className="flex-1 py-2 rounded-xl text-xs font-medium text-green-700 bg-green-100 active:scale-95 transition-transform disabled:opacity-50"
        >
          {resolveLoading ? '…' : 'Marquer traité'}
        </button>
      </div>
    </div>
  )
}

function MemberMini({ member: m, onClick }) {
  return (
    <button
      onClick={onClick}
      className="flex-1 flex flex-col items-center gap-1.5 p-2 rounded-xl active:bg-gray-50 transition-colors text-center"
    >
      <Avatar member={m} size={40} />
      <p className="text-sm font-semibold text-gray-900 leading-tight">
        {m.firstName} {m.lastName}
      </p>
      {m.birthDate && (
        <p className="text-xs text-gray-400">
          {new Date(m.birthDate).toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric' })}
        </p>
      )}
      {m.email && (
        <p className="text-xs text-gray-400 truncate max-w-full">{m.email}</p>
      )}
      <span className="text-xs text-primary font-medium mt-0.5">Voir le profil →</span>
    </button>
  )
}
