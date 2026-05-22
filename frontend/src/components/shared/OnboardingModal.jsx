import { useState, useRef, useEffect } from 'react'
import { createPortal } from 'react-dom'
import { membersApi } from '../../services/api'

const inputCls = "w-full rounded-2xl bg-white/[0.08] border border-white/10 px-4 py-3.5 text-white text-sm placeholder-white/25 focus:outline-none focus:border-primary/60 focus:bg-white/[0.12] transition-all"
const errorCls = "text-xs text-red-300 mt-1.5"

function validatePhone(phone) {
  if (!phone) return null
  const clean = phone.replace(/[\s.\-()]/g, '')
  if (!/^(\+\d{7,15}|0\d{9})$/.test(clean)) return 'Numéro invalide (ex: 06 12 34 56 78)'
  return null
}

function validateBirthDate(date) {
  if (!date) return null
  const d = new Date(date)
  if (isNaN(d)) return 'Date invalide'
  if (d > new Date()) return 'La date doit être dans le passé'
  if (d.getFullYear() < 1900) return 'Date trop ancienne'
  return null
}

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
      const display = street || city
      onChange(display)
      if (inputRef.current) inputRef.current.value = display
    })
    return () => window.google.maps.event.clearInstanceListeners(autocomplete)
  }, [])
  return (
    <input ref={inputRef} defaultValue={value} onChange={e => onChange(e.target.value)}
      className={inputCls} placeholder="23 rue de la Paix, Paris..." />
  )
}

const STEP_META = [
  { label: 'Photo',  title: 'Ta photo de profil',  desc: 'Ajoute une photo pour que la famille te reconnaisse.' },
  { label: 'Infos',  title: 'Tes informations',     desc: 'Quelques détails pour que la famille te retrouve facilement.' },
  { label: 'Lieu',   title: 'Où tu habites',        desc: 'Apparais sur la carte de la famille.' },
]

export default function OnboardingModal({ user, onDone }) {
  const [step, setStep] = useState(0)
  const [member, setMember] = useState(null)
  const [photoFile, setPhotoFile] = useState(null)
  const [photoPreview, setPhotoPreview] = useState(null)
  const [birthDate, setBirthDate] = useState('')
  const [phone, setPhone] = useState('')
  const [address, setAddress] = useState('')
  const [postalCode, setPostalCode] = useState('')
  const [city, setCity] = useState('')
  const [country, setCountry] = useState('')
  const [coords, setCoords] = useState({ latitude: null, longitude: null })
  const [errors, setErrors] = useState({})
  const [loading, setLoading] = useState(false)
  const fileRef = useRef()

  useEffect(() => {
    membersApi.getById(user.memberId).then(({ data }) => {
      setMember(data)
      if (data.birthDate) setBirthDate(data.birthDate.split('T')[0])
      if (data.phone) setPhone(data.phone)
      if (data.address) setAddress(data.address)
      if (data.postalCode) setPostalCode(data.postalCode)
      if (data.city) setCity(data.city)
      if (data.country) setCountry(data.country)
      if (data.profilePictureUrl) setPhotoPreview(data.profilePictureUrl)
    })
  }, [user.memberId])

  function selectPhoto(e) {
    const file = e.target.files?.[0]
    if (!file) return
    setPhotoFile(file)
    setPhotoPreview(URL.createObjectURL(file))
  }

  async function handleNext0() {
    if (photoFile) {
      setLoading(true)
      try { await membersApi.updateProfilePicture(user.memberId, photoFile) } catch {}
      setLoading(false)
    }
    setStep(1)
  }

  async function handleNext1() {
    const errs = {}
    const phoneErr = validatePhone(phone)
    const dateErr = validateBirthDate(birthDate)
    if (phoneErr) errs.phone = phoneErr
    if (dateErr) errs.birthDate = dateErr
    if (Object.keys(errs).length) { setErrors(errs); return }
    setErrors({})
    const update = {}
    if (birthDate) update.birthDate = birthDate
    if (phone) update.phone = phone
    if (Object.keys(update).length) {
      setLoading(true)
      try { await membersApi.update(user.memberId, { ...update, familyId: member?.familyId }) } catch {}
      setLoading(false)
    }
    setStep(2)
  }

  async function handleFinish() {
    const update = {}
    if (address) update.address = address
    if (postalCode) update.postalCode = postalCode
    if (city) update.city = city
    if (country) update.country = country
    if (coords.latitude) {
      update.latitude = coords.latitude
      update.longitude = coords.longitude
    } else if (city || address) {
      try {
        const query = [address, postalCode, city, country].filter(Boolean).join(', ')
        const geocoder = new window.google.maps.Geocoder()
        const result = await new Promise((resolve, reject) =>
          geocoder.geocode({ address: query }, (results, status) =>
            status === 'OK' && results[0] ? resolve(results[0]) : reject(status)
          )
        )
        update.latitude = result.geometry.location.lat()
        update.longitude = result.geometry.location.lng()
      } catch {}
    }
    if (Object.keys(update).length) {
      setLoading(true)
      try { await membersApi.update(user.memberId, { ...update, familyId: member?.familyId }) } catch {}
      setLoading(false)
    }
    onDone()
  }

  function handlePlaceSelect({ address, postalCode, city, country, latitude, longitude }) {
    setAddress(address); setPostalCode(postalCode); setCity(city)
    setCountry(country); setCoords({ latitude, longitude })
  }

  const onNext = [handleNext0, handleNext1, handleFinish]

  return createPortal(
    <div
      className="fixed inset-0 z-[200] flex flex-col overflow-hidden"
      style={{ background: 'linear-gradient(160deg, #1c0c04 0%, #2a1208 60%, #160902 100%)' }}
    >
      {/* Ambient orbs */}
      <div className="pointer-events-none absolute -top-20 -right-16 h-80 w-80 rounded-full bg-primary/20 blur-3xl" />
      <div className="pointer-events-none absolute top-1/2 -left-24 h-64 w-64 rounded-full bg-amber-900/25 blur-3xl" />
      <div className="pointer-events-none absolute bottom-20 right-0 h-56 w-56 rounded-full bg-orange-950/30 blur-3xl" />

      {/* Top bar */}
      <div className="relative flex items-center justify-between px-5 pt-14 pb-0 shrink-0">
        <div className="w-10">
          {step > 0 && (
            <button
              onClick={() => { setErrors({}); setStep(s => s - 1) }}
              className="h-9 w-9 flex items-center justify-center rounded-full bg-white/10 text-white active:bg-white/20 transition-colors"
            >
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
              </svg>
            </button>
          )}
        </div>

        {/* Step pills */}
        <div className="flex items-center gap-1.5">
          {STEP_META.map((s, i) => (
            <div key={i} className={`flex items-center gap-1 rounded-full text-xs font-semibold transition-all duration-300 ${
              i === step
                ? 'bg-primary text-white px-3 py-1'
                : i < step
                  ? 'bg-primary/30 text-white/50 w-6 h-6 justify-center'
                  : 'bg-white/10 text-white/25 w-6 h-6 justify-center'
            }`}>
              {i < step ? '✓' : i === step ? `${i + 1}  ${s.label}` : i + 1}
            </div>
          ))}
        </div>

        <div className="w-10" />
      </div>

      {/* Hero illustration per step */}
      <div className="relative flex items-center justify-center shrink-0 py-8">
        {step === 0 && (
          <div className="relative flex flex-col items-center gap-3">
            <div className="absolute h-44 w-44 rounded-full bg-primary/20 blur-2xl" />
            <button
              onClick={() => fileRef.current?.click()}
              className={`relative h-36 w-36 rounded-full flex items-center justify-center overflow-hidden transition-all duration-300 ${
                photoPreview
                  ? 'ring-4 ring-primary ring-offset-4 ring-offset-transparent'
                  : 'border-2 border-dashed border-white/20 bg-white/5'
              }`}
            >
              {photoPreview ? (
                <img src={photoPreview} alt="" className="h-full w-full object-cover" />
              ) : (
                <div className="flex flex-col items-center gap-2 text-white/25">
                  <svg className="h-10 w-10" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M6.827 6.175A2.31 2.31 0 015.186 7.23c-.38.054-.757.112-1.134.175C2.999 7.58 2.25 8.507 2.25 9.574V18a2.25 2.25 0 002.25 2.25h15A2.25 2.25 0 0021.75 18V9.574c0-1.067-.75-1.994-1.802-2.169a47.865 47.865 0 00-1.134-.175 2.31 2.31 0 01-1.64-1.055l-.822-1.316a2.192 2.192 0 00-1.736-1.039 48.774 48.774 0 00-5.232 0 2.192 2.192 0 00-1.736 1.039l-.821 1.316z" />
                    <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 12.75a4.5 4.5 0 11-9 0 4.5 4.5 0 019 0zM18.75 10.5h.008v.008h-.008V10.5z" />
                  </svg>
                </div>
              )}
            </button>
            <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={selectPhoto} />
            <p className="text-xs text-white/40">{photoPreview ? 'Appuie pour changer' : 'Appuie pour ajouter'}</p>
          </div>
        )}

        {step === 1 && (
          <div className="flex gap-3">
            {[
              { emoji: '🎂', label: 'Anniversaire', glow: 'bg-amber-500/15' },
              { emoji: '📱', label: 'Téléphone', glow: 'bg-sky-500/10' },
            ].map(card => (
              <div key={card.label} className="relative">
                <div className={`absolute inset-0 rounded-2xl ${card.glow} blur-xl`} />
                <div className="relative h-20 w-28 rounded-2xl bg-white/[0.06] border border-white/10 flex flex-col items-center justify-center gap-1.5">
                  <span className="text-3xl">{card.emoji}</span>
                  <span className="text-[10px] text-white/40 font-medium uppercase tracking-wide">{card.label}</span>
                </div>
              </div>
            ))}
          </div>
        )}

        {step === 2 && (
          <div className="relative flex items-center justify-center">
            <div className="absolute h-36 w-36 rounded-full bg-emerald-700/15 blur-2xl" />
            <div className="relative h-24 w-24 rounded-full bg-white/[0.06] border border-white/10 flex items-center justify-center">
              <span className="text-5xl">🏠</span>
            </div>
            <div className="absolute h-24 w-24 rounded-full border border-white/[0.07] animate-ping" style={{ animationDuration: '2.5s' }} />
            <div className="absolute h-32 w-32 rounded-full border border-white/[0.04]" />
          </div>
        )}
      </div>

      {/* Text + form */}
      <div className="flex-1 flex flex-col px-6 overflow-y-auto">
        <div className="mb-5">
          <p className="text-[11px] font-semibold text-white/30 uppercase tracking-widest mb-1">
            Bienvenue, {user.firstName} !
          </p>
          <h2 className="text-2xl font-black text-white leading-tight">{STEP_META[step].title}</h2>
          <p className="text-white/45 text-sm mt-1.5 leading-relaxed">{STEP_META[step].desc}</p>
        </div>

        <div className="flex-1">
          {step === 1 && (
            <div className="flex flex-col gap-4">
              <div>
                <label className="block text-[11px] font-semibold text-white/35 uppercase tracking-wide mb-2">Date de naissance</label>
                <input type="date" value={birthDate}
                  onChange={e => { setBirthDate(e.target.value); setErrors(v => ({ ...v, birthDate: null })) }}
                  className={`${inputCls} [color-scheme:dark]`} />
                {errors.birthDate && <p className={errorCls}>{errors.birthDate}</p>}
              </div>
              <div>
                <label className="block text-[11px] font-semibold text-white/35 uppercase tracking-wide mb-2">Téléphone</label>
                <input type="tel" value={phone} inputMode="tel"
                  onChange={e => { setPhone(e.target.value.replace(/[^0-9\s+\-().]/g, '')); setErrors(v => ({ ...v, phone: null })) }}
                  placeholder="06 12 34 56 78" className={inputCls} />
                {errors.phone && <p className={errorCls}>{errors.phone}</p>}
              </div>
            </div>
          )}

          {step === 2 && (
            <div className="flex flex-col gap-3">
              <div>
                <label className="block text-[11px] font-semibold text-white/35 uppercase tracking-wide mb-2">Adresse</label>
                <PlacesInput value={address} onChange={setAddress} onSelect={handlePlaceSelect} />
              </div>
              <div className="flex gap-3">
                <div className="flex-1">
                  <label className="block text-[11px] font-semibold text-white/35 uppercase tracking-wide mb-2">Code postal</label>
                  <input type="text" value={postalCode} onChange={e => setPostalCode(e.target.value)} placeholder="75001" className={inputCls} />
                </div>
                <div className="flex-1">
                  <label className="block text-[11px] font-semibold text-white/35 uppercase tracking-wide mb-2">Ville</label>
                  <input type="text" value={city} onChange={e => setCity(e.target.value)} placeholder="Paris" className={inputCls} />
                </div>
              </div>
              <div>
                <label className="block text-[11px] font-semibold text-white/35 uppercase tracking-wide mb-2">Pays</label>
                <input type="text" value={country} onChange={e => setCountry(e.target.value)} placeholder="France" className={inputCls} />
              </div>
            </div>
          )}
        </div>

        {/* CTA */}
        <div className="py-6 space-y-2">
          <button
            onClick={onNext[step]}
            disabled={loading}
            className="w-full py-4 rounded-2xl font-bold text-sm text-white disabled:opacity-50 active:scale-[0.98] transition-transform shadow-lg"
            style={{ background: 'linear-gradient(135deg, #b07848 0%, #7a4f2e 100%)', boxShadow: '0 4px 20px rgba(168,112,72,0.35)' }}
          >
            {loading ? 'Enregistrement…' : step < 2 ? 'Continuer →' : 'Terminer 🎉'}
          </button>
          <button
            onClick={step < 2 ? () => setStep(s => s + 1) : onDone}
            className="w-full py-2 text-sm text-white/20 text-center"
          >
            {step < 2 ? 'Passer cette étape' : "Passer pour l'instant"}
          </button>
        </div>
      </div>
    </div>,
    document.body
  )
}
