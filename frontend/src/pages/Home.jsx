import { useEffect, useState, useMemo } from 'react'
import { createPortal } from 'react-dom'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'
import { useMembers } from '../store/MembersContext'
import { familiesApi, settingsApi, relationsApi, activityLogsApi, photosApi, gamesApi } from '../services/api'
import { usePageRefresh } from '../hooks/usePageRefresh'
import Avatar from '../components/shared/Avatar'
import BirthdayPopup from '../components/home/BirthdayPopup'
import CalendarExportSheet from '../components/members/CalendarExportSheet'
import { usePushNotifications } from '../hooks/usePushNotifications'

function timeAgo(dateStr) {
  if (!dateStr) return ''
  const diff = Date.now() - new Date(dateStr)
  const days = Math.floor(diff / 86400000)
  if (days === 0) return "Aujourd'hui"
  if (days === 1) return 'Hier'
  if (days < 30) return `Il y a ${days}j`
  const months = Math.floor(days / 30)
  if (months < 12) return `Il y a ${months} mois`
  return `Il y a ${Math.floor(months / 12)} an${Math.floor(months / 12) > 1 ? 's' : ''}`
}

function computeFunStats(members, relations) {
  if (members.length < 2) return []
  const stats = []
  const now = new Date()

  const withAge = members
    .filter(m => m.birthDate)
    .map(m => ({ ...m, ageMs: now - new Date(m.birthDate) }))

  // Oldest living member
  const oldest = withAge.filter(m => m.isAlive).sort((a, b) => b.ageMs - a.ageMs)[0]
  if (oldest) {
    const age = Math.floor(oldest.ageMs / (365.25 * 24 * 3600 * 1000))
    stats.push({ emoji: '👴', label: 'Le plus âgé', value: `${oldest.firstName} ${oldest.lastName}`, sub: `${age} ans`, memberId: oldest.id })
  }

  // Youngest member
  const youngest = withAge.filter(m => m.isAlive).sort((a, b) => a.ageMs - b.ageMs)[0]
  if (youngest) {
    const age = Math.floor(youngest.ageMs / (365.25 * 24 * 3600 * 1000))
    stats.push({ emoji: '👶', label: 'Le plus jeune', value: `${youngest.firstName} ${youngest.lastName}`, sub: age === 0 ? 'Moins d\'1 an' : `${age} ans`, memberId: youngest.id })
  }

  // Average age
  if (withAge.length >= 3) {
    const avg = Math.round(withAge.reduce((s, m) => s + m.ageMs, 0) / withAge.length / (365.25 * 24 * 3600 * 1000))
    stats.push({ emoji: '📊', label: 'Âge moyen', value: `${avg} ans`, sub: `sur ${withAge.length} membres`, memberId: null })
  }

  // Most represented city
  const cities = {}
  members.forEach(m => { if (m.city) cities[m.city] = (cities[m.city] || 0) + 1 })
  const topCity = Object.entries(cities).sort((a, b) => b[1] - a[1])[0]
  if (topCity && topCity[1] > 1) {
    stats.push({ emoji: '📍', label: 'Ville star', value: topCity[0], sub: `${topCity[1]} membres`, memberId: null })
  }

  // Most common first name
  const names = {}
  members.forEach(m => { names[m.firstName] = (names[m.firstName] || 0) + 1 })
  const topName = Object.entries(names).sort((a, b) => b[1] - a[1])[0]
  if (topName && topName[1] > 1) {
    stats.push({ emoji: '✨', label: 'Prénom star', value: topName[0], sub: `${topName[1]} fois`, memberId: null })
  }

  // Most connected member
  if (relations.length > 0) {
    const counts = {}
    relations.forEach(r => {
      counts[r.memberAId] = (counts[r.memberAId] || 0) + 1
      counts[r.memberBId] = (counts[r.memberBId] || 0) + 1
    })
    const topId = Object.entries(counts).sort((a, b) => b[1] - a[1])[0]
    const topMember = topId && members.find(m => m.id === topId[0])
    if (topMember && topId[1] >= 2) {
      stats.push({ emoji: '🌟', label: 'Le plus connecté', value: `${topMember.firstName} ${topMember.lastName}`, sub: `${topId[1]} liens familiaux`, memberId: topMember.id })
    }
  }

  // Members spread across countries
  const countryCount = new Set(members.map(m => m.country).filter(Boolean)).size
  if (countryCount >= 2) {
    stats.push({ emoji: '🌍', label: 'Famille mondiale', value: `${countryCount} pays`, sub: 'représentés', memberId: null })
  }

  // Pièces rapportées
  const pieceCount = members.filter(m => !m.familyId).length
  if (pieceCount >= 1) {
    stats.push({ emoji: '🧩', label: 'Pièces rapportées', value: `${pieceCount} membre${pieceCount > 1 ? 's' : ''}`, sub: 'en cours de validation', memberId: null })
  }

  return stats
}

function getUpcomingBirthdays(members, days = 7) {
  const today = new Date()
  today.setHours(0, 0, 0, 0)

  return members
    .filter(m => m.birthDate && m.isAlive)
    .map(m => {
      const birth = new Date(m.birthDate)
      let next = new Date(today.getFullYear(), birth.getMonth(), birth.getDate())
      if (next < today) next.setFullYear(today.getFullYear() + 1)
      const daysUntil = Math.round((next - today) / 86400000)
      const age = next.getFullYear() - birth.getFullYear()
      return { ...m, daysUntil, age, nextBirthday: next }
    })
    .filter(m => m.daysUntil <= days)
    .sort((a, b) => a.daysUntil - b.daysUntil)
    .slice(0, 5)
}

export default function Home() {
  const { user } = useAuth()
  const { members } = useMembers()
  const navigate = useNavigate()
  const isAdmin = user?.role === 'Admin'

  const [familyGroupName, setFamilyGroupName] = useState(null)
  const [familyCount, setFamilyCount] = useState(0)
  const [editingName, setEditingName] = useState(false)
  const [nameInput, setNameInput] = useState('')
  const [savingName, setSavingName] = useState(false)
  const [relations, setRelations] = useState([])
  const [activityLogs, setActivityLogs] = useState([])
  const [recentPhotos, setRecentPhotos] = useState([])
  const [gameStats, setGameStats] = useState(null)
  const [showExportSheet, setShowExportSheet] = useState(false)
  const { supported: pushSupported, subscribed, permission, subscribe } = usePushNotifications()
  const [pushBannerDismissed, setPushBannerDismissed] = useState(
    () => localStorage.getItem('push-banner-dismissed') === '1'
  )
  const showPushBanner = pushSupported && permission === 'default' && !subscribed && !pushBannerDismissed

  function dismissPushBanner() {
    localStorage.setItem('push-banner-dismissed', '1')
    setPushBannerDismissed(true)
  }

  async function handleEnablePush() {
    await subscribe()
    dismissPushBanner()
  }

  useEffect(() => {
    settingsApi.get().then(({ data }) => {
      setFamilyGroupName(data.familyGroupName ?? null)
      setNameInput(data.familyGroupName ?? '')
    }).catch(() => {})
    familiesApi.getAll().then(({ data }) => setFamilyCount(data.length)).catch(() => {})
    relationsApi.getAll().then(({ data }) => setRelations(data)).catch(() => {})
  }, [])

  useEffect(() => {
    activityLogsApi.getAll(10).then(({ data }) => setActivityLogs(data)).catch(() => {})
    photosApi.getAll().then(({ data }) => setRecentPhotos(data.slice(0, 6))).catch(() => {})
  }, [members])

  useEffect(() => {
    gamesApi.getStats('memory').then(({ data }) => setGameStats(data)).catch(() => {})
  }, [])

  usePageRefresh(() => {
    relationsApi.getAll().then(({ data }) => setRelations(data)).catch(() => {})
    activityLogsApi.getAll(10).then(({ data }) => setActivityLogs(data)).catch(() => {})
    photosApi.getAll().then(({ data }) => setRecentPhotos(data.slice(0, 6))).catch(() => {})
  })

  async function handleSaveName(e) {
    e.preventDefault()
    setSavingName(true)
    try {
      const { data } = await settingsApi.update(nameInput.trim() || null)
      setFamilyGroupName(data.familyGroupName ?? null)
      setEditingName(false)
    } finally {
      setSavingName(false)
    }
  }

  function handleCancelEdit() {
    setNameInput(familyGroupName ?? '')
    setEditingName(false)
  }

  const currentMember = members.find(m => m.id === user?.memberId)
  const userFamilyName = currentMember?.familyName ?? null

  const pieceRapporteeCount = members.filter(m => !m.familyId).length

  const stats = {
    total: members.length,
    countries: new Set(members.map(m => m.country).filter(Boolean)).size,
  }

  const funStats = useMemo(() => computeFunStats(members, relations), [members, relations])

  const gameFunStats = useMemo(() => {
    const list = []
    if (gameStats?.topWinner) {
      const { name, count, memberId } = gameStats.topWinner
      list.push({ emoji: '🏆', label: 'Le boss du Memory', value: name, sub: `${count} victoire${count > 1 ? 's' : ''}`, memberId })
    }
    if (gameStats?.topLoser) {
      const { name, count, memberId } = gameStats.topLoser
      list.push({ emoji: '🏮', label: 'Lanterne rouge du Memory', value: name, sub: `${count} défaite${count > 1 ? 's' : ''}`, memberId })
    }
    return list
  }, [gameStats])

  const allFunStats = [...funStats, ...gameFunStats]

  const birthdays = getUpcomingBirthdays(members)
  const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 3600 * 1000)
  const recent = [...members]
    .filter(m => m.isAlive && new Date(m.createdAt) >= sevenDaysAgo)
    .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))

  const todayBirthdays = birthdays.filter(m => m.daysUntil === 0)
  const isOnboarding = user && localStorage.getItem(`onboarding_${user.id}`) === '1'

  return (
    <div className="overflow-y-auto h-full bg-gray-50 pb-6 animate-fade-in">
      {todayBirthdays.length > 0 && !isOnboarding && (
        <BirthdayPopup members={birthdays} onNavigate={navigate} />
      )}

      {showPushBanner && createPortal(
        <div style={{ top: 'env(safe-area-inset-top)' }}
          className="fixed left-0 right-0 z-50 mx-4 mt-2 flex items-center gap-3 rounded-2xl bg-white border border-gray-200 shadow-lg px-4 py-3">
          <span className="text-xl shrink-0">🔔</span>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold text-gray-800">Activer les notifications</p>
            <p className="text-xs text-gray-500 leading-snug">Anniversaires, nouveaux membres…</p>
          </div>
          <button
            onClick={handleEnablePush}
            className="shrink-0 rounded-xl bg-primary px-3 py-1.5 text-xs font-semibold text-white active:opacity-80"
          >
            Activer
          </button>
          <button onClick={dismissPushBanner} className="shrink-0 text-gray-400 active:text-gray-600 p-1">
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>,
        document.body
      )}

      {/* Header */}
      <div className="relative bg-dark overflow-hidden px-5 pt-12 pb-7">

        {/* Orbes d'ambiance */}
        <div className="pointer-events-none absolute -top-20 -right-16 h-64 w-64 rounded-full bg-primary/25 blur-3xl" />
        <div className="pointer-events-none absolute bottom-0 -left-20 h-52 w-52 rounded-full bg-amber-950/50 blur-3xl" />
        <div className="pointer-events-none absolute top-10 left-1/2 h-32 w-32 -translate-x-1/2 rounded-full bg-orange-700/10 blur-2xl" />

        {/* Ligne du haut : greeting + badge */}
        <div className="relative flex items-start justify-between gap-3 mb-8">
          <div className="min-w-0">
            <p className="text-base font-semibold text-white/80">Bonjour 👋</p>
            <h1 className="text-4xl font-black text-white tracking-tight leading-none mt-1 truncate">
              {user?.firstName} {user?.lastName}
            </h1>
            {userFamilyName && (
              <div className="flex items-center gap-1.5 mt-2">
                <span className="h-1.5 w-1.5 rounded-full bg-primary shrink-0" />
                <span className="text-xs text-white/70 font-medium">{userFamilyName}</span>
              </div>
            )}
          </div>

          {/* Badge famille */}
          {editingName ? (
            <form onSubmit={handleSaveName} className="flex items-center gap-1.5 shrink-0 mt-1">
              <input autoFocus value={nameInput} onChange={e => setNameInput(e.target.value)}
                placeholder="Ex : Navel"
                className="w-24 rounded-xl bg-white/10 border border-white/20 px-2.5 py-1.5 text-xs text-white placeholder-gray-400 focus:outline-none focus:border-primary" />
              <button type="submit" disabled={savingName}
                className="rounded-xl bg-primary px-2.5 py-1.5 text-xs font-semibold text-white disabled:opacity-50">
                {savingName ? '…' : 'OK'}
              </button>
              <button type="button" onClick={handleCancelEdit}
                className="rounded-xl border border-white/20 px-2 py-1.5 text-xs text-gray-300">✕</button>
            </form>
          ) : familyGroupName ? (
            <div className="flex items-center gap-1.5 bg-white/10 border border-white/15 rounded-2xl px-3 py-2 shrink-0 mt-1">
              <span className="text-xs font-bold text-white">Famille {familyGroupName}</span>
              {isAdmin && (
                <button onClick={() => { setNameInput(familyGroupName); setEditingName(true) }}
                  className="text-gray-400 active:text-white ml-0.5">
                  <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                  </svg>
                </button>
              )}
            </div>
          ) : isAdmin ? (
            <button onClick={() => setEditingName(true)}
              className="flex items-center gap-1 rounded-2xl border border-dashed border-white/30 px-3 py-2 text-xs text-white/50 active:bg-white/5 shrink-0 mt-1">
              <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
              </svg>
              Nommer
            </button>
          ) : null}
        </div>

        {/* Stats — glassmorphism */}
        <div className="relative grid grid-cols-2 gap-3">
          <GlassStatCard value={stats.total} label="Membres" color="text-sky-300" />
          <GlassStatCard value={familyCount} label="Familles" color="text-amber-400" />
          <GlassStatCard value={stats.countries} label="Pays" color="text-emerald-400" />
          <GlassStatCard value={pieceRapporteeCount} label="Pièces rapportées" color="text-orange-400" />
        </div>
      </div>

      <div className="px-4 mt-6 space-y-6">

        {/* Prochains anniversaires */}
        {birthdays.length > 0 && (
          <Section title="Prochains anniversaires" action={
            <button
              onClick={() => setShowExportSheet(true)}
              className="flex items-center gap-1.5 text-xs font-medium text-primary active:opacity-60"
            >
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
              </svg>
              Exporter
            </button>
          }>
            <div className="space-y-2">
              {birthdays.map(m => (
                <button
                  key={m.id}
                  onClick={() => navigate(`/profile/${m.id}`)}
                  className={`flex items-center gap-3 w-full rounded-2xl p-3 shadow-sm active:opacity-70 ${
                    m.daysUntil === 0
                      ? 'bg-gradient-to-r from-primary/10 to-pink-50 ring-1 ring-primary/20'
                      : 'bg-white'
                  }`}
                >
                  <div className="relative">
                    <Avatar src={m.profilePictureUrl} name={`${m.firstName} ${m.lastName}`} size="sm" />
                    {m.daysUntil === 0 && (
                      <span className="absolute -top-1 -right-1 text-sm">🎂</span>
                    )}
                  </div>
                  <div className="flex-1 text-left">
                    <p className={`text-sm font-semibold ${m.daysUntil === 0 ? 'text-primary' : 'text-gray-900'}`}>
                      {m.firstName} {m.lastName}
                    </p>
                    <p className="text-xs text-gray-400">{m.age} ans · {m.nextBirthday.toLocaleDateString('fr-FR', { day: 'numeric', month: 'long' })}</p>
                  </div>
                  <BirthdayBadge days={m.daysUntil} />
                </button>
              ))}
            </div>
          </Section>
        )}

        {/* Photos récentes */}
        {recentPhotos.length > 0 && (
          <RecentPhotosSection photos={recentPhotos} onNavigate={navigate} />
        )}


        {/* Derniers membres ajoutés */}
        {recent.length > 0 && (
          <Section title="Derniers ajoutés">
            <div className="space-y-2">
              {recent.slice(0, 4).map(m => (
                <button
                  key={m.id}
                  onClick={() => navigate(`/profile/${m.id}`)}
                  className="flex items-center gap-3 w-full rounded-2xl bg-white shadow-sm px-4 py-3 active:opacity-70"
                >
                  <Avatar src={m.profilePictureUrl} name={`${m.firstName} ${m.lastName}`} size="sm" />
                  <div className="flex-1 text-left min-w-0">
                    <p className="text-sm font-semibold text-gray-900 truncate">Bienvenue à {m.firstName} 👋</p>
                    {m.familyName && <p className="text-xs text-gray-400 truncate">Famille {m.familyName}</p>}
                  </div>
                  <p className="text-xs text-gray-400 shrink-0">{timeAgo(m.createdAt)}</p>
                </button>
              ))}
            </div>
          </Section>
        )}

        {/* Stats fun */}
        {allFunStats.length > 0 && (
          <FunStatsSection stats={allFunStats} onNavigate={navigate} />
        )}

      </div>

      {showExportSheet && <CalendarExportSheet onClose={() => setShowExportSheet(false)} />}
    </div>
  )
}

function FunStatsSection({ stats, onNavigate }) {
  return (
    <Section title="Le saviez-vous ?">
      <div className="space-y-2">
        {stats.map((s, i) => (
          <button
            key={i}
            onClick={() => s.memberId && onNavigate(`/profile/${s.memberId}`)}
            className={`flex items-center gap-4 w-full rounded-2xl bg-white shadow-sm px-4 py-3.5 text-left active:opacity-70 ${!s.memberId ? 'cursor-default' : ''}`}
          >
            <span className="text-2xl shrink-0">{s.emoji}</span>
            <div className="flex-1 min-w-0">
              <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wide">{s.label}</p>
              <p className="text-sm font-bold text-gray-900 mt-0.5 truncate">{s.value}</p>
            </div>
            {s.sub && <p className="text-xs text-gray-400 shrink-0">{s.sub}</p>}
          </button>
        ))}
      </div>
    </Section>
  )
}

function GlassStatCard({ value, label, color }) {
  return (
    <div className="rounded-2xl bg-white/[0.08] border border-white/10 p-4 text-center backdrop-blur-sm">
      <p className={`text-2xl font-black ${color}`}>{value}</p>
      <p className="text-xs text-white/70 mt-0.5 font-medium">{label}</p>
    </div>
  )
}

function Section({ title, action, children }) {
  return (
    <section>
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wider">{title}</h2>
        {action}
      </div>
      {children}
    </section>
  )
}

function BirthdayBadge({ days }) {
  if (days === 0) return <span className="text-xs font-semibold text-white bg-primary rounded-full px-2.5 py-1">Aujourd'hui</span>
  if (days === 1) return <span className="text-xs font-semibold text-primary bg-primary/10 rounded-full px-2.5 py-1">Demain</span>
  return <span className="text-xs font-medium text-gray-400 bg-gray-100 rounded-full px-2.5 py-1">J-{days}</span>
}

const ACTIVITY_CONFIG = {
  member_created: {
    emoji: '👤',
    color: 'bg-violet-100',
    text: (log) => `${log.targetMemberName} a rejoint la famille`,
    sub: (log) => log.actorName ? `Ajouté par ${log.actorName}` : null,
  },
}

function RecentPhotosSection({ photos, onNavigate }) {
  return (
    <Section title="Photos récentes" action={
      <button onClick={() => onNavigate('/photos')} className="text-xs font-medium text-primary active:opacity-60">
        Voir tout
      </button>
    }>
      <div className="grid grid-cols-3 gap-1.5">
        {photos.map(photo => (
          <button
            key={photo.id}
            onClick={() => onNavigate('/photos')}
            className="relative aspect-square rounded-xl overflow-hidden bg-gray-100 active:opacity-80"
          >
            <img src={photo.cloudinaryUrl} alt="" className="w-full h-full object-cover" loading="lazy" />
            <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/60 to-transparent px-2 py-1.5">
              <p className="text-[10px] text-white font-medium truncate">{photo.uploaderName?.split(' ')[0]}</p>
            </div>
          </button>
        ))}
      </div>
    </Section>
  )
}

function ActivityFeed({ logs, onNavigate }) {
  const [showAll, setShowAll] = useState(false)
  const visible = showAll ? logs : logs.slice(0, 5)

  return (
    <Section title="Activité récente">
      <div className="space-y-2">
        {visible.map(log => {
          const cfg = ACTIVITY_CONFIG[log.type]
          if (!cfg) return null
          const text = cfg.text(log)
          const sub = cfg.sub(log)
          const canNav = !!log.targetMemberId
          return (
            <button
              key={log.id}
              onClick={() => canNav && onNavigate(`/profile/${log.targetMemberId}`)}
              className={`flex items-center gap-3 w-full rounded-2xl bg-white shadow-sm px-4 py-3 text-left ${!canNav ? 'cursor-default' : 'active:opacity-70'}`}
            >
              <span className={`h-10 w-10 rounded-xl ${cfg.color} flex items-center justify-center text-lg shrink-0`}>
                {log.targetMemberPictureUrl
                  ? <img src={log.targetMemberPictureUrl} alt="" className="h-10 w-10 rounded-xl object-cover" />
                  : cfg.emoji}
              </span>
              <div className="flex-1 min-w-0">
                <p className="text-sm text-gray-900 leading-snug">{text}</p>
                {sub && <p className="text-xs text-gray-400 mt-0.5">{sub}</p>}
              </div>
              <p className="text-xs text-gray-400 shrink-0">{timeAgo(log.createdAt)}</p>
            </button>
          )
        })}
      </div>
      {logs.length > 5 && (
        <button
          onClick={() => setShowAll(v => !v)}
          className="mt-2 w-full rounded-2xl border border-gray-200 py-3 text-sm font-medium text-gray-500 active:bg-gray-50"
        >
          {showAll ? 'Voir moins' : `Voir plus (${logs.length - 5})`}
        </button>
      )}
    </Section>
  )
}
