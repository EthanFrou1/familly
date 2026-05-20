import { useEffect, useState } from 'react'
import { membersApi } from '../../services/api'

export default function CalendarExportSheet({ onClose }) {
  const [urls, setUrls] = useState(null)
  const [loading, setLoading] = useState(true)
  const [showGoogleSteps, setShowGoogleSteps] = useState(false)
  const [copied, setCopied] = useState(false)

  useEffect(() => {
    membersApi.getCalendarUrl()
      .then(({ data }) => {
        const icsPath = `/api/members/export/birthdays.ics?token=${encodeURIComponent(data.token)}`
        setUrls({
          httpsUrl: `${window.location.origin}${icsPath}`,
          webcalUrl: `webcal://${window.location.host}${icsPath}`,
        })
      })
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [])

  const handleCopyUrl = async () => {
    if (!urls?.httpsUrl) return
    try {
      await navigator.clipboard.writeText(urls.httpsUrl)
      setCopied(true)
      setTimeout(() => setCopied(false), 2500)
    } catch {}
  }

  const handleDownload = async () => {
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

  return (
    <div className="fixed inset-0 z-50 flex items-end" onClick={onClose}>
      <div className="absolute inset-0 bg-black/40" />
      <div
        className="relative w-full bg-white rounded-t-3xl px-5 pt-3 pb-10 animate-slide-up"
        onClick={e => e.stopPropagation()}
      >
        <div className="w-10 h-1 bg-gray-200 rounded-full mx-auto mb-5" />
        <h2 className="text-lg font-bold text-gray-900 mb-0.5">Exporter les anniversaires</h2>
        <p className="text-sm text-gray-400 mb-5">Choisissez votre application de calendrier</p>

        {loading ? (
          <div className="flex justify-center py-8">
            <div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin" />
          </div>
        ) : (
          <div className="space-y-2">

            {/* Google Calendar — affiche les étapes avec URL à copier */}
            {urls && (
              <div className="rounded-2xl bg-gray-50 overflow-hidden">
                <button
                  onClick={() => setShowGoogleSteps(o => !o)}
                  className="w-full flex items-center gap-3 p-3.5 active:bg-gray-100 text-left transition-colors"
                >
                  <div className="w-11 h-11 rounded-xl flex items-center justify-center shrink-0" style={{ background: '#FEEFC3' }}>
                    <GoogleCalendarIcon />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-gray-900">Google Agenda</p>
                    <p className="text-xs text-gray-400">Abonnement — mise à jour automatique</p>
                  </div>
                  <svg className={`h-4 w-4 text-gray-300 shrink-0 transition-transform ${showGoogleSteps ? 'rotate-90' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                  </svg>
                </button>

                {showGoogleSteps && (
                  <div className="px-4 pb-4 space-y-3 border-t border-gray-100">
                    <div className="space-y-1.5 pt-3">
                      {[
                        'Copie le lien ci-dessous',
                        'Appuie sur "Ouvrir Google Agenda"',
                        'La page s\'ouvre dans ton navigateur',
                        'Appuie sur "Ajouter un agenda" et confirme',
                      ].map((step, i) => (
                        <div key={i} className="flex items-start gap-2.5">
                          <span className="h-5 w-5 rounded-full bg-primary text-white text-[10px] font-bold flex items-center justify-center shrink-0 mt-0.5">{i + 1}</span>
                          <span className="text-xs text-gray-600">{step}</span>
                        </div>
                      ))}
                    </div>

                    <button
                      onClick={handleCopyUrl}
                      className={`w-full flex items-center gap-2 rounded-xl px-3 py-2.5 text-left transition-colors ${copied ? 'bg-emerald-50' : 'bg-white border border-gray-200 active:bg-gray-50'}`}
                    >
                      <svg className={`h-4 w-4 shrink-0 ${copied ? 'text-emerald-500' : 'text-gray-400'}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        {copied
                          ? <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                          : <path strokeLinecap="round" strokeLinejoin="round" d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                        }
                      </svg>
                      <span className={`text-xs font-medium flex-1 truncate ${copied ? 'text-emerald-600' : 'text-gray-500'}`}>
                        {copied ? 'Lien copié !' : urls.httpsUrl}
                      </span>
                    </button>

                    <button
                      onClick={() => {
                        handleCopyUrl()
                        window.location.href = `https://calendar.google.com/calendar/r/settings/addbyurl?url=${encodeURIComponent(urls.httpsUrl)}`
                      }}
                      className="w-full flex items-center justify-center gap-2 rounded-xl bg-[#1A73E8] px-3 py-2.5 active:opacity-80 transition-opacity"
                    >
                      <GoogleCalendarIcon />
                      <span className="text-sm font-semibold text-white">Ouvrir Google Agenda</span>
                    </button>
                  </div>
                )}
              </div>
            )}

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

            {/* Outlook */}
            <button
              onClick={handleDownload}
              className="w-full flex items-center gap-3 p-3.5 rounded-2xl bg-gray-50 active:bg-gray-100 text-left transition-colors"
            >
              <div className="w-11 h-11 rounded-xl flex items-center justify-center shrink-0" style={{ background: '#E3EEFF' }}>
                <OutlookIcon />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-gray-900">Outlook</p>
                <p className="text-xs text-gray-400">Importer le fichier .ics</p>
              </div>
              <svg className="h-4 w-4 text-gray-300 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
              </svg>
            </button>

            {/* Télécharger */}
            <button
              onClick={handleDownload}
              className="w-full flex items-center gap-3 p-3.5 rounded-2xl bg-gray-50 active:bg-gray-100 text-left transition-colors"
            >
              <div className="w-11 h-11 rounded-xl flex items-center justify-center shrink-0" style={{ background: '#F0F0F0' }}>
                <DownloadIcon />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-gray-900">Télécharger le fichier</p>
                <p className="text-xs text-gray-400">.ics — compatible avec tout agenda</p>
              </div>
              <svg className="h-4 w-4 text-gray-300 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
              </svg>
            </button>
          </div>
        )}

        <button
          onClick={onClose}
          className="w-full mt-4 py-3.5 rounded-2xl bg-gray-100 text-sm font-semibold text-gray-600 active:bg-gray-200"
        >
          Annuler
        </button>
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

function DownloadIcon() {
  return (
    <svg viewBox="0 0 24 24" className="w-5 h-5 text-gray-500" fill="none" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
    </svg>
  )
}
