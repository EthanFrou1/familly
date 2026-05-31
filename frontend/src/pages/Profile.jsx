import { useEffect, useMemo, useRef, useState } from 'react'
import { useParams, useNavigate, useLocation } from 'react-router-dom'
import imageCompression from 'browser-image-compression'
import { membersApi, relationsApi, adminApi, settingsApi, familiesApi, pushApi, activityLogsApi, authApi } from '../services/api'
import { getRelationshipLabel } from '../utils/relationshipUtils'
import { useAuth } from '../hooks/useAuth'
import { useMembers } from '../store/MembersContext'
import { FAMILY_PALETTE } from '../components/tree/treeLayout'
import Avatar from '../components/shared/Avatar'
import ConfirmModal from '../components/shared/ConfirmModal'
import MemberFormModal from '../components/members/MemberFormModal'
import RelationFormModal from '../components/members/RelationFormModal'
import SocialLinkModal from '../components/members/SocialLinkModal'
import { usePushNotifications } from '../hooks/usePushNotifications'

export default function Profile() {
  const { id } = useParams()
  const { user, logout } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const memberId = id ?? user?.memberId
  const fileRef = useRef(null)

  const { refresh: refreshMembers, members: allMembers } = useMembers()
  const isAdmin = user?.role === 'Admin'
  const isOwnProfile = !id || id === user?.memberId

  const [member, setMember] = useState(null)
  const [relations, setRelations] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [showEdit, setShowEdit] = useState(false)
  const [showAddRelation, setShowAddRelation] = useState(false)
  const [confirmDeleteRelation, setConfirmDeleteRelation] = useState(null) // relationId | null
  const [uploadingPhoto, setUploadingPhoto] = useState(false)
  const [accountStatus, setAccountStatus] = useState(null) // null | 'none' | 'pending' | 'active'
  const [inviteState, setInviteState] = useState('idle') // idle | loading | done | error
  const [inviteLink, setInviteLink] = useState('')
  const [copied, setCopied] = useState(false)
  const [copiedMsg, setCopiedMsg] = useState(false)
  const [familyGroupName, setFamilyGroupName] = useState(null)
  const [allRelations, setAllRelations] = useState([])
  const [linkModal, setLinkModal] = useState(null) // 'instagram' | 'facebook' | 'whatsapp' | null
  const [families, setFamilies] = useState([])
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)
  const [deleteLoading, setDeleteLoading] = useState(false)
  const [testPushState, setTestPushState] = useState('idle') // idle | loading | ok | error
  const [pushSubscribers, setPushSubscribers] = useState([])
  const [testUserIds, setTestUserIds] = useState(new Set())
  const [activeUsers, setActiveUsers] = useState([])
  const [showDelegatePicker, setShowDelegatePicker] = useState(false)
  const [delegateSaving, setDelegateSaving] = useState(false)
  const [logsPage, setLogsPage] = useState(1)
  const [logsData, setLogsData] = useState(null) // { logs, total, totalPages }
  const [logsLoading, setLogsLoading] = useState(false)
  const [showDeleteAccountConfirm, setShowDeleteAccountConfirm] = useState(false)
  const [exportingData, setExportingData] = useState(false)

  useEffect(() => {
    if (!memberId) { setError('Aucun profil associé à ce compte.'); setLoading(false); return }
    setLoading(true); setError(null)
    const requests = [membersApi.getById(memberId), relationsApi.getByMember(memberId)]
    Promise.all(requests)
      .then(([mRes, rRes]) => { setMember(mRes.data); setRelations(rRes.data) })
      .catch(err => setError(`Erreur ${err.response?.status ?? ''} — impossible de charger le profil`))
      .finally(() => setLoading(false))
  }, [memberId])

  useEffect(() => {
    if (isAdmin && id && id !== user?.memberId) {
      adminApi.getMemberAccountStatus(id)
        .then(({ data }) => setAccountStatus(data.status))
        .catch(() => {})
    }
  }, [isAdmin, id, user?.memberId])

  useEffect(() => {
    if (isAdmin && id && accountStatus === 'pending' && !inviteLink) {
      adminApi.getMemberInvitationToken(id)
        .then(({ data }) => {
          if (data.token) setInviteLink(`${window.location.origin}/invite/${data.token}`)
        })
        .catch(() => {})
    }
  }, [isAdmin, id, accountStatus])

  useEffect(() => {
    settingsApi.get().then(({ data }) => setFamilyGroupName(data.familyGroupName ?? null)).catch(() => {})
    familiesApi.getAll().then(({ data }) => setFamilies(data)).catch(() => {})
  }, [])

  useEffect(() => {
    if (!memberId) return
    relationsApi.getAll().then(({ data }) => setAllRelations(data)).catch(() => {})
  }, [memberId])

  const suggestions = useMemo(
    () => isAdmin && memberId ? computeRelationSuggestions(memberId, allRelations) : [],
    [isAdmin, memberId, allRelations]
  )

  const relationshipLabel = useMemo(() => {
    if (!id || id === user?.memberId) return null
    if (!user?.memberId || !allRelations.length || !allMembers.length) return null
    return getRelationshipLabel(allRelations, allMembers, user.memberId, id)
  }, [id, user?.memberId, allRelations, allMembers])

  function handleAddToContacts() {
    const lines = ['BEGIN:VCARD', 'VERSION:3.0']
    lines.push(`FN:${member.firstName} ${member.lastName}`)
    lines.push(`N:${member.lastName};${member.firstName};;;`)
    if (member.phone) lines.push(`TEL;TYPE=CELL:${member.phone}`)
    if (member.email) lines.push(`EMAIL;TYPE=INTERNET:${member.email}`)
    if (member.birthDate) lines.push(`BDAY:${member.birthDate.split('T')[0]}`)
    if (member.city || member.address || member.country) {
      const street = member.address || ''
      const city = member.city || ''
      const postal = member.postalCode || ''
      const country = member.country || ''
      lines.push(`ADR;TYPE=HOME:;;${street};${city};;${postal};${country}`)
    }
    if (member.familyName) lines.push(`ORG:Famille ${member.familyName}`)
    lines.push('END:VCARD')

    const blob = new Blob([lines.join('\r\n')], { type: 'text/vcard;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `${member.firstName}_${member.lastName}.vcf`
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
  }

  async function handleDelete() {
    setDeleteLoading(true)
    try {
      await membersApi.delete(memberId)
      await refreshMembers()
      navigate('/', { replace: true })
    } catch {
      setDeleteLoading(false)
      setShowDeleteConfirm(false)
      alert('Impossible de supprimer ce membre.')
    }
  }

  async function handleDeleteAccount() {
    await authApi.deleteAccount()
    logout()
    navigate('/login')
  }

  async function handleExportMyData() {
    setExportingData(true)
    try {
      const { data } = await authApi.exportMyData()
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `mybigfamily_mes_donnees_${new Date().toISOString().slice(0, 10)}.json`
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      URL.revokeObjectURL(url)
    } finally {
      setExportingData(false)
    }
  }

  async function handleEdit(form) {
    const { data } = await membersApi.update(memberId, form)
    setMember(data)
    refreshMembers()
  }

  async function handleAddRelation(payload) {
    await relationsApi.create(payload)
    const [rRes, allRRes] = await Promise.all([
      relationsApi.getByMember(memberId),
      relationsApi.getAll(),
    ])
    setRelations(rRes.data)
    setAllRelations(allRRes.data)
  }

  async function handleCreateSuggestion(payload) {
    await relationsApi.create(payload)
    const [rRes, allRRes] = await Promise.all([
      relationsApi.getByMember(memberId),
      relationsApi.getAll(),
    ])
    setRelations(rRes.data)
    setAllRelations(allRRes.data)
  }

  async function handleDeleteRelation(relationId) {
    await relationsApi.delete(relationId)
    setRelations(prev => prev.filter(r => r.id !== relationId))
    setConfirmDeleteRelation(null)
  }

  async function handleGenerateInvite() {
    setInviteState('loading')
    try {
      const { data } = await adminApi.generateInvitation(
        member.email || null, 'Member', member.id,
        window.location.origin,
        member.firstName,
        familyGroupName ?? undefined
      )
      const link = `${window.location.origin}/invite/${data.token}`
      setInviteLink(link)
      setInviteState('done')
      setAccountStatus('pending')
    } catch (err) {
      if (err.response?.status === 409) setInviteState('conflict')
      else setInviteState('error')
    }
  }

  async function handleCopyInvite() {
    await navigator.clipboard.writeText(inviteLink)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  useEffect(() => {
    if (isAdmin && isOwnProfile) {
      pushApi.getSubscribers().then(({ data }) => setPushSubscribers(data)).catch(() => {})
    }
  }, [isAdmin, isOwnProfile])

  useEffect(() => {
    if (isAdmin && id && id !== user?.memberId) {
      adminApi.getActiveUsers().then(({ data }) => setActiveUsers(data)).catch(() => {})
    }
  }, [isAdmin, id, user?.memberId])

  useEffect(() => {
    if (!isAdmin || !memberId) return
    setLogsLoading(true)
    activityLogsApi.getByMember(memberId, logsPage)
      .then(({ data }) => setLogsData(data))
      .catch(() => {})
      .finally(() => setLogsLoading(false))
  }, [isAdmin, memberId, logsPage])

  async function handleSetDelegate(userId) {
    setDelegateSaving(true)
    try {
      const { data } = await membersApi.setDelegateManager(memberId, userId ?? null)
      setMember(data)
      setShowDelegatePicker(false)
    } finally {
      setDelegateSaving(false)
    }
  }

  function toggleTestUser(userId) {
    setTestUserIds(prev => {
      const next = new Set(prev)
      next.has(userId) ? next.delete(userId) : next.add(userId)
      return next
    })
  }

  async function handleTestPush() {
    if (testUserIds.size === 0) return
    setTestPushState('loading')
    try {
      await pushApi.sendTest([...testUserIds])
      setTestPushState('ok')
      setTimeout(() => setTestPushState('idle'), 4000)
    } catch {
      setTestPushState('error')
      setTimeout(() => setTestPushState('idle'), 4000)
    }
  }

  async function handleCopyInviteMessage() {
    const greeting = familyGroupName
      ? `Bonjour ${member.firstName} ! Tu es invité(e) à rejoindre la Famille ${familyGroupName}.\n\n`
      : `Bonjour ${member.firstName} ! Tu es invité(e) à rejoindre notre espace famille.\n\n`
    const msg = `${greeting}Crée ton compte en cliquant sur ce lien :\n${inviteLink}`
    await navigator.clipboard.writeText(msg)
    setCopiedMsg(true)
    setTimeout(() => setCopiedMsg(false), 2000)
  }

  async function handlePhotoChange(e) {
    const file = e.target.files[0]
    if (!file) return
    setUploadingPhoto(true)
    try {
      const compressed = await imageCompression(file, { maxSizeMB: 0.4, maxWidthOrHeight: 800 })
      const { data } = await membersApi.updateProfilePicture(memberId, compressed)
      setMember(prev => ({ ...prev, profilePictureUrl: data.profilePictureUrl }))
    } finally { setUploadingPhoto(false); e.target.value = '' }
  }

  const familyColor = useMemo(() => {
    if (!member?.familyId || !families.length) return null
    const idx = families.findIndex(f => f.id === member.familyId)
    return idx >= 0 ? FAMILY_PALETTE[idx % FAMILY_PALETTE.length] : null
  }, [member?.familyId, families])

  const { supported: pushSupported, subscribed, blocked: pushBlocked, loading: pushLoading, subscribe, unsubscribe } = usePushNotifications()

  if (loading) return <div className="flex h-full items-center justify-center"><div className="h-10 w-10 animate-spin rounded-full border-4 border-primary border-t-transparent" /></div>
  if (error) return <div className="flex h-full flex-col items-center justify-center px-6 text-center"><p className="text-gray-400 text-sm">{error}</p></div>
  if (!member) return <div className="flex h-full items-center justify-center text-gray-400">Membre introuvable</div>

  const fullName = `${member.firstName} ${member.lastName}`
  const isDelegateManager = !isAdmin && !isOwnProfile && member?.delegateManagerId && user?.id === member.delegateManagerId
  const canEdit = isAdmin || isOwnProfile || isDelegateManager

  const spouseRelation = relations.find(r => r.type === 'Spouse')
  const separatedRelation = !spouseRelation ? relations.find(r => r.type === 'Separated') : null
  const marriedLabel = spouseRelation
    ? `${member.gender === 'F' ? 'Mariée à' : member.gender === 'M' ? 'Marié à' : 'Marié(e) à'} ${spouseRelation.relatedMemberName.split(' ')[0]}`
    : null
  const separatedLabel = separatedRelation
    ? `${member.gender === 'F' ? 'Séparée de' : member.gender === 'M' ? 'Séparé de' : 'Séparé(e) de'} ${separatedRelation.relatedMemberName.split(' ')[0]}`
    : null

  const pieceRapporteeLabel = !member.familyId && !spouseRelation ? 'Pièce rapportée' : null
  const isDeceased = !member.isAlive
  const ageAtDeath = (isDeceased && member.birthDate && member.deathDate)
    ? Math.floor((new Date(member.deathDate) - new Date(member.birthDate)) / (365.25 * 24 * 3600 * 1000))
    : null
  const age = isDeceased
    ? ageAtDeath
    : (member.birthDate ? Math.floor((Date.now() - new Date(member.birthDate)) / (365.25 * 24 * 3600 * 1000)) : null)
  const birthYear = member.birthDate ? new Date(member.birthDate).getFullYear() : null
  const deathYear = member.deathDate ? new Date(member.deathDate).getFullYear() : null
  const lifespan = birthYear && deathYear ? `${birthYear} – ${deathYear}` : (birthYear ? `${birthYear}` : null)
  const whatsappHref = member.whatsappNumber
    ? `https://wa.me/${member.whatsappNumber.replace(/[\s+\-()]/g, '').replace(/^(\d{1,3})0(\d{8,})$/, '$1$2')}`
    : null

  return (
    <div className="overflow-y-auto h-full bg-gray-50 pb-8 animate-fade-in">

      {/* Header */}
      <div className={`${isDeceased ? (member.gender === 'F' ? 'bg-pink-950' : 'bg-blue-950') : 'bg-dark'} flex flex-col items-center gap-3 overflow-hidden relative`}>
        {/* Bande couleur famille */}
        <div
          className="w-full h-2 shrink-0"
          style={{ background: familyColor ? familyColor.border : 'transparent' }}
        />

        {/* Bouton retour vers la liste des membres */}
        {location.state?.from === '/members' && (
          <button
            onClick={() => navigate('/members')}
            className="absolute top-6 left-4 flex items-center gap-1 rounded-full bg-white/10 border border-white/20 px-3 py-1.5 text-xs font-semibold text-white active:bg-white/20 transition-colors"
          >
            <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
            </svg>
            Membres
          </button>
        )}

        {/* Bouton ajouter contact — haut droite */}
        {!isOwnProfile && member?.phone && (
          <button
            onClick={handleAddToContacts}
            className="absolute top-6 right-4 flex items-center gap-1.5 rounded-full bg-white/10 border border-white/20 px-3 py-1.5 text-xs font-semibold text-white active:bg-white/20 transition-colors"
          >
            <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
              <circle cx="9" cy="7" r="4" />
              <line x1="19" y1="8" x2="19" y2="14" />
              <line x1="22" y1="11" x2="16" y2="11" />
            </svg>
            Ajouter
          </button>
        )}

        <div className="px-5 pb-8 pt-4 flex flex-col items-center gap-3 w-full">
        <div className={`relative ${isDeceased ? 'grayscale opacity-75' : ''}`}>
          <Avatar src={member.profilePictureUrl} name={fullName} size="xl" />
          {canEdit && !isDeceased && (
            <button onClick={() => fileRef.current?.click()} disabled={uploadingPhoto}
              className="absolute bottom-0 right-0 h-8 w-8 rounded-full bg-primary text-white flex items-center justify-center shadow-md active:scale-95 transition-transform">
              {uploadingPhoto
                ? <div className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
                : <CameraIcon />}
            </button>
          )}
          <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={handlePhotoChange} />
        </div>

        <div className="text-center">
          <h1 className="text-2xl font-bold text-white">{fullName}</h1>
          <p className="text-white/70 text-sm mt-0.5">
            {isDeceased
              ? [lifespan, age && `${age} ans`, member.city].filter(Boolean).join(' · ')
              : [age && `${age} ans`, member.city, member.country].filter(Boolean).join(' · ')
            }
          </p>
          <div className="flex flex-wrap justify-center items-center gap-2 mt-2">
            {isDeceased ? (
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-white/10 text-white/60 border border-white/15">
                <span>†</span>
                {member.deathDate
                  ? `Décédé(e) le ${new Date(member.deathDate).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' })}`
                  : 'Décédé(e)'}
              </span>
            ) : familyColor && member.familyName ? (
              <span
                className="inline-block px-3 py-0.5 rounded-full text-xs font-bold"
                style={{ background: familyColor.bg, color: familyColor.text, border: `1.5px solid ${familyColor.border}` }}
              >
                {member.familyName}
              </span>
            ) : pieceRapporteeLabel ? (
              <span className="inline-block px-3 py-0.5 rounded-full text-xs font-semibold bg-white/10 text-white/80 border border-white/20">
                {pieceRapporteeLabel}
              </span>
            ) : null}
            {marriedLabel && (
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-pink-500/20 text-white border border-pink-400/30">
                💍 {marriedLabel}
              </span>
            )}
            {separatedLabel && (
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-white/10 text-white/70 border border-white/20">
                {separatedLabel}
              </span>
            )}
            {relationshipLabel && (
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-primary/20 text-white border border-primary/30">
                <svg className="h-3 w-3 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
                </svg>
                {relationshipLabel}
              </span>
            )}
          </div>
        </div>

        {/* Actions rapides — masquées pour les membres décédés */}
        {!isDeceased && (member.phone || member.email || whatsappHref || member.instagramUsername || member.facebookUrl) && (
          <div className="flex flex-wrap justify-center gap-3 mt-1">
            {member.phone && (
              <ActionBtn href={`tel:${member.phone}`} label="Appeler" color="bg-emerald-500">
                <PhoneIcon />
              </ActionBtn>
            )}
            {whatsappHref && (
              <ActionBtn href={whatsappHref} label="WhatsApp" color="bg-[#25D366]">
                <WhatsappIcon />
              </ActionBtn>
            )}
            {member.email && (
              <ActionBtn href={`mailto:${member.email}`} label="Email" color="bg-sky-500">
                <MailIcon />
              </ActionBtn>
            )}
            {member.instagramUsername && (
              <ActionBtn href={`https://instagram.com/${member.instagramUsername.replace('@', '')}`} label="Instagram" color="bg-gradient-to-br from-[#f09433] via-[#dc2743] to-[#bc1888]">
                <InstagramIcon />
              </ActionBtn>
            )}
            {member.facebookUrl && (
              <ActionBtn href={member.facebookUrl.startsWith('http') ? member.facebookUrl : `https://facebook.com/${member.facebookUrl}`} label="Facebook" color="bg-[#1877F2]">
                <FacebookIcon />
              </ActionBtn>
            )}
          </div>
        )}

        {canEdit && (
          <button onClick={() => setShowEdit(true)}
            className="flex items-center gap-1.5 rounded-full border border-white/30 px-4 py-1.5 text-sm text-white active:bg-white/10 transition-colors mt-1">
            <EditIcon />
            Modifier
          </button>
        )}
        </div>
      </div>

      <div className="px-4 py-5 space-y-4">

        {/* Infos personnelles */}
        <Card title="Informations">
          <div className="divide-y divide-gray-50">
            {member.birthDate && (
              <InfoRow icon={<CakeIcon />}
                label={new Date(member.birthDate).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' })}
                sub={isDeceased ? 'Date de naissance' : (age ? `${age} ans` : null)} />
            )}
            {isDeceased && member.deathDate && (
              <InfoRow icon={<MemorialIcon />}
                label={new Date(member.deathDate).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' })}
                sub={ageAtDeath ? `Décédé(e) à ${ageAtDeath} ans` : 'Date de décès'} />
            )}
            {member.occupation && <InfoRow icon={<BriefcaseIcon />} label={member.occupation} />}
            {member.sport && <InfoRow icon={<SportIcon />} label={member.sport} />}
            {(member.city || member.country) && (
              <InfoRow icon={<PinIcon />}
                label={[member.city, member.postalCode && `(${member.postalCode})`].filter(Boolean).join(' ')}
                sub={[member.address, member.country].filter(Boolean).join(' · ')} />
            )}
            {member.phone && <InfoRow icon={<PhoneIcon />} label={member.phone} href={`tel:${member.phone}`} />}
            {member.email && <InfoRow icon={<MailIcon />} label={member.email} href={`mailto:${member.email}`} />}
            {!member.birthDate && !member.occupation && !member.sport && !member.city && !member.phone && !member.email && (
              <p className="text-sm text-gray-400 py-2">Aucune information renseignée.</p>
            )}
          </div>
        </Card>

        {/* Réseaux sociaux */}
        {!isDeceased && (canEdit || member.facebookUrl || member.instagramUsername || member.whatsappNumber) && (
          <Card title="Réseaux sociaux">
            {canEdit ? (
              <div className="divide-y divide-gray-50">
                <SocialRow
                  icon={<InstagramIcon />} label="Instagram"
                  iconBg="bg-gradient-to-br from-[#f09433] via-[#dc2743] to-[#bc1888]"
                  value={member.instagramUsername} displayValue={member.instagramUsername ? `@${member.instagramUsername.replace('@', '')}` : null}
                  href={member.instagramUsername ? `https://instagram.com/${member.instagramUsername.replace('@', '')}` : null}
                  onLink={() => setLinkModal('instagram')}
                />
                <SocialRow
                  icon={<FacebookIcon />} label="Facebook"
                  iconBg="bg-[#1877F2]"
                  value={member.facebookUrl} displayValue={member.facebookUrl || null}
                  href={member.facebookUrl ? (member.facebookUrl.startsWith('http') ? member.facebookUrl : `https://${member.facebookUrl}`) : null}
                  onLink={() => setLinkModal('facebook')}
                />
                <SocialRow
                  icon={<WhatsappIcon />} label="WhatsApp"
                  iconBg="bg-[#25D366]"
                  value={member.whatsappNumber} displayValue={member.whatsappNumber || null}
                  href={whatsappHref}
                  onLink={() => setLinkModal('whatsapp')}
                />
              </div>
            ) : (
              <div className="flex gap-3">
                {member.facebookUrl && (
                  <SocialBtn href={member.facebookUrl.startsWith('http') ? member.facebookUrl : `https://${member.facebookUrl}`}
                    label="Facebook" color="bg-[#1877F2]" icon={<FacebookIcon />} />
                )}
                {member.instagramUsername && (
                  <SocialBtn href={`https://instagram.com/${member.instagramUsername.replace('@', '')}`}
                    label="Instagram" color="bg-gradient-to-br from-[#f09433] via-[#dc2743] to-[#bc1888]" icon={<InstagramIcon />} />
                )}
                {member.whatsappNumber && (
                  <SocialBtn href={whatsappHref} label="WhatsApp" color="bg-[#25D366]" icon={<WhatsappIcon />} />
                )}
              </div>
            )}
          </Card>
        )}

        {/* Liens familiaux */}
        {(relations.length > 0 || isAdmin) && (
          <Card
            title="Famille"
            action={isAdmin && (
              <button onClick={() => setShowAddRelation(true)}
                className="flex items-center gap-1 text-xs font-semibold text-primary active:opacity-70">
                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
                </svg>
                Ajouter
              </button>
            )}
          >
            {relations.length === 0 ? (
              <p className="text-sm text-gray-400 py-1">Aucun lien familial renseigné.</p>
            ) : (
              <div className="space-y-1">
                {relations.map(rel => (
                  <div key={rel.id} className="flex items-center justify-between py-2">
                    <button onClick={() => navigate(`/profile/${rel.relatedMemberId}`)}
                      className="flex items-center gap-2 flex-1 text-left active:opacity-70">
                      <span className="text-sm font-medium text-gray-900">{rel.relatedMemberName}</span>
                      <span className="text-xs font-medium text-primary bg-primary/10 rounded-full px-2.5 py-0.5">{rel.typeLabel}</span>
                    </button>
                    {isAdmin && (
                      <button onClick={() => setConfirmDeleteRelation(rel.id)}
                        className="ml-2 p-1.5 text-gray-300 active:text-red-400 transition-colors">
                        <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                        </svg>
                      </button>
                    )}
                  </div>
                ))}
              </div>
            )}
          </Card>
        )}

        {/* Suggestions de liens — admin uniquement */}
        {isAdmin && suggestions.length > 0 && (
          <Card
            title="Liens suggérés"
            action={
              <span className="text-[10px] font-semibold text-primary bg-primary/10 rounded-full px-2 py-0.5">
                {suggestions.length} suggestion{suggestions.length > 1 ? 's' : ''}
              </span>
            }
          >
            <div className="space-y-2">
              {suggestions.map(s => (
                <SuggestionRow key={`${s.relType}|${s.relatedId}`} suggestion={s} onAccept={handleCreateSuggestion} />
              ))}
            </div>
          </Card>
        )}

        {/* Gestion déléguée — admin uniquement, profil d'un autre membre */}
        {isAdmin && id && id !== user?.memberId && (
          <Card title="Gestion déléguée">
            {!showDelegatePicker ? (
              <div className="space-y-3">
                {member.delegateManagerId ? (
                  <div className="flex items-center gap-3 rounded-xl bg-primary/6 border border-primary/15 px-3 py-2.5">
                    <span className="h-8 w-8 rounded-full bg-primary/15 flex items-center justify-center shrink-0">
                      <svg className="h-4 w-4 text-primary" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M16 21v-2a4 4 0 00-4-4H6a4 4 0 00-4 4v2M12 11a4 4 0 100-8 4 4 0 000 8z" />
                      </svg>
                    </span>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs text-gray-500">Gestionnaire actuel</p>
                      <p className="text-sm font-semibold text-gray-900 truncate">{member.delegateManagerName}</p>
                    </div>
                  </div>
                ) : (
                  <div className="flex items-center gap-3 py-1">
                    <span className="h-2.5 w-2.5 rounded-full bg-gray-300 shrink-0" />
                    <p className="text-sm text-gray-500">Aucun gestionnaire délégué.</p>
                  </div>
                )}
                <p className="text-xs text-gray-400 leading-relaxed">
                  Un gestionnaire peut modifier ce profil (informations, photo, réseaux sociaux) même sans être admin.
                </p>
                <div className="flex gap-2">
                  <button
                    onClick={() => setShowDelegatePicker(true)}
                    className="flex-1 rounded-xl bg-primary py-2.5 text-sm font-semibold text-white active:opacity-80"
                  >
                    {member.delegateManagerId ? 'Changer' : 'Désigner un gestionnaire'}
                  </button>
                  {member.delegateManagerId && (
                    <button
                      onClick={() => handleSetDelegate(null)}
                      disabled={delegateSaving}
                      className="rounded-xl border border-red-200 px-4 py-2.5 text-sm font-medium text-red-500 active:bg-red-50 disabled:opacity-50"
                    >
                      {delegateSaving ? '…' : 'Retirer'}
                    </button>
                  )}
                </div>
              </div>
            ) : (
              <div className="space-y-3">
                <p className="text-xs text-gray-500">Sélectionne le membre qui pourra gérer ce profil :</p>
                <div className="space-y-1.5 max-h-52 overflow-y-auto">
                  {activeUsers.filter(u => u.memberId !== memberId).map(u => {
                    const isCurrentDelegate = u.userId === member.delegateManagerId
                    return (
                      <button
                        key={u.userId}
                        type="button"
                        onClick={() => handleSetDelegate(u.userId)}
                        disabled={delegateSaving}
                        className={`flex items-center gap-3 w-full rounded-xl px-3 py-2.5 text-left transition-colors disabled:opacity-50 ${
                          isCurrentDelegate
                            ? 'bg-primary/8 border border-primary/25'
                            : 'bg-gray-50 border border-transparent active:bg-gray-100'
                        }`}
                      >
                        <span className={`h-4 w-4 rounded flex items-center justify-center shrink-0 border transition-colors ${
                          isCurrentDelegate ? 'bg-primary border-primary' : 'border-gray-300 bg-white'
                        }`}>
                          {isCurrentDelegate && (
                            <svg className="h-3 w-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                              <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                            </svg>
                          )}
                        </span>
                        <span className="text-sm font-medium text-gray-800">
                          {u.firstName} {u.lastName}
                        </span>
                      </button>
                    )
                  })}
                  {activeUsers.filter(u => u.memberId !== memberId).length === 0 && (
                    <p className="text-sm text-gray-400 py-2">Aucun utilisateur actif disponible.</p>
                  )}
                </div>
                <button
                  type="button"
                  onClick={() => setShowDelegatePicker(false)}
                  className="w-full rounded-xl border border-gray-200 py-2.5 text-sm font-medium text-gray-600 active:bg-gray-50"
                >
                  Annuler
                </button>
              </div>
            )}
          </Card>
        )}

        {/* Accès à l'application — admin uniquement, profil d'un autre membre vivant */}
        {isAdmin && !isDeceased && id && id !== user?.memberId && accountStatus !== null && (
          <Card title="Accès à l'application">
            {accountStatus === 'active' && (
              <div className="flex items-center gap-3 py-1">
                <span className="h-2.5 w-2.5 rounded-full bg-emerald-400 shrink-0" />
                <p className="text-sm text-gray-700">Ce membre a un compte actif.</p>
              </div>
            )}

            {accountStatus === 'none' && !member.email && inviteState === 'idle' && (
              <div className="space-y-3">
                <div className="flex items-center gap-3">
                  <span className="h-2.5 w-2.5 rounded-full bg-gray-300 shrink-0" />
                  <p className="text-sm text-gray-700">Aucun compte — pas encore d'accès à l'appli.</p>
                </div>
                <p className="text-xs text-gray-400">Ce membre n'a pas d'email. Un lien sera généré — vous pourrez le copier et l'envoyer manuellement.</p>
                <button onClick={handleGenerateInvite}
                  className="w-full rounded-xl bg-primary py-2.5 text-sm font-semibold text-white active:bg-primary-dark">
                  Générer un lien d'invitation
                </button>
              </div>
            )}

            {accountStatus === 'none' && member.email && inviteState === 'idle' && (
              <div className="space-y-3">
                <div className="flex items-center gap-3">
                  <span className="h-2.5 w-2.5 rounded-full bg-gray-300 shrink-0" />
                  <p className="text-sm text-gray-700">Aucun compte — pas encore d'accès à l'appli.</p>
                </div>
                <button onClick={handleGenerateInvite}
                  className="w-full rounded-xl bg-primary py-2.5 text-sm font-semibold text-white active:bg-primary-dark">
                  Envoyer une invitation
                </button>
              </div>
            )}

            {accountStatus === 'pending' && inviteState === 'idle' && (
              <div className="space-y-3">
                <div className="flex items-center gap-3">
                  <span className="h-2.5 w-2.5 rounded-full bg-amber-400 shrink-0" />
                  <p className="text-sm text-gray-700">Invitation envoyée — en attente d'activation.</p>
                </div>

                {/* WhatsApp with existing link */}
                {inviteLink && (member.whatsappNumber || member.phone) && (() => {
                  const phone = (member.whatsappNumber || member.phone).replace(/[\s+\-()]/g, '')
                  const msg = familyGroupName
                    ? `Bonjour ${member.firstName} ! Tu es invité(e) à rejoindre la Famille ${familyGroupName} sur MyBigFamily.\n\nCrée ton compte ici :\n${inviteLink}`
                    : `Bonjour ${member.firstName} ! Tu es invité(e) à rejoindre notre espace famille sur MyBigFamily.\n\nCrée ton compte ici :\n${inviteLink}`
                  return (
                    <a
                      href={`https://wa.me/${phone}?text=${encodeURIComponent(msg)}`}
                      target="_blank" rel="noopener noreferrer"
                      className="flex items-center justify-center gap-2 w-full rounded-xl bg-[#25D366] py-2.5 text-xs font-semibold text-white active:opacity-80"
                    >
                      <svg viewBox="0 0 24 24" fill="currentColor" className="h-4 w-4">
                        <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51a12.8 12.8 0 00-.57-.01c-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
                      </svg>
                      Envoyer via WhatsApp
                    </a>
                  )
                })()}

                {inviteLink && (
                  <button onClick={handleCopyInviteMessage}
                    className="w-full rounded-xl bg-primary/10 py-2.5 text-sm font-semibold text-primary active:bg-primary/20">
                    {copiedMsg ? 'Message copié !' : 'Copier le message d\'invitation'}
                  </button>
                )}
                {member.email && (
                  <button onClick={handleGenerateInvite}
                    className="w-full rounded-xl border border-gray-200 py-2.5 text-sm font-medium text-gray-600 active:bg-gray-50">
                    Regénérer le lien (renvoie l'email)
                  </button>
                )}
              </div>
            )}

            {inviteState === 'loading' && (
              <p className="text-sm text-gray-400 text-center py-1">Génération du lien...</p>
            )}

            {inviteState === 'done' && (
              <div className="space-y-2">
                {member.email && (
                  <div className="flex items-center gap-2 rounded-xl bg-emerald-50 border border-emerald-100 px-3 py-2.5">
                    <svg className="h-4 w-4 text-emerald-500 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                    </svg>
                    <p className="text-xs font-semibold text-emerald-700">Email envoyé à {member.email}</p>
                  </div>
                )}

                {/* Partage WhatsApp */}
                {(member.whatsappNumber || member.phone) && (() => {
                  const phone = (member.whatsappNumber || member.phone).replace(/[\s+\-()]/g, '')
                  const msg = familyGroupName
                    ? `Bonjour ${member.firstName} ! Tu es invité(e) à rejoindre la Famille ${familyGroupName} sur MyBigFamily.\n\nCrée ton compte ici :\n${inviteLink}`
                    : `Bonjour ${member.firstName} ! Tu es invité(e) à rejoindre notre espace famille sur MyBigFamily.\n\nCrée ton compte ici :\n${inviteLink}`
                  return (
                    <a
                      href={`https://wa.me/${phone}?text=${encodeURIComponent(msg)}`}
                      target="_blank" rel="noopener noreferrer"
                      className="flex items-center justify-center gap-2 w-full rounded-xl bg-[#25D366] py-2.5 text-xs font-semibold text-white active:opacity-80"
                    >
                      <svg viewBox="0 0 24 24" fill="currentColor" className="h-4 w-4">
                        <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51a12.8 12.8 0 00-.57-.01c-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
                      </svg>
                      Envoyer via WhatsApp
                    </a>
                  )
                })()}

                {/* Copier message + lien seul */}
                <div className="rounded-xl bg-gray-50 border border-gray-100 px-3 py-3 space-y-2">
                  <p className="text-xs font-semibold text-gray-600">Message à copier</p>
                  <p className="text-xs text-gray-500 leading-relaxed whitespace-pre-line break-all">
                    {familyGroupName
                      ? `Bonjour ${member.firstName} ! Tu es invité(e) à rejoindre la Famille ${familyGroupName}.\n\nCrée ton compte ici :\n${inviteLink}`
                      : `Bonjour ${member.firstName} ! Tu es invité(e) à rejoindre notre espace famille.\n\nCrée ton compte ici :\n${inviteLink}`}
                  </p>
                  <button
                    onClick={handleCopyInviteMessage}
                    className="w-full rounded-lg bg-primary/10 py-2 text-xs font-semibold text-primary active:bg-primary/20"
                  >
                    {copiedMsg ? 'Message copié !' : 'Copier le message'}
                  </button>
                </div>
                <div className="flex items-center gap-2 bg-gray-50 rounded-xl border border-gray-200 px-3 py-2">
                  <span className="flex-1 text-xs text-gray-400 truncate font-mono">{inviteLink}</span>
                  <button onClick={handleCopyInvite} className="shrink-0 text-xs font-semibold text-primary">
                    {copied ? 'Copié !' : 'Lien seul'}
                  </button>
                </div>
              </div>
            )}

            {inviteState === 'conflict' && (
              <p className="text-sm text-center text-amber-600 bg-amber-50 rounded-xl px-3 py-2">
                Ce membre a déjà un compte actif.
              </p>
            )}

            {inviteState === 'error' && (
              <p className="text-sm text-center text-red-500 bg-red-50 rounded-xl px-3 py-2">
                Erreur — réessayez plus tard.
              </p>
            )}
          </Card>
        )}

        {/* Notifications — propre profil uniquement */}
        {isOwnProfile && (
          <Card title="Notifications">
            {!pushSupported ? (
              <p className="text-sm text-gray-400">
                Pour recevoir des notifications, ajoutez l'app à votre écran d'accueil puis ouvrez-la depuis là.
              </p>
            ) : pushBlocked ? (
              <p className="text-sm text-gray-400">
                Les notifications sont bloquées dans les paramètres de votre navigateur.
              </p>
            ) : (
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-800">
                    {subscribed ? 'Notifications activées' : 'Activer les notifications'}
                  </p>
                  <p className="text-xs text-gray-400 mt-0.5">
                    Anniversaires · Nouveaux membres
                  </p>
                </div>
                <button
                  onClick={subscribed ? unsubscribe : subscribe}
                  disabled={pushLoading}
                  className={`relative inline-flex h-7 w-12 shrink-0 items-center rounded-full transition-colors disabled:opacity-50 ${
                    subscribed ? 'bg-primary' : 'bg-gray-200'
                  }`}
                >
                  <span className={`inline-block h-5 w-5 transform rounded-full bg-white shadow transition-transform ${
                    subscribed ? 'translate-x-6' : 'translate-x-1'
                  }`} />
                </button>
              </div>
            )}
            {isAdmin && subscribed && (
              <div className="mt-4 pt-4 border-t border-gray-100 space-y-3">
                <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Test de notification</p>

                {pushSubscribers.length === 0 ? (
                  <p className="text-xs text-gray-400">Aucun abonné enregistré.</p>
                ) : (
                  <div className="space-y-1.5">
                    <p className="text-xs text-gray-400">Sélectionne les utilisateurs à qui envoyer le test :</p>
                    {pushSubscribers.map(sub => (
                      <button
                        key={sub.userId}
                        type="button"
                        onClick={() => toggleTestUser(sub.userId)}
                        className={`flex items-center gap-3 w-full rounded-xl px-3 py-2.5 text-left transition-colors ${
                          testUserIds.has(sub.userId)
                            ? 'bg-primary/8 border border-primary/25'
                            : 'bg-gray-50 border border-transparent'
                        }`}
                      >
                        <span className={`h-4 w-4 rounded flex items-center justify-center shrink-0 border transition-colors ${
                          testUserIds.has(sub.userId) ? 'bg-primary border-primary' : 'border-gray-300 bg-white'
                        }`}>
                          {testUserIds.has(sub.userId) && (
                            <svg className="h-3 w-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                              <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                            </svg>
                          )}
                        </span>
                        <span className="flex-1 text-sm font-medium text-gray-800">
                          {sub.firstName} {sub.lastName}
                        </span>
                        <span className="text-xs text-gray-400 shrink-0">
                          {sub.deviceCount} appareil{sub.deviceCount > 1 ? 's' : ''}
                        </span>
                      </button>
                    ))}
                  </div>
                )}

                <button
                  onClick={handleTestPush}
                  disabled={testPushState === 'loading' || testUserIds.size === 0}
                  className="w-full rounded-xl bg-gray-100 py-2.5 text-sm font-medium text-gray-700 active:bg-gray-200 disabled:opacity-40"
                >
                  {testPushState === 'loading' && 'Envoi en cours…'}
                  {testPushState === 'ok' && '✓ Notification envoyée !'}
                  {testPushState === 'error' && 'Erreur — réessayez'}
                  {testPushState === 'idle' && `🔔 Envoyer le test${testUserIds.size > 0 ? ` (${testUserIds.size})` : ''}`}
                </button>
              </div>
            )}
          </Card>
        )}

        {/* Historique d'activité — admin uniquement */}
        {isAdmin && (
          <ActivityLogTable
            data={logsData}
            loading={logsLoading}
            page={logsPage}
            onPageChange={setLogsPage}
            memberId={memberId}
          />
        )}

        {/* Mon compte — visible uniquement sur son propre profil */}
        {isOwnProfile && (
          <Card title="Mon compte">
            <div className="space-y-2">
              <button
                onClick={handleExportMyData}
                disabled={exportingData}
                className="w-full flex items-center gap-3 rounded-xl px-3 py-3 text-left text-sm font-medium text-gray-700 bg-gray-50 active:bg-gray-100 transition-colors disabled:opacity-50"
              >
                <svg className="h-4 w-4 shrink-0 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                </svg>
                {exportingData ? 'Export en cours…' : 'Télécharger mes données (RGPD)'}
              </button>

              <a
                href="/privacy"
                className="w-full flex items-center gap-3 rounded-xl px-3 py-3 text-left text-sm font-medium text-gray-700 bg-gray-50 active:bg-gray-100 transition-colors"
              >
                <svg className="h-4 w-4 shrink-0 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
                Politique de confidentialité
              </a>

              <button
                onClick={() => setShowDeleteAccountConfirm(true)}
                className="w-full flex items-center gap-3 rounded-xl px-3 py-3 text-left text-sm font-medium text-red-500 bg-red-50 active:bg-red-100 transition-colors"
              >
                <svg className="h-4 w-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                </svg>
                Supprimer mon compte
              </button>
            </div>
          </Card>
        )}

        {/* Membre depuis */}
        <p className="text-center text-xs text-gray-300">
          Membre depuis {new Date(member.createdAt).toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' })}
        </p>

        {isAdmin && !isOwnProfile && (
          <button
            onClick={() => setShowDeleteConfirm(true)}
            className="w-full flex items-center justify-center gap-2 rounded-2xl border border-red-200 py-3 text-sm font-semibold text-red-500 active:bg-red-50 transition-colors"
          >
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
            </svg>
            Supprimer ce membre
          </button>
        )}

      </div>

      <MemberFormModal open={showEdit} onClose={() => setShowEdit(false)} onSubmit={handleEdit} initial={member} />

      <RelationFormModal
        open={showAddRelation}
        onClose={() => setShowAddRelation(false)}
        onSubmit={handleAddRelation}
        currentMember={member}
      />

      <ConfirmModal
        open={!!confirmDeleteRelation}
        title="Supprimer ce lien ?"
        message="Ce lien familial sera définitivement supprimé."
        confirmLabel="Supprimer"
        onConfirm={() => handleDeleteRelation(confirmDeleteRelation)}
        onCancel={() => setConfirmDeleteRelation(null)}
      />

      <ConfirmModal
        open={showDeleteConfirm}
        title="Supprimer ce membre ?"
        message={`${member?.firstName} ${member?.lastName} et toutes ses données seront définitivement supprimés.`}
        confirmLabel="Supprimer"
        onConfirm={handleDelete}
        onCancel={() => setShowDeleteConfirm(false)}
        loading={deleteLoading}
      />

      <ConfirmModal
        open={showDeleteAccountConfirm}
        title="Supprimer mon compte ?"
        message="Votre compte et votre profil seront définitivement supprimés — vous disparaîtrez de l'arbre familial et de la liste des membres. Cette action est irréversible."
        confirmLabel="Supprimer mon compte"
        onConfirm={handleDeleteAccount}
        onCancel={() => setShowDeleteAccountConfirm(false)}
      />

      {linkModal && (
        <SocialLinkModal
          network={linkModal}
          currentValue={
            linkModal === 'instagram' ? member.instagramUsername :
            linkModal === 'facebook'  ? member.facebookUrl :
            member.whatsappNumber || member.phone
          }
          memberCountry={member.country}
          onClose={() => setLinkModal(null)}
          onSave={async value => {
            const field = linkModal === 'instagram' ? 'instagramUsername' : linkModal === 'facebook' ? 'facebookUrl' : 'whatsappNumber'
            const { data } = await membersApi.update(memberId, { [field]: value, familyId: member.familyId })
            setMember(data)
            refreshMembers()
            setLinkModal(null)
          }}
        />
      )}
    </div>
  )
}

function computeRelationSuggestions(memberId, allRelations) {
  const parentIds = new Set()
  const siblingIds = new Set()

  const spouseIds = new Set()
  const childIds = new Set()

  allRelations.forEach(r => {
    if (r.type === 'ParentChild' && r.memberBId === memberId) parentIds.add(r.memberAId)
    if (r.type === 'ParentChild' && r.memberAId === memberId) childIds.add(r.memberBId)
    if (r.type === 'Sibling' || r.type === 'HalfSibling') {
      if (r.memberAId === memberId) siblingIds.add(r.memberBId)
      if (r.memberBId === memberId) siblingIds.add(r.memberAId)
    }
    if (r.type === 'Spouse') {
      if (r.memberAId === memberId) spouseIds.add(r.memberBId)
      if (r.memberBId === memberId) spouseIds.add(r.memberAId)
    }
  })

  const suggestions = []
  const seen = new Set()
  const add = s => {
    const key = `${s.relType}|${s.relatedId}`
    if (!seen.has(key)) { seen.add(key); suggestions.push(s) }
  }

  // 1. Sibling suggestions: other children of member's parents
  parentIds.forEach(parentId => {
    const parentRel = allRelations.find(r => r.type === 'ParentChild' && r.memberAId === parentId && r.memberBId === memberId)
    const parentName = parentRel?.memberAName ?? ''
    allRelations
      .filter(r => r.type === 'ParentChild' && r.memberAId === parentId && r.memberBId !== memberId)
      .forEach(r => {
        if (!siblingIds.has(r.memberBId))
          add({ relType: 'Sibling', relatedId: r.memberBId, relatedName: r.memberBName,
            reason: `Même parent · ${parentName}`,
            payload: { memberAId: memberId, memberBId: r.memberBId, type: 'Sibling' } })
      })
  })

  // 2. Spouse's children: suggest member is parent of spouse's children
  spouseIds.forEach(spouseId => {
    const spouseRel = allRelations.find(r =>
      r.type === 'Spouse' &&
      ((r.memberAId === memberId && r.memberBId === spouseId) || (r.memberBId === memberId && r.memberAId === spouseId))
    )
    const spouseName = spouseRel ? (spouseRel.memberAId === spouseId ? spouseRel.memberAName : spouseRel.memberBName) : ''
    allRelations
      .filter(r => r.type === 'ParentChild' && r.memberAId === spouseId && !childIds.has(r.memberBId))
      .forEach(r => {
        add({ relType: 'ParentChild_parent', relatedId: r.memberBId, relatedName: r.memberBName,
          reason: `Enfant de ${spouseName}`,
          payload: { memberAId: memberId, memberBId: r.memberBId, type: 'ParentChild' } })
      })
  })

  // 3. Parent suggestions: parents of member's siblings not yet linked to member
  siblingIds.forEach(sibId => {
    const sibRel = allRelations.find(r =>
      (r.type === 'Sibling' || r.type === 'HalfSibling') &&
      ((r.memberAId === memberId && r.memberBId === sibId) || (r.memberBId === memberId && r.memberAId === sibId))
    )
    const sibName = sibRel ? (sibRel.memberAId === sibId ? sibRel.memberAName : sibRel.memberBName) : ''
    allRelations
      .filter(r => r.type === 'ParentChild' && r.memberBId === sibId && !parentIds.has(r.memberAId))
      .forEach(r => {
        add({ relType: 'ParentChild', relatedId: r.memberAId, relatedName: r.memberAName,
          reason: `Parent de ${sibName}`,
          payload: { memberAId: r.memberAId, memberBId: memberId, type: 'ParentChild' } })
      })
  })

  // 4. Siblings of siblings: if M is sibling of S, suggest S's other siblings not yet linked to M
  siblingIds.forEach(sibId => {
    const sibRel = allRelations.find(r =>
      (r.type === 'Sibling' || r.type === 'HalfSibling') &&
      ((r.memberAId === memberId && r.memberBId === sibId) || (r.memberBId === memberId && r.memberAId === sibId))
    )
    const sibName = sibRel ? (sibRel.memberAId === sibId ? sibRel.memberAName : sibRel.memberBName) : ''
    allRelations
      .filter(r =>
        (r.type === 'Sibling' || r.type === 'HalfSibling') &&
        ((r.memberAId === sibId && r.memberBId !== memberId) ||
         (r.memberBId === sibId && r.memberAId !== memberId))
      )
      .forEach(r => {
        const otherId = r.memberAId === sibId ? r.memberBId : r.memberAId
        const otherName = r.memberAId === sibId ? r.memberBName : r.memberAName
        if (!siblingIds.has(otherId)) {
          add({ relType: 'Sibling', relatedId: otherId, relatedName: otherName,
            reason: `Frère/sœur de ${sibName}`,
            payload: { memberAId: memberId, memberBId: otherId, type: 'Sibling' } })
        }
      })
  })

  // 5. Children's siblings: if M is parent of C and C has siblings, suggest M is also parent of those siblings
  childIds.forEach(childId => {
    const childRel = allRelations.find(r => r.type === 'ParentChild' && r.memberAId === memberId && r.memberBId === childId)
    const childName = childRel?.memberBName ?? ''
    allRelations
      .filter(r =>
        (r.type === 'Sibling' || r.type === 'HalfSibling') &&
        ((r.memberAId === childId && r.memberBId !== memberId) ||
         (r.memberBId === childId && r.memberAId !== memberId))
      )
      .forEach(r => {
        const sibId = r.memberAId === childId ? r.memberBId : r.memberAId
        const sibName = r.memberAId === childId ? r.memberBName : r.memberAName
        if (!childIds.has(sibId))
          add({ relType: 'ParentChild_parent', relatedId: sibId, relatedName: sibName,
            reason: `Frère/sœur de ${childName}`,
            payload: { memberAId: memberId, memberBId: sibId, type: 'ParentChild' } })
      })
  })

  // 6. Co-parent suggestion: if M and X are both parents of the same child, suggest M is spouse of X
  childIds.forEach(childId => {
    const childRel = allRelations.find(r => r.type === 'ParentChild' && r.memberAId === memberId && r.memberBId === childId)
    const childName = childRel?.memberBName ?? ''
    allRelations
      .filter(r => r.type === 'ParentChild' && r.memberBId === childId && r.memberAId !== memberId)
      .forEach(r => {
        if (!spouseIds.has(r.memberAId))
          add({ relType: 'Spouse', relatedId: r.memberAId, relatedName: r.memberAName,
            reason: `Co-parent de ${childName}`,
            payload: { memberAId: memberId, memberBId: r.memberAId, type: 'Spouse' } })
      })
  })

  return suggestions
}

const REL_LABELS = { Sibling: 'Frère / Sœur', ParentChild: 'Enfant de', ParentChild_parent: 'Parent de', Spouse: 'Conjoint(e)', Separated: 'Séparé(e) / Divorcé(e)' }

function SuggestionRow({ suggestion, onAccept }) {
  const [loading, setLoading] = useState(false)
  const [done, setDone] = useState(false)

  async function handle() {
    setLoading(true)
    try { await onAccept(suggestion.payload); setDone(true) }
    finally { setLoading(false) }
  }

  return (
    <div className={`flex items-center gap-3 rounded-xl px-3 py-2.5 ${done ? 'bg-green-50' : 'bg-gray-50'}`}>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold text-gray-900 truncate">{suggestion.relatedName}</p>
        <p className="text-[11px] text-gray-400 mt-0.5">
          <span className="font-medium text-primary">{REL_LABELS[suggestion.relType]}</span>
          {' · '}{suggestion.reason}
        </p>
      </div>
      {done ? (
        <span className="text-xs font-semibold text-green-600 shrink-0 flex items-center gap-1">
          <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
          </svg>
          Créé
        </span>
      ) : (
        <button
          onClick={handle}
          disabled={loading}
          className="shrink-0 rounded-xl bg-primary text-white text-xs font-semibold px-3 py-1.5 disabled:opacity-50 active:opacity-80"
        >
          {loading ? '…' : 'Créer'}
        </button>
      )}
    </div>
  )
}

function Card({ title, children, action }) {
  return (
    <div className="rounded-2xl bg-white shadow-sm p-4">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wider">{title}</h3>
        {action}
      </div>
      {children}
    </div>
  )
}

function InfoRow({ icon, label, sub, href }) {
  const content = (
    <div className="flex items-start gap-3 py-2.5">
      <span className="h-4 w-4 text-gray-400 shrink-0 mt-0.5">{icon}</span>
      <div>
        <p className="text-sm text-gray-800">{label}</p>
        {sub && <p className="text-xs text-gray-400 mt-0.5">{sub}</p>}
      </div>
    </div>
  )
  return href ? <a href={href} className="block active:opacity-70">{content}</a> : <div>{content}</div>
}

function ActionBtn({ href, label, color, children }) {
  return (
    <a href={href} target="_blank" rel="noopener noreferrer" aria-label={label}
      className={`flex items-center justify-center ${color} rounded-2xl p-4 active:opacity-80`}>
      <span className="h-6 w-6 text-white">{children}</span>
    </a>
  )
}

function SocialRow({ icon, label, iconBg, value, displayValue, href, onLink }) {
  const leftContent = (
    <>
      <span className={`h-9 w-9 rounded-xl ${iconBg} flex items-center justify-center text-white shrink-0 p-2`}>
        {icon}
      </span>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-gray-800">{label}</p>
        {value && displayValue && (
          <p className="text-xs text-gray-400 truncate">{displayValue}</p>
        )}
      </div>
    </>
  )

  return (
    <div className="flex items-center gap-3 py-3">
      {value && href ? (
        <a href={href} target="_blank" rel="noopener noreferrer"
          className="flex items-center gap-3 flex-1 min-w-0 active:opacity-70">
          {leftContent}
        </a>
      ) : (
        <div className="flex items-center gap-3 flex-1 min-w-0">
          {leftContent}
        </div>
      )}
      {value ? (
        <button onClick={onLink}
          className="h-7 w-7 rounded-lg bg-gray-100 flex items-center justify-center active:bg-gray-200 shrink-0">
          <EditIcon />
        </button>
      ) : (
        <button onClick={onLink}
          className="rounded-xl border border-primary px-3 py-1.5 text-xs font-semibold text-primary active:bg-primary/5 shrink-0">
          Lier
        </button>
      )}
    </div>
  )
}

function SocialBtn({ href, label, color, icon }) {
  return (
    <a href={href} target="_blank" rel="noopener noreferrer"
      className={`flex flex-1 flex-col items-center gap-2 rounded-2xl ${color} py-4 text-white active:opacity-80`}>
      <span className="h-6 w-6">{icon}</span>
      <span className="text-xs font-medium">{label}</span>
    </a>
  )
}

const LOG_LABELS = {
  member_created:   { label: 'Membre ajouté',       color: 'bg-violet-100 text-violet-700' },
  member_updated:   { label: 'Profil modifié',       color: 'bg-sky-100 text-sky-700' },
  photo_updated:    { label: 'Photo modifiée',        color: 'bg-amber-100 text-amber-700' },
  relation_created: { label: 'Lien familial ajouté', color: 'bg-emerald-100 text-emerald-700' },
  relation_deleted: { label: 'Lien familial supprimé', color: 'bg-red-100 text-red-600' },
  member_deleted:   { label: 'Membre supprimé',      color: 'bg-red-100 text-red-600' },
}

const REL_TYPE_LABELS = {
  ParentChild: 'Parent / Enfant',
  Spouse:      'Conjoint(e)',
  Sibling:     'Frère / Sœur',
  HalfSibling: 'Demi-frère/sœur',
  Separated:   'Séparé(e) / Divorcé(e)',
}

function ActivityLogTable({ data, loading, page, onPageChange, memberId }) {
  function formatDate(iso) {
    const d = new Date(iso)
    return d.toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', year: '2-digit' })
      + ' ' + d.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })
  }

  function getDetails(log) {
    if (log.type === 'relation_created' || log.type === 'relation_deleted') {
      const rel = REL_TYPE_LABELS[log.metadata] ?? log.metadata ?? ''
      let otherName = null
      if (log.targetMemberId && log.targetMemberId !== memberId) {
        otherName = log.targetMemberName
      } else if (log.relatedMemberId && log.relatedMemberId !== memberId) {
        otherName = log.relatedMemberName
      }
      return otherName ? `${rel} · ${otherName}` : rel
    }
    return log.relatedMemberName ?? log.metadata ?? '—'
  }

  return (
    <div className="rounded-2xl bg-white shadow-sm overflow-hidden">
      <div className="flex items-center justify-between px-4 py-3 border-b border-gray-50">
        <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Historique d'activité</h3>
        {data && data.total > 0 && (
          <span className="text-xs text-gray-400">{data.total} entrée{data.total > 1 ? 's' : ''}</span>
        )}
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-10">
          <div className="h-6 w-6 animate-spin rounded-full border-2 border-primary border-t-transparent" />
        </div>
      ) : !data || data.logs.length === 0 ? (
        <p className="text-sm text-gray-400 text-center py-8">Aucune activité enregistrée.</p>
      ) : (
        <>
          {/* Tableau scrollable horizontalement sur mobile */}
          <div className="overflow-x-auto">
            <table className="w-full min-w-[480px] text-sm">
              <thead>
                <tr className="bg-gray-50 border-b border-gray-100">
                  <th className="text-left px-4 py-2.5 text-[11px] font-semibold text-gray-400 uppercase tracking-wide w-28">Date</th>
                  <th className="text-left px-4 py-2.5 text-[11px] font-semibold text-gray-400 uppercase tracking-wide">Action</th>
                  <th className="text-left px-4 py-2.5 text-[11px] font-semibold text-gray-400 uppercase tracking-wide">Par</th>
                  <th className="text-left px-4 py-2.5 text-[11px] font-semibold text-gray-400 uppercase tracking-wide">Détails</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {data.logs.map(log => {
                  const cfg = LOG_LABELS[log.type] ?? { label: log.type, color: 'bg-gray-100 text-gray-600' }
                  return (
                    <tr key={log.id} className="hover:bg-gray-50/60 transition-colors">
                      <td className="px-4 py-3 text-xs text-gray-400 whitespace-nowrap font-mono">
                        {formatDate(log.createdAt)}
                      </td>
                      <td className="px-4 py-3">
                        <span className={`inline-block whitespace-nowrap text-[11px] font-semibold px-2 py-0.5 rounded-full ${cfg.color}`}>
                          {cfg.label}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-xs text-gray-700 whitespace-nowrap">
                        {log.actorName ?? <span className="text-gray-300 italic">Système</span>}
                      </td>
                      <td className="px-4 py-3 text-xs text-gray-500 max-w-[180px] truncate">
                        {getDetails(log)}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          {data.totalPages > 1 && (
            <div className="flex items-center justify-between px-4 py-3 border-t border-gray-50">
              <button
                onClick={() => onPageChange(page - 1)}
                disabled={page <= 1}
                className="flex items-center gap-1.5 rounded-xl border border-gray-200 px-3 py-1.5 text-xs font-medium text-gray-600 disabled:opacity-30 active:bg-gray-50"
              >
                <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
                </svg>
                Préc.
              </button>

              <div className="flex items-center gap-1">
                {Array.from({ length: data.totalPages }, (_, i) => i + 1)
                  .filter(p => p === 1 || p === data.totalPages || Math.abs(p - page) <= 1)
                  .reduce((acc, p, idx, arr) => {
                    if (idx > 0 && p - arr[idx - 1] > 1) acc.push('…')
                    acc.push(p)
                    return acc
                  }, [])
                  .map((p, i) =>
                    p === '…' ? (
                      <span key={`ellipsis-${i}`} className="px-1 text-xs text-gray-300">…</span>
                    ) : (
                      <button
                        key={p}
                        onClick={() => onPageChange(p)}
                        className={`h-7 w-7 rounded-lg text-xs font-semibold transition-colors ${
                          p === page
                            ? 'bg-primary text-white'
                            : 'text-gray-500 hover:bg-gray-100'
                        }`}
                      >
                        {p}
                      </button>
                    )
                  )
                }
              </div>

              <button
                onClick={() => onPageChange(page + 1)}
                disabled={page >= data.totalPages}
                className="flex items-center gap-1.5 rounded-xl border border-gray-200 px-3 py-1.5 text-xs font-medium text-gray-600 disabled:opacity-30 active:bg-gray-50"
              >
                Suiv.
                <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                </svg>
              </button>
            </div>
          )}
        </>
      )}
    </div>
  )
}

function CameraIcon() { return <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" /><path strokeLinecap="round" strokeLinejoin="round" d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" /></svg> }
function EditIcon() { return <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" /></svg> }
function PinIcon() { return <svg className="h-full w-full" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" /><path strokeLinecap="round" strokeLinejoin="round" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" /></svg> }
function PhoneIcon() { return <svg className="h-full w-full" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" /></svg> }
function MailIcon() { return <svg className="h-full w-full" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" /></svg> }
function CakeIcon() { return <svg className="h-full w-full" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z" /></svg> }
function BriefcaseIcon() { return <svg className="h-full w-full" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><rect x="2" y="7" width="20" height="14" rx="2" /><path strokeLinecap="round" strokeLinejoin="round" d="M16 7V5a2 2 0 00-2-2h-4a2 2 0 00-2 2v2" /></svg> }
function SportIcon() { return <svg className="h-full w-full" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M13 10V3L4 14h7v7l9-11h-7z" /></svg> }
function MemorialIcon() { return <svg className="h-full w-full" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M12 2v8m-4-4h8" /><path strokeLinecap="round" strokeLinejoin="round" d="M6 10h12a1 1 0 011 1v9a1 1 0 01-1 1H6a1 1 0 01-1-1v-9a1 1 0 011-1z" /></svg> }
function FacebookIcon() { return <svg viewBox="0 0 24 24" fill="currentColor" className="h-full w-full"><path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/></svg> }
function InstagramIcon() { return <svg viewBox="0 0 24 24" fill="currentColor" className="h-full w-full"><path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zM12 0C8.741 0 8.333.014 7.053.072 2.695.272.273 2.69.073 7.052.014 8.333 0 8.741 0 12c0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98C8.333 23.986 8.741 24 12 24c3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98C15.668.014 15.259 0 12 0zm0 5.838a6.162 6.162 0 100 12.324 6.162 6.162 0 000-12.324zM12 16a4 4 0 110-8 4 4 0 010 8zm6.406-11.845a1.44 1.44 0 100 2.881 1.44 1.44 0 000-2.881z"/></svg> }
function WhatsappIcon() { return <svg viewBox="0 0 24 24" fill="currentColor" className="h-full w-full"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51a12.8 12.8 0 00-.57-.01c-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/></svg> }
