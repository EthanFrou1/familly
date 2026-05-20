import { useEffect, useState } from 'react'
import { membersApi } from '../../services/api'

export default function CalendarExportSheet({ onClose }) {
  const [urls, setUrls] = useState(null)
  const [loading, setLoading] = useState(true)

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

        <button onClick={onClose} className="w-full mt-4 py-3.5 rounded-2xl bg-gray-100 text-sm font-semibold text-gray-600 active:bg-gray-200">
          Annuler
        </button>
      </div>
    </div>
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
