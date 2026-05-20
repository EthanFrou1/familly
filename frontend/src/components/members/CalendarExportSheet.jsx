import { useEffect, useState } from 'react'
import { membersApi } from '../../services/api'

export default function CalendarExportSheet({ onClose }) {
  const [members, setMembers] = useState([])
  const [urls, setUrls] = useState(null)
  const [loading, setLoading] = useState(true)
  const [selected, setSelected] = useState(new Set())
  const [view, setView] = useState('menu') // 'menu' | 'google'
  const [exporting, setExporting] = useState(false)

  useEffect(() => {
    Promise.all([
      membersApi.getAll(),
      membersApi.getCalendarUrl(),
    ]).then(([membersRes, urlRes]) => {
      const withBirthday = membersRes.data.filter(m => m.birthDate)
      setMembers(withBirthday)
      setSelected(new Set(withBirthday.map(m => m.id)))
      const icsPath = `/api/members/export/birthdays.ics?token=${encodeURIComponent(urlRes.data.token)}`
      setUrls({
        httpsUrl: `${window.location.origin}${icsPath}`,
        webcalUrl: `webcal://${window.location.host}${icsPath}`,
      })
    }).catch(() => {}).finally(() => setLoading(false))
  }, [])

  const toggleMember = (id) => {
    setSelected(prev => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })
  }

  const toggleAll = () => {
    setSelected(selected.size === members.length ? new Set() : new Set(members.map(m => m.id)))
  }

  const handleExportContacts = async () => {
    if (!selected.size) return
    setExporting(true)
    try {
      const { data } = await membersApi.exportContacts([...selected])
      const url = URL.createObjectURL(new Blob([data], { type: 'text/vcard' }))
      const a = document.createElement('a')
      a.href = url
      a.download = 'contacts-anniversaires.vcf'
      a.click()
      URL.revokeObjectURL(url)
      onClose()
    } catch {} finally {
      setExporting(false)
    }
  }

  const handleDownloadIcs = async () => {
    try {
      const { data } = await membersApi.exportBirthdays()
      const url = URL.createObjectURL(new Blob([data], { type: 'text/calendar' }))
      const a = document.createElement('a')
      a.href = url
      a.download = 'anniversaires-famille.ics'
      a.click()
      URL.revokeObjectURL(url)
    } catch {}
    onClose()
  }

  function formatBirthDate(dateStr) {
    if (!dateStr) return ''
    const d = new Date(dateStr)
    return d.toLocaleDateString('fr-FR', { day: 'numeric', month: 'long' })
  }

  function getAge(dateStr) {
    if (!dateStr) return null
    const birth = new Date(dateStr)
    const today = new Date()
    let age = today.getFullYear() - birth.getFullYear()
    const m = today.getMonth() - birth.getMonth()
    if (m < 0 || (m === 0 && today.getDate() < birth.getDate())) age--
    return age
  }

  function getInitials(m) {
    return `${m.firstName?.[0] ?? ''}${m.lastName?.[0] ?? ''}`.toUpperCase()
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end" onClick={view === 'menu' ? onClose : undefined}>
      <div className="absolute inset-0 bg-black/40" />
      <div
        className="relative w-full bg-white rounded-t-3xl px-5 pt-3 pb-10 animate-slide-up max-h-[90dvh] flex flex-col"
        onClick={e => e.stopPropagation()}
      >
        <div className="w-10 h-1 bg-gray-200 rounded-full mx-auto mb-4 shrink-0" />

        {view === 'menu' ? (
          <>
            <h2 className="text-lg font-bold text-gray-900 mb-0.5 shrink-0">Exporter les anniversaires</h2>
            <p className="text-sm text-gray-400 mb-5 shrink-0">Choisissez votre application de calendrier</p>

            {loading ? (
              <div className="flex justify-center py-8">
                <div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin" />
              </div>
            ) : (
              <div className="space-y-2">
                {/* Google Agenda */}
                <button
                  onClick={() => setView('google')}
                  className="w-full flex items-center gap-3 p-3.5 rounded-2xl bg-gray-50 active:bg-gray-100 text-left transition-colors"
                >
                  <div className="w-11 h-11 rounded-xl flex items-center justify-center shrink-0" style={{ background: '#FEEFC3' }}>
                    <GoogleCalendarIcon />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-gray-900">Google Agenda</p>
                    <p className="text-xs text-gray-400">Via Google Contacts — {members.length} anniversaire{members.length > 1 ? 's' : ''}</p>
                  </div>
                  <svg className="h-4 w-4 text-gray-300 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                  </svg>
                </button>

                {/* Apple Calendar */}
                {urls && (
                  <button
                    onClick={() => { window.location.href = urls.webcalUrl; onClose() }}
                    className="w-full flex items-center gap-3 p-3.5 rounded-2xl bg-gray-50 active:bg-gray-100 text-left transition-colors"
                  >
                    <div className="w-11 h-11 rounded-xl flex items-center justify-center shrink-0" style={{ background: '#FFE5E5' }}>
                      <AppleCalendarIcon />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-gray-900">Apple Calendrier</p>
                      <p className="text-xs text-gray-400">Abonnement — mise à jour automatique</p>
                    </div>
                    <svg className="h-4 w-4 text-gray-300 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                    </svg>
                  </button>
                )}

                {/* Outlook / Download */}
                <button
                  onClick={handleDownloadIcs}
                  className="w-full flex items-center gap-3 p-3.5 rounded-2xl bg-gray-50 active:bg-gray-100 text-left transition-colors"
                >
                  <div className="w-11 h-11 rounded-xl flex items-center justify-center shrink-0" style={{ background: '#E3EEFF' }}>
                    <OutlookIcon />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-gray-900">Outlook / Autre</p>
                    <p className="text-xs text-gray-400">Télécharger le fichier .ics</p>
                  </div>
                  <svg className="h-4 w-4 text-gray-300 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                  </svg>
                </button>
              </div>
            )}

            <button onClick={onClose} className="w-full mt-4 py-3.5 rounded-2xl bg-gray-100 text-sm font-semibold text-gray-600 active:bg-gray-200 shrink-0">
              Annuler
            </button>
          </>
        ) : (
          /* Vue sélection Google */
          <>
            <div className="flex items-center gap-3 mb-4 shrink-0">
              <button onClick={() => setView('menu')} className="p-1 -ml-1 text-gray-400 active:text-gray-600">
                <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
                </svg>
              </button>
              <div>
                <h2 className="text-base font-bold text-gray-900">Google Agenda</h2>
                <p className="text-xs text-gray-400">Sélectionne les membres à synchroniser</p>
              </div>
            </div>

            {/* Info box */}
            <div className="rounded-2xl bg-blue-50 px-4 py-3 mb-3 shrink-0">
              <p className="text-xs text-blue-700 leading-relaxed">
                Un fichier de contacts (.vcf) sera téléchargé. Importe-le dans <strong>Google Contacts</strong> — les anniversaires apparaîtront automatiquement dans ton Google Agenda.
              </p>
            </div>

            {/* Tout sélectionner */}
            <button onClick={toggleAll} className="flex items-center gap-2 mb-2 py-1 shrink-0">
              <div className={`h-5 w-5 rounded border-2 flex items-center justify-center transition-colors ${selected.size === members.length ? 'bg-primary border-primary' : 'border-gray-300'}`}>
                {selected.size === members.length && (
                  <svg className="h-3 w-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                  </svg>
                )}
              </div>
              <span className="text-sm font-medium text-gray-700">
                {selected.size === members.length ? 'Tout désélectionner' : 'Tout sélectionner'}
              </span>
              <span className="text-xs text-gray-400 ml-auto">{selected.size}/{members.length}</span>
            </button>

            {/* Liste membres */}
            <div className="overflow-y-auto flex-1 -mx-5 px-5 space-y-1 min-h-0">
              {members.map(m => (
                <button
                  key={m.id}
                  onClick={() => toggleMember(m.id)}
                  className="w-full flex items-center gap-3 py-2.5 active:bg-gray-50 rounded-xl px-1 transition-colors"
                >
                  <div className={`h-5 w-5 rounded border-2 flex items-center justify-center shrink-0 transition-colors ${selected.has(m.id) ? 'bg-primary border-primary' : 'border-gray-300'}`}>
                    {selected.has(m.id) && (
                      <svg className="h-3 w-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                      </svg>
                    )}
                  </div>
                  <div className="h-8 w-8 rounded-full bg-primary/20 flex items-center justify-center shrink-0">
                    <span className="text-xs font-bold text-primary">{getInitials(m)}</span>
                  </div>
                  <div className="flex-1 text-left min-w-0">
                    <p className="text-sm font-medium text-gray-900 truncate">{m.firstName} {m.lastName}</p>
                    <p className="text-xs text-gray-400">🎂 {formatBirthDate(m.birthDate)} · {getAge(m.birthDate)} ans</p>
                  </div>
                </button>
              ))}
            </div>

            {/* Footer */}
            <div className="pt-3 space-y-2 shrink-0">
              <button
                onClick={handleExportContacts}
                disabled={!selected.size || exporting}
                className="w-full rounded-2xl bg-primary py-3.5 font-semibold text-white disabled:opacity-40 active:bg-primary/90 transition-colors"
              >
                {exporting ? '...' : `Télécharger ${selected.size} contact${selected.size > 1 ? 's' : ''}`}
              </button>
              <p className="text-center text-xs text-gray-400">
                Importe ensuite dans <strong>Google Contacts</strong> → les anniversaires s'ajoutent à Google Agenda
              </p>
            </div>
          </>
        )}
      </div>
    </div>
  )
}

function GoogleCalendarIcon() {
  return (
    <svg viewBox="0 0 24 24" className="w-6 h-6">
      <rect x="3" y="4" width="18" height="17" rx="2" fill="white" stroke="#DADCE0" strokeWidth="1.5" />
      <rect x="3" y="4" width="18" height="5" rx="2" fill="#1A73E8" />
      <rect x="3" y="7" width="18" height="2" fill="#1A73E8" />
      <text x="12" y="18" textAnchor="middle" fontSize="7" fontWeight="bold" fill="#1A73E8">A</text>
      <line x1="8" y1="4" x2="8" y2="2" stroke="#1A73E8" strokeWidth="1.5" strokeLinecap="round" />
      <line x1="16" y1="4" x2="16" y2="2" stroke="#1A73E8" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  )
}

function AppleCalendarIcon() {
  return (
    <svg viewBox="0 0 24 24" className="w-6 h-6">
      <rect x="3" y="4" width="18" height="17" rx="2" fill="white" stroke="#E5E5EA" strokeWidth="1.5" />
      <rect x="3" y="4" width="18" height="5.5" rx="2" fill="#FF3B30" />
      <rect x="3" y="7.5" width="18" height="2" fill="#FF3B30" />
      <text x="12" y="18" textAnchor="middle" fontSize="7.5" fontWeight="bold" fill="#1C1C1E">
        {new Date().getDate()}
      </text>
      <line x1="8" y1="4" x2="8" y2="2" stroke="#FF3B30" strokeWidth="1.5" strokeLinecap="round" />
      <line x1="16" y1="4" x2="16" y2="2" stroke="#FF3B30" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  )
}

function OutlookIcon() {
  return (
    <svg viewBox="0 0 24 24" className="w-6 h-6" fill="none">
      <rect x="2" y="5" width="13" height="14" rx="2" fill="#0078D4" />
      <rect x="11" y="7" width="11" height="10" rx="1.5" fill="#50A0E6" />
      <rect x="11" y="7" width="11" height="3" rx="1" fill="#0078D4" />
      <ellipse cx="8.5" cy="12" rx="3" ry="3.5" fill="white" opacity="0.9" />
    </svg>
  )
}
