import { useState, useEffect, useMemo } from 'react'
import { createPortal } from 'react-dom'
import { useNavigate, Navigate } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'
import { adminApi, familiesApi, membersApi } from '../services/api'
import { usePageRefresh } from '../hooks/usePageRefresh'
import { matchesSearch } from '../utils/normalize'
import Avatar from '../components/shared/Avatar'
import Select from '../components/shared/Select'

const PAGE_SIZE = 10

const STATUS_CONFIG = {
  none:    { label: 'Sans compte', cls: 'bg-gray-100 text-gray-500' },
  pending: { label: 'En attente',  cls: 'bg-amber-100 text-amber-700' },
  active:  { label: 'Actif',       cls: 'bg-green-100 text-green-700' },
}

export default function Admin() {
  const { user } = useAuth()
  const navigate = useNavigate()

  const [overview, setOverview] = useState([])
  const [families, setFamilies] = useState([])
  const [activeUsers, setActiveUsers] = useState([])
  const [loading, setLoading] = useState(true)

  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('')
  const [typeFilter, setTypeFilter] = useState('')
  const [familyFilter, setFamilyFilter] = useState('')
  const [page, setPage] = useState(1)

  const [inviteTarget, setInviteTarget] = useState(null)
  const [managerTarget, setManagerTarget] = useState(null)
  const [toast, setToast] = useState(null)

  const isAdmin = user?.role === 'Admin'

  useEffect(() => {
    if (!isAdmin) return
    Promise.all([adminApi.getMembersOverview(), familiesApi.getAll()])
      .then(([{ data: m }, { data: f }]) => { setOverview(m); setFamilies(f) })
      .finally(() => setLoading(false))
  }, [isAdmin])

  usePageRefresh(() => {
    if (!isAdmin) return
    Promise.all([adminApi.getMembersOverview(), familiesApi.getAll()])
      .then(([{ data: m }, { data: f }]) => { setOverview(m); setFamilies(f) })
      .catch(() => {})
  })

  const filtered = useMemo(() => {
    let r = overview
    if (search.trim()) {
      r = r.filter(m =>
        matchesSearch(`${m.firstName} ${m.lastName}`, search) ||
        matchesSearch(m.email ?? '', search)
      )
    }
    if (statusFilter) r = r.filter(m => m.accountStatus === statusFilter)
    if (familyFilter === '__none__') r = r.filter(m => !m.familyId)
    else if (familyFilter) r = r.filter(m => m.familyId === familyFilter)
    if (typeFilter === 'autonomous') r = r.filter(m => m.accountStatus !== 'none')
    else if (typeFilter === 'managed') r = r.filter(m => !!m.delegateManagerId)
    else if (typeFilter === 'deceased') r = r.filter(m => !m.isAlive)
    return r
  }, [overview, search, statusFilter, familyFilter, typeFilter])

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE))

  const paginated = useMemo(
    () => filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE),
    [filtered, page]
  )

  const stats = useMemo(() => ({
    total: overview.length,
    active: overview.filter(m => m.accountStatus === 'active').length,
    pending: overview.filter(m => m.accountStatus === 'pending').length,
    none: overview.filter(m => m.accountStatus === 'none').length,
  }), [overview])

  // Reset to page 1 when filters change
  useEffect(() => setPage(1), [search, statusFilter, familyFilter, typeFilter])

  if (!isAdmin) return <Navigate to="/" replace />

  function showToast(msg, type = 'success') {
    setToast({ msg, type })
    setTimeout(() => setToast(null), 3000)
  }

  function updateMember(id, patch) {
    setOverview(prev => prev.map(m => m.id === id ? { ...m, ...patch } : m))
  }

  async function handleToggleAdmin(member) {
    if (!member.userId) return
    const newRole = member.userRole === 'Admin' ? 'Member' : 'Admin'
    try {
      await adminApi.changeUserRole(member.userId, newRole)
      updateMember(member.id, { userRole: newRole })
      showToast(newRole === 'Admin' ? `${member.firstName} est maintenant admin.` : `${member.firstName} n'est plus admin.`)
    } catch (e) {
      showToast(e.response?.data?.message ?? 'Erreur lors du changement de rôle.', 'error')
    }
  }

  async function handleCopyLink(member) {
    const link = `${window.location.origin}/invite/${member.invitationToken}`
    const message = `Bonjour ${member.firstName} !\n\nTu es invité(e) à rejoindre notre espace famille sur MyBigFamily.\n\nCrée ton compte en cliquant sur ce lien :\n${link}\n\nCe lien est à usage unique.`
    try {
      await navigator.clipboard.writeText(message)
      showToast('Message copié !')
    } catch {
      showToast('Impossible de copier', 'error')
    }
  }

  async function loadActiveUsers() {
    if (activeUsers.length === 0) {
      try {
        const { data } = await adminApi.getActiveUsers()
        setActiveUsers(data)
      } catch { /* silently ignore */ }
    }
  }

  return (
    <div className="flex flex-col min-h-full bg-gray-50 animate-fade-in">

      {/* Header */}
      <div className="bg-dark px-5 pt-10 pb-5 shrink-0">
        <h1 className="text-2xl font-bold text-white mb-1">Administration</h1>
        <p className="text-white/50 text-sm mb-4">{overview.length} membres enregistrés</p>

        <div className="grid grid-cols-3 gap-2">
          <StatChip label="Actifs" value={stats.active} color="text-green-400" />
          <StatChip label="En attente" value={stats.pending} color="text-amber-400" />
          <StatChip label="Sans compte" value={stats.none} color="text-gray-300" />
        </div>
      </div>

      {/* Quick access: Duplicates */}
      <div className="px-4 pt-3 space-y-2">
        <button
          onClick={() => navigate('/admin/duplicates')}
          className="w-full flex items-center justify-between bg-white rounded-2xl px-4 py-3.5 shadow-sm border border-gray-100 active:scale-[0.99] transition-transform"
        >
          <div className="flex items-center gap-3">
            <span className="h-9 w-9 rounded-xl bg-red-50 flex items-center justify-center text-lg">👥</span>
            <div className="text-left">
              <p className="text-sm font-semibold text-gray-900">Doublons détectés</p>
              <p className="text-xs text-gray-400">Vérifier les membres probablement en doublon</p>
            </div>
          </div>
          <svg className="h-4 w-4 text-gray-400 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
          </svg>
        </button>

        <button
          onClick={() => navigate('/admin/famillenor')}
          className="w-full flex items-center justify-between bg-white rounded-2xl px-4 py-3.5 shadow-sm border border-gray-100 active:scale-[0.99] transition-transform"
        >
          <div className="flex items-center gap-3">
            <span className="h-9 w-9 rounded-xl bg-amber-50 flex items-center justify-center text-lg">💰</span>
            <div className="text-left">
              <p className="text-sm font-semibold text-gray-900">Famille en Or — curation</p>
              <p className="text-xs text-gray-400">Regrouper les réponses du sondage par question</p>
            </div>
          </div>
          <svg className="h-4 w-4 text-gray-400 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
          </svg>
        </button>
      </div>

      {/* Filters */}
      <div className="bg-white border-b border-gray-100 px-4 py-3 space-y-2.5 shrink-0 mt-3">
        <div className="relative">
          <svg className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400 pointer-events-none"
            fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <circle cx="11" cy="11" r="8" /><path strokeLinecap="round" strokeLinejoin="round" d="m21 21-4.35-4.35" />
          </svg>
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Rechercher par nom ou email…"
            className="w-full pl-9 pr-4 py-2.5 rounded-xl bg-gray-100 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
          />
        </div>

        <div className="flex gap-2 overflow-x-auto pb-0.5 no-scrollbar">
          <Select
            value={statusFilter}
            onChange={e => setStatusFilter(e.target.value)}
            placeholder="Tous statuts"
            className="shrink-0 w-36"
          >
            <option value="active">Actif</option>
            <option value="pending">En attente</option>
            <option value="none">Sans compte</option>
          </Select>

          <Select
            value={typeFilter}
            onChange={e => setTypeFilter(e.target.value)}
            placeholder="Tous types"
            className="shrink-0 w-36"
          >
            <option value="autonomous">Autonome</option>
            <option value="managed">Géré</option>
            <option value="deceased">Décédé</option>
          </Select>

          <Select
            value={familyFilter}
            onChange={e => setFamilyFilter(e.target.value)}
            placeholder="Toutes familles"
            className="shrink-0 w-40"
          >
            <option value="__none__">Sans famille</option>
            {families.map(f => <option key={f.id} value={f.id}>{f.name}</option>)}
          </Select>
        </div>

        {filtered.length !== overview.length && (
          <p className="text-xs text-gray-400">
            {filtered.length} résultat{filtered.length > 1 ? 's' : ''} sur {overview.length}
          </p>
        )}
      </div>

      {/* List */}
      <div className="flex-1 px-4 py-3 space-y-2">
        {loading ? (
          <div className="flex justify-center py-16">
            <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
          </div>
        ) : filtered.length === 0 ? (
          <div className="py-16 text-center text-gray-400 text-sm">Aucun membre trouvé</div>
        ) : (
          <>
            {paginated.map(m => (
              <MemberCard
                key={m.id}
                member={m}
                onNavigate={() => navigate(`/profile/${m.id}`)}
                onInvite={() => setInviteTarget(m)}
                onCopyLink={() => handleCopyLink(m)}
                onManage={() => { setManagerTarget(m); loadActiveUsers() }}
                onToggleAdmin={() => handleToggleAdmin(m)}
                currentUserId={user?.id}
              />
            ))}

            {totalPages > 1 && (
              <div className="flex items-center justify-center gap-3 py-4">
                <button
                  onClick={() => setPage(p => Math.max(1, p - 1))}
                  disabled={page === 1}
                  className="h-9 w-9 rounded-xl border border-gray-200 flex items-center justify-center text-gray-500 disabled:opacity-40 active:bg-gray-50"
                >
                  <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
                  </svg>
                </button>
                <span className="text-sm text-gray-600 font-medium">{page} / {totalPages}</span>
                <button
                  onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                  disabled={page === totalPages}
                  className="h-9 w-9 rounded-xl border border-gray-200 flex items-center justify-center text-gray-500 disabled:opacity-40 active:bg-gray-50"
                >
                  <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                  </svg>
                </button>
              </div>
            )}
          </>
        )}
      </div>

      {inviteTarget && (
        <InviteModal
          member={inviteTarget}
          onClose={() => setInviteTarget(null)}
          onInvited={(token) => {
            updateMember(inviteTarget.id, { accountStatus: 'pending', invitationToken: token })
            setInviteTarget(null)
            showToast('Invitation envoyée !')
          }}
        />
      )}

      {managerTarget && (
        <ManagerModal
          member={managerTarget}
          activeUsers={activeUsers}
          onClose={() => setManagerTarget(null)}
          onSaved={(delegateManagerId, delegateManagerName) => {
            updateMember(managerTarget.id, { delegateManagerId, delegateManagerName })
            setManagerTarget(null)
            showToast(delegateManagerId ? 'Gestionnaire assigné !' : 'Gestionnaire retiré.')
          }}
        />
      )}

      {toast && (
        <div className={`fixed bottom-24 left-1/2 -translate-x-1/2 z-[9999] px-5 py-2.5 rounded-2xl text-sm font-medium shadow-lg whitespace-nowrap ${toast.type === 'error' ? 'bg-red-500 text-white' : 'bg-gray-900 text-white'}`}>
          {toast.msg}
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


function MemberCard({ member: m, onNavigate, onInvite, onCopyLink, onManage, onToggleAdmin, currentUserId }) {
  const st = STATUS_CONFIG[m.accountStatus] ?? STATUS_CONFIG.none
  const canInvite = m.accountStatus === 'none' || m.accountStatus === 'pending'
  const canCopyLink = m.accountStatus === 'pending' && !!m.invitationToken
  const isActiveUser = m.accountStatus === 'active' && !!m.userId
  const isSelf = m.userId && String(m.userId) === String(currentUserId)
  const isAdmin = m.userRole === 'Admin'

  return (
    <div className="bg-white rounded-2xl p-4 shadow-sm border border-gray-100">
      <div className="flex items-start gap-3">
        <button onClick={onNavigate} className="shrink-0 active:opacity-70">
          <Avatar member={m} size={44} />
        </button>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5 flex-wrap">
            <button onClick={onNavigate} className="font-semibold text-gray-900 text-sm hover:underline text-left">
              {m.firstName} {m.lastName}
            </button>
            {isAdmin && (
              <span className="text-xs bg-amber-100 text-amber-700 rounded-full px-2 py-0.5 font-medium">Admin</span>
            )}
            {!m.isAlive && (
              <span className="text-xs bg-gray-100 text-gray-500 rounded-full px-2 py-0.5">Décédé(e)</span>
            )}
            {!!m.email && m.accountStatus === 'none' && (
              <span title="Peut être invité(e)" className="text-xs text-blue-400">✉</span>
            )}
          </div>
          {m.familyName && (
            <p className="text-xs text-primary/70 font-medium mt-0.5">{m.familyName}</p>
          )}
          {m.email && (
            <p className="text-xs text-gray-400 truncate mt-0.5">{m.email}</p>
          )}
          {m.delegateManagerName && (
            <p className="text-xs text-indigo-600 mt-0.5">Géré par {m.delegateManagerName}</p>
          )}
        </div>
        <span className={`shrink-0 text-xs px-2.5 py-1 rounded-full font-medium ${st.cls}`}>
          {st.label}
        </span>
      </div>

      <div className="flex items-center gap-1.5 mt-3 pt-3 border-t border-gray-50 flex-wrap">
        <ActionBtn icon={<EyeIcon />} label="Profil" onClick={onNavigate} />
        {canInvite && (
          <ActionBtn
            icon={m.accountStatus === 'pending' ? <RefreshIcon /> : m.email ? <MailIcon /> : <LinkIcon />}
            label={m.accountStatus === 'pending' ? (m.email ? 'Renvoyer' : 'Renouveler') : m.email ? 'Inviter' : 'Créer lien'}
            onClick={onInvite}
            color={m.accountStatus === 'pending' ? 'text-amber-600 bg-amber-50' : m.email ? 'text-blue-600 bg-blue-50' : 'text-violet-600 bg-violet-50'}
          />
        )}
        {canCopyLink && (
          <ActionBtn icon={<LinkIcon />} label="Lien" onClick={onCopyLink} color="text-violet-600 bg-violet-50" />
        )}
        <div className="ml-auto flex items-center gap-1.5">
          {isActiveUser && !isSelf && (
            <ActionBtn
              icon={<ShieldIcon />}
              label={isAdmin ? 'Retirer admin' : 'Rendre admin'}
              onClick={onToggleAdmin}
              color={isAdmin ? 'text-amber-600 bg-amber-50' : 'text-gray-600 bg-gray-100'}
            />
          )}
          <ActionBtn icon={<PersonIcon />} label="Gestionnaire" onClick={onManage} color="text-gray-600 bg-gray-100" />
        </div>
      </div>
    </div>
  )
}

function ActionBtn({ icon, label, onClick, color = 'text-gray-500 bg-gray-50' }) {
  return (
    <button
      onClick={onClick}
      className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl text-xs font-medium active:scale-95 transition-transform ${color}`}
    >
      <span className="h-3.5 w-3.5 shrink-0">{icon}</span>
      {label}
    </button>
  )
}

function InviteModal({ member, onClose, onInvited }) {
  const [role, setRole] = useState('Member')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const [generatedToken, setGeneratedToken] = useState(null)
  const [copied, setCopied] = useState(false)

  const isResend = member.accountStatus === 'pending'
  const hasEmail = !!member.email

  const inviteLink = generatedToken ? `${window.location.origin}/invite/${generatedToken}` : ''
  const inviteMessage = generatedToken
    ? `Bonjour ${member.firstName} !\n\nTu es invité(e) à rejoindre notre espace famille sur MyBigFamily.\n\nCrée ton compte en cliquant sur ce lien :\n${inviteLink}\n\nCe lien est à usage unique.`
    : ''

  async function handleSubmit() {
    setLoading(true)
    setError(null)
    try {
      const { data } = await adminApi.generateInvitation(
        member.email || null,
        role,
        member.id,
        window.location.origin,
        member.firstName
      )
      setGeneratedToken(data.token)
    } catch (e) {
      setError(e.response?.data?.message ?? "Erreur lors de l'envoi.")
    } finally {
      setLoading(false)
    }
  }

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(inviteMessage)
      setCopied(true)
      setTimeout(() => setCopied(false), 2500)
    } catch {
      setError('Impossible de copier. Sélectionne le texte manuellement.')
    }
  }

  const RoleSelector = () => (
    <div>
      <label className="block text-sm font-medium text-gray-700 mb-2">Rôle du compte</label>
      <div className="flex gap-2">
        {[
          { value: 'Member', label: 'Membre', desc: 'Peut modifier son profil' },
          { value: 'Admin', label: 'Administrateur', desc: 'Accès complet' },
        ].map(r => (
          <button
            key={r.value}
            onClick={() => setRole(r.value)}
            className={`flex-1 py-2.5 px-3 rounded-xl text-left border transition-colors ${role === r.value ? 'bg-primary/10 border-primary text-primary' : 'bg-white text-gray-700 border-gray-200'}`}
          >
            <div className="text-sm font-medium">{r.label}</div>
            <div className="text-xs opacity-60 mt-0.5">{r.desc}</div>
          </button>
        ))}
      </div>
    </div>
  )

  return createPortal(
    <div className="fixed inset-0 z-50 flex flex-col justify-end" onClick={onClose}>
      <div className="absolute inset-0 bg-black/50" />
      <div className="relative bg-white rounded-t-3xl px-6 pt-4 pb-8 space-y-4" onClick={e => e.stopPropagation()}>
        <div className="w-12 h-1 bg-gray-200 rounded-full mx-auto mb-2" />

        <div className="flex items-center gap-3">
          <Avatar member={member} size={40} />
          <div>
            <h3 className="text-base font-bold text-gray-900">
              {isResend ? "Renouveler l'invitation" : 'Inviter'} {member.firstName}
            </h3>
            {member.email && <p className="text-xs text-gray-400">{member.email}</p>}
          </div>
        </div>

        {/* Message à copier — affiché après génération/envoi pour tous les cas */}
        {generatedToken ? (
          <>
            {hasEmail && (
              <p className="text-xs text-green-600 bg-green-50 rounded-xl px-4 py-2">
                Invitation envoyée par email à {member.email}
              </p>
            )}
            <p className="text-xs text-gray-500">Vous pouvez aussi copier ce message et l'envoyer manuellement.</p>
            <pre className="whitespace-pre-wrap break-all text-xs bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 text-gray-700 font-sans select-all">
              {inviteMessage}
            </pre>
            {error && <p className="text-sm text-red-500">{error}</p>}
            <button
              onClick={handleCopy}
              className={`w-full py-3 rounded-2xl font-semibold text-sm active:scale-[0.98] transition-all ${copied ? 'bg-green-500 text-white' : 'bg-primary text-white'}`}
            >
              {copied ? 'Copié !' : 'Copier le message'}
            </button>
            <button onClick={() => { onInvited(generatedToken); onClose() }} className="w-full py-2 text-sm text-gray-400">Fermer</button>
          </>
        ) : !hasEmail ? (
          /* Cas sans email : génération */
          <>
            <p className="text-sm text-gray-500 bg-gray-50 rounded-xl px-4 py-3">
              Ce membre n'a pas d'adresse email. Un lien d'invitation sera généré — tu pourras le copier et l'envoyer manuellement.
            </p>
            <RoleSelector />
            {error && <p className="text-sm text-red-500">{error}</p>}
            <button
              onClick={handleSubmit}
              disabled={loading}
              className="w-full py-3 rounded-2xl bg-primary text-white font-semibold text-sm disabled:opacity-60 active:scale-[0.98] transition-transform"
            >
              {loading ? 'Génération…' : isResend ? 'Renouveler le lien' : 'Générer le lien'}
            </button>
            <button onClick={onClose} className="w-full py-2 text-sm text-gray-400">Annuler</button>
          </>
        ) : (
          /* Cas avec email : envoi classique */
          <>
            <RoleSelector />
            {error && <p className="text-sm text-red-500">{error}</p>}
            <button
              onClick={handleSubmit}
              disabled={loading}
              className="w-full py-3 rounded-2xl bg-primary text-white font-semibold text-sm disabled:opacity-60 active:scale-[0.98] transition-transform"
            >
              {loading ? 'Envoi en cours…' : isResend ? "Renvoyer l'invitation" : "Envoyer l'invitation"}
            </button>
            <button onClick={onClose} className="w-full py-2 text-sm text-gray-400">Annuler</button>
          </>
        )}
      </div>
    </div>,
    document.body
  )
}

function ManagerModal({ member, activeUsers, onClose, onSaved }) {
  const [search, setSearch] = useState('')
  const [saving, setSaving] = useState(false)

  const filteredUsers = useMemo(() => {
    if (!search.trim()) return activeUsers
    return activeUsers.filter(u => matchesSearch(`${u.firstName} ${u.lastName}`, search))
  }, [activeUsers, search])

  async function handleAssign(userId) {
    setSaving(true)
    try {
      const { data } = await membersApi.setDelegateManager(member.id, userId)
      onSaved(data.delegateManagerId, data.delegateManagerName)
    } finally {
      setSaving(false)
    }
  }

  async function handleRemove() {
    setSaving(true)
    try {
      const { data } = await membersApi.setDelegateManager(member.id, null)
      onSaved(null, null)
    } finally {
      setSaving(false)
    }
  }

  return createPortal(
    <div className="fixed inset-0 z-50 flex flex-col justify-end" onClick={onClose}>
      <div className="absolute inset-0 bg-black/50" />
      <div
        className="relative bg-white rounded-t-3xl px-5 pt-4 pb-6 flex flex-col"
        style={{ maxHeight: '75vh' }}
        onClick={e => e.stopPropagation()}
      >
        <div className="w-12 h-1 bg-gray-200 rounded-full mx-auto mb-4" />

        <h3 className="text-base font-bold text-gray-900">Gestionnaire délégué</h3>
        <p className="text-xs text-gray-400 mb-4">
          Profil de {member.firstName} {member.lastName}
        </p>

        {member.delegateManagerId && (
          <div className="flex items-center justify-between bg-indigo-50 rounded-xl px-4 py-3 mb-3">
            <div>
              <p className="text-xs text-indigo-500 mb-0.5">Gestionnaire actuel</p>
              <p className="text-sm font-semibold text-indigo-700">{member.delegateManagerName}</p>
            </div>
            <button
              onClick={handleRemove}
              disabled={saving}
              className="text-xs text-red-500 font-semibold active:opacity-70 disabled:opacity-40"
            >
              Retirer
            </button>
          </div>
        )}

        <div className="relative mb-3">
          <svg className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400 pointer-events-none"
            fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <circle cx="11" cy="11" r="8" /><path strokeLinecap="round" strokeLinejoin="round" d="m21 21-4.35-4.35" />
          </svg>
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Rechercher un utilisateur actif…"
            className="w-full pl-9 pr-4 py-2.5 rounded-xl bg-gray-100 text-sm focus:outline-none"
          />
        </div>

        <div className="flex-1 overflow-y-auto space-y-0.5">
          {activeUsers.length === 0 ? (
            <div className="flex justify-center py-6">
              <div className="h-6 w-6 animate-spin rounded-full border-3 border-primary border-t-transparent" />
            </div>
          ) : filteredUsers.length === 0 ? (
            <p className="text-center text-sm text-gray-400 py-6">Aucun utilisateur trouvé</p>
          ) : filteredUsers.map(u => {
            const isCurrent = u.userId === member.delegateManagerId
            return (
              <button
                key={u.userId}
                onClick={() => !isCurrent && handleAssign(u.userId)}
                disabled={saving}
                className={`w-full flex items-center justify-between px-4 py-3 rounded-xl text-sm transition-colors ${isCurrent ? 'bg-indigo-50 cursor-default' : 'active:bg-gray-50'}`}
              >
                <span className={`font-medium ${isCurrent ? 'text-indigo-700' : 'text-gray-800'}`}>
                  {u.firstName} {u.lastName}
                </span>
                {isCurrent && (
                  <svg className="h-4 w-4 text-indigo-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                  </svg>
                )}
              </button>
            )
          })}
        </div>

        <button onClick={onClose} className="mt-4 w-full py-3 rounded-2xl bg-primary text-white font-semibold text-sm active:opacity-80 transition-opacity">Fermer</button>
      </div>
    </div>,
    document.body
  )
}

function EyeIcon() {
  return <svg fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" /><circle cx="12" cy="12" r="3" /></svg>
}
function MailIcon() {
  return <svg fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z" /><polyline points="22,6 12,13 2,6" /></svg>
}
function RefreshIcon() {
  return <svg fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><polyline points="1 4 1 10 7 10" /><path strokeLinecap="round" strokeLinejoin="round" d="M3.51 15a9 9 0 1 0 .49-3.01" /></svg>
}
function LinkIcon() {
  return <svg fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71" /><path strokeLinecap="round" strokeLinejoin="round" d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" /></svg>
}
function PersonIcon() {
  return <svg fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" /><circle cx="12" cy="7" r="4" /></svg>
}
function ShieldIcon() {
  return <svg fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" /></svg>
}
