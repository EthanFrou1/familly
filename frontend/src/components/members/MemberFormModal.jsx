import { useState, useEffect, useRef } from 'react'
import { createPortal } from 'react-dom'
import { familiesApi } from '../../services/api'
import Select from '../shared/Select'

const COUNTRY_CODES = [
  { code: '+33', flag: '🇫🇷' },
  { code: '+32', flag: '🇧🇪' },
  { code: '+41', flag: '🇨🇭' },
  { code: '+352', flag: '🇱🇺' },
  { code: '+1', flag: '🇨🇦' },
  { code: '+44', flag: '🇬🇧' },
  { code: '+34', flag: '🇪🇸' },
  { code: '+39', flag: '🇮🇹' },
  { code: '+49', flag: '🇩🇪' },
  { code: '+351', flag: '🇵🇹' },
  { code: '+31', flag: '🇳🇱' },
  { code: '+212', flag: '🇲🇦' },
  { code: '+213', flag: '🇩🇿' },
  { code: '+216', flag: '🇹🇳' },
]

const COUNTRY_TO_DIAL = {
  France: '+33', Belgique: '+32', Belgium: '+32',
  Suisse: '+41', Switzerland: '+41',
  Luxembourg: '+352',
  Canada: '+1', 'États-Unis': '+1', 'United States': '+1', USA: '+1',
  'Royaume-Uni': '+44', 'United Kingdom': '+44',
  Espagne: '+34', Spain: '+34',
  Italie: '+39', Italy: '+39',
  Allemagne: '+49', Germany: '+49',
  Portugal: '+351',
  'Pays-Bas': '+31', Netherlands: '+31',
  Maroc: '+212', Morocco: '+212',
  Algérie: '+213', Algeria: '+213',
  Tunisie: '+216', Tunisia: '+216',
}

function parsePhone(value) {
  if (!value) return { dialCode: null, local: '' }
  const normalized = value.replace(/[\s\-().]/g, '')
  const sorted = [...COUNTRY_CODES].sort((a, b) => b.code.length - a.code.length)
  for (const { code } of sorted) {
    if (normalized.startsWith(code)) return { dialCode: code, local: normalized.slice(code.length) }
  }
  return { dialCode: null, local: normalized.replace(/^\+/, '') }
}

const EMPTY = {
  firstName: '', lastName: '', birthDate: '', deathDate: '', email: '',
  phone: '', bio: '', occupation: '', sport: '', address: '', postalCode: '', city: '', country: '',
  latitude: null, longitude: null,
  isAlive: true, facebookUrl: '', instagramUsername: '', whatsappNumber: '',
  familyId: ''
}

function toFormValues(initial) {
  return {
    firstName: initial.firstName ?? '',
    lastName: initial.lastName ?? '',
    birthDate: initial.birthDate ? initial.birthDate.slice(0, 10) : '',
    deathDate: initial.deathDate ? initial.deathDate.slice(0, 10) : '',
    email: initial.email ?? '',
    phone: initial.phone ?? '',
    bio: initial.bio ?? '',
    occupation: initial.occupation ?? '',
    sport: initial.sport ?? '',
    address: initial.address ?? '',
    postalCode: initial.postalCode ?? '',
    city: initial.city ?? '',
    country: initial.country ?? '',
    latitude: initial.latitude ?? null,
    longitude: initial.longitude ?? null,
    isAlive: initial.isAlive ?? true,
    facebookUrl: initial.facebookUrl ?? '',
    instagramUsername: initial.instagramUsername ?? '',
    whatsappNumber: initial.whatsappNumber ?? '',
    familyId: initial.familyId ?? '',
  }
}

function isDirtyCheck(form, initial) {
  if (!initial) return true
  const base = toFormValues(initial)
  return Object.keys(base).some(k => String(form[k] ?? '') !== String(base[k] ?? ''))
}

export default function MemberFormModal({ open, onClose, onSubmit, initial = null }) {
  const [form, setForm] = useState(EMPTY)
  const [loading, setLoading] = useState(false)
  const [feedback, setFeedback] = useState(null) // { type: 'success'|'error', message }
  const [families, setFamilies] = useState([])
  const [waDial, setWaDial] = useState('+33')
  const [waLocal, setWaLocal] = useState('')
  const formRef = useRef(null)
  const isEdit = !!initial
  const isDirty = isDirtyCheck(form, initial)

  // iOS autofill et Google autofill déclenchent l'event natif `change` (pas `input`).
  // React écoute `input`, donc les inputs contrôlés ne reçoivent pas la valeur et la
  // réécrivent vide au prochain re-render. On intercepte `change` au niveau form pour syncer.
  useEffect(() => {
    const el = formRef.current
    if (!el) return
    const sync = (e) => {
      const { name, value, tagName } = e.target
      if (!name || tagName === 'SELECT') return
      const cleaned = name === 'phone' ? value.replace(/[^\d\s+\-().]/g, '') : value
      setForm(f => ({ ...f, [name]: cleaned }))
    }
    el.addEventListener('change', sync)
    return () => el.removeEventListener('change', sync)
  }, [])

  useEffect(() => {
    if (open) {
      const vals = initial ? toFormValues(initial) : EMPTY
      setForm(vals)
      setFeedback(null)
      const parsed = parsePhone(vals.whatsappNumber)
      setWaDial(parsed.dialCode ?? COUNTRY_TO_DIAL[vals.country] ?? '+33')
      setWaLocal(parsed.local)
      familiesApi.getAll().then(({ data }) => setFamilies(data)).catch(() => {})
      document.body.style.overflowY = 'hidden'
    } else {
      document.body.style.overflowY = ''
    }
    return () => { document.body.style.overflowY = '' }
  }, [open, initial])

  function set(field, value) {
    setForm(f => ({ ...f, [field]: value }))
  }

  function handlePlaceSelect({ address, postalCode, city, country, latitude, longitude }) {
    setForm(f => ({ ...f, address, postalCode, city, country, latitude, longitude }))
  }

  async function handleSubmit(e) {
    e.preventDefault()
    setLoading(true)
    setFeedback(null)
    try {
      const trimmed = Object.fromEntries(
        Object.entries(form).map(([k, v]) => [k, typeof v === 'string' ? v.trim() : v])
      )

      // Géocoder si adresse/ville présente mais pas de coordonnées
      if (!trimmed.latitude && (trimmed.city || trimmed.address)) {
        try {
          const query = [trimmed.address, trimmed.postalCode, trimmed.city, trimmed.country].filter(Boolean).join(', ')
          const geocoder = new window.google.maps.Geocoder()
          const result = await new Promise((resolve, reject) =>
            geocoder.geocode({ address: query }, (results, status) =>
              status === 'OK' && results[0] ? resolve(results[0]) : reject(status)
            )
          )
          trimmed.latitude = result.geometry.location.lat()
          trimmed.longitude = result.geometry.location.lng()
        } catch {}
      }

      await onSubmit({
        ...trimmed,
        birthDate: trimmed.birthDate || null,
        deathDate: trimmed.deathDate || null,
        familyId: trimmed.familyId || null,
      })
      if (isEdit) {
        setFeedback({ type: 'success', message: 'Modifications enregistrées !' })
        setTimeout(onClose, 1200)
      } else {
        onClose()
      }
    } catch (err) {
      const msg = err.response?.data?.message || err.response?.data || 'Une erreur est survenue.'
      setFeedback({ type: 'error', message: typeof msg === 'string' ? msg : 'Une erreur est survenue.' })
    } finally {
      setLoading(false)
    }
  }

  if (!open) return null

  return createPortal(
    <div className="fixed inset-0 z-[60] flex flex-col justify-end" style={{ touchAction: 'pan-y' }}>
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />
      <div className="relative bg-white rounded-t-3xl animate-slide-up w-full flex flex-col" style={{ touchAction: 'pan-y', overflowX: 'clip', maxHeight: 'calc(100dvh - 56px)' }}>
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
          <h2 className="text-lg font-semibold text-gray-900">
            {isEdit ? 'Modifier le membre' : 'Ajouter un membre'}
          </h2>
          <button onClick={onClose} className="text-gray-400 p-1 min-h-touch min-w-touch flex items-center justify-center">
            <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <form ref={formRef} onSubmit={handleSubmit} className="flex-1 flex flex-col min-h-0">
          <div className="flex-1 overflow-y-auto px-5 py-4 space-y-4">

            {/* Identité */}
            <div className="grid grid-cols-2 gap-3">
              <Field label="Prénom *">
                <input name="firstName" value={form.firstName} onChange={e => set('firstName', e.target.value)}
                  required className={inputCls} placeholder="Jean" autoComplete="given-name" />
              </Field>
              <Field label="Nom *">
                <input name="lastName" value={form.lastName} onChange={e => set('lastName', e.target.value)}
                  required className={inputCls} placeholder="Dupont" autoComplete="family-name" />
              </Field>
            </div>

            {/* Famille */}
            <Field label="Famille">
              <Select value={form.familyId} onChange={e => set('familyId', e.target.value)} placeholder="Aucune famille">
                {families.map(f => (
                  <option key={f.id} value={f.id}>{f.name}</option>
                ))}
              </Select>
            </Field>

            {/* Adresse — Google Places autocomplete, remplit Ville/CP/Pays automatiquement */}
            <Field label="Adresse">
              <PlacesInput
                key={initial?.id ?? 'new'}
                value={form.address}
                onChange={address => set('address', address)}
                onSelect={handlePlaceSelect}
              />
            </Field>

            <Field label="Ville">
              <input name="city" value={form.city} onChange={e => set('city', e.target.value)}
                className={inputCls} placeholder="Paris" autoComplete="address-level2" />
            </Field>

            <div className="grid grid-cols-2 gap-3">
              <Field label="Code postal">
                <input name="postalCode" value={form.postalCode} onChange={e => set('postalCode', e.target.value)}
                  className={inputCls} placeholder="75001" autoComplete="postal-code" />
              </Field>
              <Field label="Pays">
                <input name="country" value={form.country} onChange={e => set('country', e.target.value)}
                  className={inputCls} placeholder="France" autoComplete="country-name" />
              </Field>
            </div>

            <Field label="Date de naissance">
              <input name="birthDate" type="date" value={form.birthDate} onChange={e => set('birthDate', e.target.value)}
                className={inputCls} autoComplete="bday" />
            </Field>

            <Field label="Email">
              <input name="email" type="email" value={form.email} onChange={e => set('email', e.target.value)}
                className={inputCls} placeholder="jean@exemple.fr" autoComplete="email" />
            </Field>

            <Field label="Téléphone">
              <input name="phone" type="text" inputMode="tel" value={form.phone}
                autoComplete="tel"
                onChange={e => set('phone', e.target.value.replace(/[^\d\s+\-().]/g, ''))}
                className={inputCls} placeholder="+33 6 00 00 00 00" />
            </Field>

            <Field label="Métier / Études">
              <input name="occupation" value={form.occupation} onChange={e => set('occupation', e.target.value)}
                className={inputCls} placeholder="Ingénieur, Étudiant en droit, Retraité..." autoComplete="organization-title" />
            </Field>

            <Field label="Sport / Passion">
              <input name="sport" value={form.sport} onChange={e => set('sport', e.target.value)}
                className={inputCls} placeholder="Football, Tennis, Cuisine, Photographie..." />
            </Field>

            <Field label="Bio">
              <textarea name="bio" value={form.bio} onChange={e => set('bio', e.target.value)}
                rows={3} className={inputCls + ' resize-none'} placeholder="Quelques mots..." />
            </Field>

            {/* Réseaux sociaux — uniquement en mode édition de profil */}
            {isEdit && (
              <div className="space-y-3 rounded-xl bg-gray-50 p-4">
                <p className="text-sm font-medium text-gray-600">Réseaux sociaux</p>
                <div className="flex items-center gap-3">
                  <FacebookIcon className="h-5 w-5 text-[#1877F2] shrink-0" />
                  <input name="facebookUrl" value={form.facebookUrl} onChange={e => set('facebookUrl', e.target.value)}
                    className={inputCls} placeholder="URL ou profil Facebook" />
                </div>
                <div className="flex items-center gap-3">
                  <InstagramIcon className="h-5 w-5 text-[#E1306C] shrink-0" />
                  <input name="instagramUsername" value={form.instagramUsername} onChange={e => set('instagramUsername', e.target.value)}
                    className={inputCls} placeholder="@username Instagram" />
                </div>
                <div className="flex items-center gap-3">
                  <WhatsappIcon className="h-5 w-5 text-[#25D366] shrink-0" />
                  <div className="flex flex-1 items-center rounded-xl border border-gray-200 bg-gray-50 overflow-hidden focus-within:border-primary focus-within:bg-white transition-colors min-w-0">
                    <select
                      value={waDial}
                      onChange={e => {
                        setWaDial(e.target.value)
                        set('whatsappNumber', waLocal.trim() ? `${e.target.value}${waLocal.replace(/[\s\-().]/g, '')}` : '')
                      }}
                      className="px-2 py-2.5 text-sm bg-transparent border-r border-gray-200 text-gray-700 outline-none shrink-0"
                    >
                      {COUNTRY_CODES.map(({ code, flag }) => (
                        <option key={code} value={code}>{flag} {code}</option>
                      ))}
                    </select>
                    <input
                      type="tel"
                      value={waLocal}
                      onChange={e => {
                        const local = e.target.value.replace(/[^\d\s\-().]/g, '')
                        setWaLocal(local)
                        set('whatsappNumber', local.trim() ? `${waDial}${local.replace(/[\s\-().]/g, '')}` : '')
                      }}
                      className="flex-1 px-3 py-2.5 text-sm bg-transparent outline-none min-w-0"
                      placeholder="6 12 34 56 78"
                    />
                  </div>
                </div>
              </div>
            )}

            {/* Toggle membre vivant */}
            <div className="flex items-center justify-between rounded-xl bg-gray-50 px-4 py-3">
              <span className="text-sm font-medium text-gray-700">Membre vivant</span>
              <button
                type="button"
                onClick={() => set('isAlive', !form.isAlive)}
                className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${form.isAlive ? 'bg-primary' : 'bg-gray-300'}`}
              >
                <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${form.isAlive ? 'translate-x-6' : 'translate-x-1'}`} />
              </button>
            </div>

            {/* Date de décès — juste sous le toggle */}
            {!form.isAlive && (
              <Field label="Date de décès">
                <input type="date" value={form.deathDate} onChange={e => set('deathDate', e.target.value)}
                  className={inputCls} />
              </Field>
            )}

          </div>

          <div className="shrink-0 px-5 pt-3 pb-8 space-y-3 border-t border-gray-100 bg-white">
            {feedback && (
              <div className={`rounded-xl px-4 py-3 text-sm font-medium text-center ${
                feedback.type === 'success'
                  ? 'bg-emerald-50 text-emerald-700'
                  : 'bg-red-50 text-red-600'
              }`}>
                {feedback.message}
              </div>
            )}
            <button
              type="submit"
              disabled={loading || !isDirty || feedback?.type === 'success'}
              className="w-full rounded-xl bg-primary py-3.5 font-semibold text-white min-h-touch active:bg-primary-dark disabled:opacity-50 transition-colors"
            >
              {loading ? '...' : isEdit ? 'Enregistrer' : 'Ajouter le membre'}
            </button>
          </div>
        </form>
      </div>
    </div>,
    document.body
  )
}

// Composant Google Places Autocomplete — input non-contrôlé pour éviter le conflit React/Google
function PlacesInput({ value, onChange, onSelect }) {
  const inputRef = useRef(null)

  useEffect(() => {
    if (!window.google?.maps?.places || !inputRef.current) return

    const autocomplete = new window.google.maps.places.Autocomplete(inputRef.current, {
      types: ['geocode'],
      fields: ['address_components', 'geometry', 'name'],
    })

    autocomplete.addListener('place_changed', () => {
      const place = autocomplete.getPlace()
      if (!place.geometry) return

      let streetNumber = '', route = '', city = '', postalCode = '', country = ''
      for (const comp of place.address_components ?? []) {
        if (comp.types.includes('street_number')) streetNumber = comp.long_name
        if (comp.types.includes('route')) route = comp.long_name
        if (comp.types.includes('locality') || comp.types.includes('postal_town')) city = comp.long_name
        if (comp.types.includes('postal_code')) postalCode = comp.long_name
        if (comp.types.includes('country')) country = comp.long_name
      }
      if (!city) city = place.name ?? ''
      const street = [streetNumber, route].filter(Boolean).join(' ')

      onSelect({ address: street, postalCode, city, country,
        latitude: place.geometry.location.lat(),
        longitude: place.geometry.location.lng(),
      })
      // Affiche la rue dans le champ adresse (ou la ville si pas de rue)
      const display = street || city
      onChange(display)
      if (inputRef.current) inputRef.current.value = display
    })

    return () => window.google.maps.event.clearInstanceListeners(autocomplete)
  }, [])

  return (
    <input
      ref={inputRef}
      defaultValue={value}
      onChange={e => onChange(e.target.value)}
      className={inputCls}
      placeholder="23 rue de la Paix, Paris..."
    />
  )
}

function Field({ label, children }) {
  return (
    <div className="space-y-1.5">
      <label className="text-sm font-medium text-gray-600">{label}</label>
      {children}
    </div>
  )
}

const inputCls = 'w-full min-w-0 max-w-full rounded-xl border border-gray-200 bg-gray-50 px-3.5 py-2.5 text-sm text-gray-900 focus:border-primary focus:outline-none focus:bg-white transition-colors'

function FacebookIcon({ className }) {
  return <svg className={className} viewBox="0 0 24 24" fill="currentColor"><path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/></svg>
}
function InstagramIcon({ className }) {
  return <svg className={className} viewBox="0 0 24 24" fill="currentColor"><path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zM12 0C8.741 0 8.333.014 7.053.072 2.695.272.273 2.69.073 7.052.014 8.333 0 8.741 0 12c0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98C8.333 23.986 8.741 24 12 24c3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98C15.668.014 15.259 0 12 0zm0 5.838a6.162 6.162 0 100 12.324 6.162 6.162 0 000-12.324zM12 16a4 4 0 110-8 4 4 0 010 8zm6.406-11.845a1.44 1.44 0 100 2.881 1.44 1.44 0 000-2.881z"/></svg>
}
function WhatsappIcon({ className }) {
  return <svg className={className} viewBox="0 0 24 24" fill="currentColor"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51a12.8 12.8 0 00-.57-.01c-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/></svg>
}
