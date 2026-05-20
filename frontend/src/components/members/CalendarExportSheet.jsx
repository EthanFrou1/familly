import { useEffect, useState } from 'react'
import { membersApi } from '../../services/api'

export default function CalendarExportSheet({ onClose }) {
  const [urls, setUrls] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)
  const [copied, setCopied] = useState(false)

  const handleCopy = async () => {
    if (!urls?.httpsUrl) return
    try {
      await navigator.clipboard.writeText(urls.httpsUrl)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {}
  }

  useEffect(() => {
    membersApi.getCalendarUrl()
      .then(({ data }) => {
        const icsPath = `/api/members/export/birthdays.ics?token=${encodeURIComponent(data.token)}`
        setUrls({
          httpsUrl: `${window.location.origin}${icsPath}`,
          webcalUrl: `webcal://${window.location.host}${icsPath}`,
        })
      })
      .catch(() => setError(true))
      .finally(() => setLoading(false))
  }, [])

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

  const subscriptionOptions = urls ? [
    {
      name: 'Google Calendar',
      description: 'Abonnement — mise à jour automatique',
      bg: '#FEEFC3',
      icon: <GoogleCalendarIcon />,
      action: () => {
        window.open(
          `https://calendar.google.com/calendar/r/settings/addbyurl?url=${encodeURIComponent(urls.httpsUrl)}`,
          '_blank'
        )
        onClose()
      },
    },
    {
      name: 'Apple Calendar',
      description: 'Abonnement — mise à jour automatique',
      bg: '#FFE5E5',
      icon: <AppleCalendarIcon />,
      action: () => {
        window.location.href = urls.webcalUrl
        onClose()
      },
    },
  ] : []

  const fileOptions = [
    {
      name: 'Outlook',
      description: 'Importer le fichier .ics',
      bg: '#E3EEFF',
      icon: <OutlookIcon />,
      action: handleDownload,
    },
    {
      name: 'Télécharger le fichier',
      description: '.ics — compatible avec tout agenda',
      bg: '#F0F0F0',
      icon: <DownloadIcon />,
      action: handleDownload,
    },
  ]

  const allOptions = [...subscriptionOptions, ...fileOptions]

  return (
    <div className="fixed inset-0 z-50 flex items-end" onClick={onClose}>
      <div className="absolute inset-0 bg-black/40" />
      <div
        className="relative w-full bg-white rounded-t-3xl px-5 pt-3 pb-24 animate-slide-up"
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
            {allOptions.map(opt => (
              <button
                key={opt.name}
                onClick={opt.action}
                className="w-full flex items-center gap-3 p-3.5 rounded-2xl bg-gray-50 active:bg-gray-100 text-left transition-colors"
              >
                <div
                  className="w-11 h-11 rounded-xl flex items-center justify-center shrink-0"
                  style={{ background: opt.bg }}
                >
                  {opt.icon}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-gray-900">{opt.name}</p>
                  <p className="text-xs text-gray-400">{opt.description}</p>
                </div>
                <svg className="h-4 w-4 text-gray-300 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                </svg>
              </button>
            ))}
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
