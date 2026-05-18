import { useState } from 'react'

const NETWORKS = {
  instagram: {
    label: 'Instagram',
    field: 'instagramUsername',
    headerCls: 'bg-gradient-to-br from-[#f09433] via-[#dc2743] to-[#bc1888]',
    inputType: 'text',
    placeholder: 'tonusername',
    prefix: '@',
    steps: [
      'Ouvre Instagram sur ton téléphone',
      'Appuie sur ton profil en bas à droite',
      'Copie ton nom d\'utilisateur (sans le @)',
    ],
    preview: val => val ? `instagram.com/${val.replace('@', '')}` : null,
    cleanValue: val => val.replace('@', '').trim(),
  },
  facebook: {
    label: 'Facebook',
    field: 'facebookUrl',
    headerCls: 'bg-[#1877F2]',
    inputType: 'text',
    placeholder: 'jean.dupont.92',
    prefix: 'facebook.com/',
    steps: [
      'Ouvre Facebook sur ton téléphone',
      'Vas sur ton profil',
      'Copie l\'identifiant dans l\'URL (ex: jean.dupont.92)',
    ],
    preview: val => val ? (val.startsWith('http') ? val : `facebook.com/${val}`) : null,
    cleanValue: val => val.trim(),
  },
  whatsapp: {
    label: 'WhatsApp',
    field: 'whatsappNumber',
    headerCls: 'bg-[#25D366]',
    inputType: 'tel',
    placeholder: '+33 6 12 34 56 78',
    prefix: null,
    steps: [
      'Ouvre WhatsApp → Paramètres',
      'Ton numéro apparaît en haut',
      'Entre-le au format international (+33…)',
    ],
    preview: val => val ? `wa.me/${val.replace(/[\s+\-()]/g, '')}` : null,
    cleanValue: val => val.trim(),
  },
}

export default function SocialLinkModal({ network, currentValue, onSave, onClose }) {
  const cfg = NETWORKS[network]
  const [value, setValue] = useState(currentValue || '')
  const [loading, setLoading] = useState(false)

  const preview = cfg.preview(value)

  async function handleSave() {
    setLoading(true)
    try {
      await onSave(cfg.cleanValue(value))
    } finally {
      setLoading(false)
    }
  }

  async function handleUnlink() {
    setLoading(true)
    try {
      await onSave('')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex flex-col justify-end">
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />

      <div className="relative bg-white rounded-t-3xl animate-slide-up overflow-hidden shadow-xl">
        {/* Drag handle */}
        <div className="flex justify-center pt-3 pb-1">
          <div className="h-1 w-10 rounded-full bg-gray-200" />
        </div>

        {/* Colored header */}
        <div className={`${cfg.headerCls} px-5 py-5 flex items-center gap-3`}>
          <span className="h-8 w-8 text-white">
            {network === 'instagram' && <InstagramIcon />}
            {network === 'facebook' && <FacebookIcon />}
            {network === 'whatsapp' && <WhatsappIcon />}
          </span>
          <span className="text-lg font-bold text-white">Lier {cfg.label}</span>
        </div>

        <div className="px-5 py-5 space-y-5">
          {/* Steps */}
          <div className="rounded-2xl bg-gray-50 p-4 space-y-2.5">
            {cfg.steps.map((step, i) => (
              <div key={i} className="flex items-start gap-3">
                <span className="h-5 w-5 rounded-full bg-primary text-white text-[10px] font-bold flex items-center justify-center shrink-0 mt-0.5">
                  {i + 1}
                </span>
                <span className="text-sm text-gray-700">{step}</span>
              </div>
            ))}
          </div>

          {/* Input */}
          <div>
            <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2 block">
              {cfg.prefix ? `${cfg.prefix}Nom d'utilisateur` : 'Numéro de téléphone'}
            </label>
            <div className="flex items-center rounded-xl border border-gray-200 bg-white overflow-hidden focus-within:ring-2 focus-within:ring-primary focus-within:border-transparent">
              {cfg.prefix && (
                <span className="px-3 text-gray-400 text-sm font-medium border-r border-gray-100 py-3 bg-gray-50 shrink-0">
                  {cfg.prefix}
                </span>
              )}
              <input
                type={cfg.inputType}
                value={value}
                onChange={e => setValue(
                  cfg.inputType === 'tel'
                    ? e.target.value.replace(/[^\d\s+\-().]/g, '')
                    : e.target.value
                )}
                placeholder={cfg.placeholder}
                autoFocus
                className="flex-1 px-3 py-3 text-sm outline-none bg-white"
              />
            </div>
          </div>

          {/* Preview */}
          {preview && (
            <div className="flex items-center gap-2 rounded-xl bg-gray-50 px-4 py-3">
              <svg className="h-4 w-4 text-gray-400 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
              </svg>
              <span className="text-xs text-gray-500 truncate">{preview}</span>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-5 pb-8 pt-1 space-y-2">
          <button
            onClick={handleSave}
            disabled={!value.trim() || loading}
            className="w-full rounded-2xl bg-primary py-3.5 font-semibold text-white disabled:opacity-40 active:bg-primary/90 transition-colors"
          >
            {loading ? '...' : 'Enregistrer'}
          </button>
          <div className="flex gap-2">
            <button onClick={onClose} className="flex-1 rounded-2xl border border-gray-200 py-3 text-sm font-medium text-gray-600 active:bg-gray-50">
              Annuler
            </button>
            {currentValue && (
              <button onClick={handleUnlink} disabled={loading}
                className="flex-1 rounded-2xl border border-red-200 py-3 text-sm font-medium text-red-500 active:bg-red-50">
                Délier
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

function InstagramIcon() { return <svg viewBox="0 0 24 24" fill="currentColor" className="h-full w-full"><path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zM12 0C8.741 0 8.333.014 7.053.072 2.695.272.273 2.69.073 7.052.014 8.333 0 8.741 0 12c0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98C8.333 23.986 8.741 24 12 24c3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98C15.668.014 15.259 0 12 0zm0 5.838a6.162 6.162 0 100 12.324 6.162 6.162 0 000-12.324zM12 16a4 4 0 110-8 4 4 0 010 8zm6.406-11.845a1.44 1.44 0 100 2.881 1.44 1.44 0 000-2.881z"/></svg> }
function FacebookIcon() { return <svg viewBox="0 0 24 24" fill="currentColor" className="h-full w-full"><path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/></svg> }
function WhatsappIcon() { return <svg viewBox="0 0 24 24" fill="currentColor" className="h-full w-full"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51a12.8 12.8 0 00-.57-.01c-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/></svg> }
