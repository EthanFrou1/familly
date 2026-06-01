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
  { label: 'App',    title: "Installe l'appli",     desc: "Ajoute MyBigFamily sur ton écran d'accueil pour l'ouvrir comme une vraie application." },
]

const PWA_STEPS = {
  apple: [
    { icon: '🧭', text: 'Ouvre ce site dans Safari (pas Chrome ni Firefox)' },
    { icon: '⬆️', text: 'Appuie sur le bouton Partager en bas de l\'écran' },
    { icon: '➕', text: 'Fais défiler et appuie sur « Sur l\'écran d\'accueil »' },
    { icon: '✅', text: 'Appuie sur « Ajouter » en haut à droite' },
  ],
  android: [
    { icon: '🌐', text: 'Ouvre ce site dans Chrome' },
    { icon: '⋮', text: 'Appuie sur les 3 points en haut à droite' },
    { icon: '➕', text: 'Appuie sur « Ajouter à l\'écran d\'accueil »' },
    { icon: '✅', text: 'Confirme en appuyant sur « Ajouter »' },
  ],
}

function detectPhoneType() {
  const ua = navigator.userAgent
  if (/iPhone|iPad|iPod/.test(ua)) return 'apple'
  if (/Android/.test(ua)) return 'android'
  return null
}

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
  const [phoneType, setPhoneType] = useState(detectPhoneType)
  const [showVideo, setShowVideo] = useState(false)
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

  async function handleNext2() {
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
    setStep(3)
  }

  function handlePlaceSelect({ address, postalCode, city, country, latitude, longitude }) {
    setAddress(address); setPostalCode(postalCode); setCity(city)
    setCountry(country); setCoords({ latitude, longitude })
  }

  const onNext = [handleNext0, handleNext1, handleNext2, onDone]

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

        {step === 3 && phoneType === 'apple' && (
          <button
            type="button"
            onClick={() => setShowVideo(true)}
            className="relative rounded-2xl overflow-hidden active:opacity-80 transition-opacity"
            style={{ width: 90, height: 160 }}
          >
            <img
              src="https://img.youtube.com/vi/UxCvNcRYVUU/hqdefault.jpg"
              alt="Tutoriel PWA iPhone"
              className="w-full h-full object-cover"
            />
            <div className="absolute inset-0 bg-black/30 flex items-center justify-center">
              <div className="h-12 w-12 rounded-full bg-white/90 flex items-center justify-center shadow-lg">
                <svg className="h-5 w-5 text-gray-900 ml-0.5" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M8 5v14l11-7z" />
                </svg>
              </div>
            </div>
          </button>
        )}

        {step === 3 && phoneType !== 'apple' && (
          <div className="flex gap-4 items-center">
            <div className="relative">
              <div className="absolute inset-0 rounded-2xl bg-primary/15 blur-xl" />
              <div className="relative h-20 w-20 rounded-2xl bg-white/[0.06] border border-white/10 flex flex-col items-center justify-center gap-1">
                <span className="text-3xl">📲</span>
                <span className="text-[10px] text-white/40 font-medium uppercase tracking-wide">Accueil</span>
              </div>
            </div>
            <svg className="h-5 w-5 text-white/20" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M13 7l5 5m0 0l-5 5m5-5H6" />
            </svg>
            <div className="relative">
              <div className="absolute inset-0 rounded-2xl bg-amber-500/10 blur-xl" />
              <div className="relative h-20 w-20 rounded-2xl bg-white/[0.06] border border-white/10 flex flex-col items-center justify-center gap-1">
                <span className="text-3xl">🌳</span>
                <span className="text-[10px] text-white/40 font-medium uppercase tracking-wide">App</span>
              </div>
            </div>
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

          {step === 3 && (
            <div className="flex flex-col gap-4">
              {/* Phone type selector */}
              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={() => setPhoneType('apple')}
                  className={`flex-1 flex flex-col items-center gap-2 rounded-2xl border py-3 transition-all ${
                    phoneType === 'apple'
                      ? 'border-primary bg-primary/15 text-white'
                      : 'border-white/10 bg-white/[0.04] text-white/40'
                  }`}
                >
                  <svg className="h-6 w-6" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M18.71 19.5c-.83 1.24-1.71 2.45-3.05 2.47-1.34.03-1.77-.79-3.29-.79-1.53 0-2 .77-3.27.82-1.31.05-2.3-1.32-3.14-2.53C4.25 17 2.94 12.45 4.7 9.39c.87-1.52 2.43-2.48 4.12-2.51 1.28-.02 2.5.87 3.29.87.78 0 2.26-1.07 3.8-.91.65.03 2.47.26 3.64 1.98-.09.06-2.17 1.28-2.15 3.81.03 3.02 2.65 4.03 2.68 4.04-.03.07-.42 1.44-1.38 2.83M13 3.5c.73-.83 1.94-1.46 2.94-1.5.13 1.17-.34 2.35-1.04 3.19-.69.85-1.83 1.51-2.95 1.42-.15-1.15.41-2.35 1.05-3.11z"/>
                  </svg>
                  <span className="text-xs font-semibold">iPhone</span>
                </button>
                <button
                  type="button"
                  onClick={() => setPhoneType('android')}
                  className={`flex-1 flex flex-col items-center gap-2 rounded-2xl border py-3 transition-all ${
                    phoneType === 'android'
                      ? 'border-primary bg-primary/15 text-white'
                      : 'border-white/10 bg-white/[0.04] text-white/40'
                  }`}
                >
                  <svg className="h-6 w-6" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M17.523 15.3414c-.5511 0-.9993-.4486-.9993-.9997s.4482-.9993.9993-.9993c.5511 0 .9993.4482.9993.9993.0001.5511-.4482.9997-.9993.9997m-11.046 0c-.5511 0-.9993-.4486-.9993-.9997s.4482-.9993.9993-.9993c.5511 0 .9993.4482.9993.9993 0 .5511-.4482.9997-.9993.9997m11.4045-6.02l1.9973-3.4592a.416.416 0 00-.1521-.5676.416.416 0 00-.5676.1521l-2.0223 3.503C15.5902 8.2439 13.8533 7.8508 12 7.8508s-3.5902.3931-5.1367 1.0989L4.841 5.4467a.4161.4161 0 00-.5677-.1521.4157.4157 0 00-.1521.5676l1.9973 3.4592C2.6889 11.1867.3432 14.6589 0 18.761h24c-.3435-4.1021-2.6892-7.5743-6.1185-9.4396"/>
                  </svg>
                  <span className="text-xs font-semibold">Android</span>
                </button>
              </div>

              {/* iPhone : vignette vidéo + étapes */}
              {phoneType === 'apple' && (
                <>
                  <button
                    type="button"
                    onClick={() => setShowVideo(true)}
                    className="w-full flex items-center gap-4 rounded-2xl bg-white/[0.06] border border-white/[0.10] px-4 py-3 active:opacity-70 transition-opacity"
                  >
                    <div className="relative rounded-xl overflow-hidden shrink-0" style={{ width: 52, height: 88 }}>
                      <img
                        src="https://img.youtube.com/vi/UxCvNcRYVUU/hqdefault.jpg"
                        alt="Tutoriel"
                        className="w-full h-full object-cover"
                      />
                      <div className="absolute inset-0 bg-black/40 flex items-center justify-center">
                        <div className="h-7 w-7 rounded-full bg-white/90 flex items-center justify-center">
                          <svg className="h-3.5 w-3.5 text-gray-900 ml-0.5" fill="currentColor" viewBox="0 0 24 24">
                            <path d="M8 5v14l11-7z" />
                          </svg>
                        </div>
                      </div>
                    </div>
                    <div className="flex-1 text-left">
                      <p className="text-sm font-semibold text-white">Voir le tutoriel vidéo</p>
                      <p className="text-xs text-white/40 mt-0.5">Guide pas à pas pour iPhone • Safari</p>
                    </div>
                    <svg className="h-4 w-4 text-white/30 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                    </svg>
                  </button>
                  <div className="space-y-2">
                    {PWA_STEPS.apple.map((s, i) => (
                      <div key={i} className="flex items-start gap-3 rounded-2xl bg-white/[0.05] border border-white/[0.07] px-4 py-3">
                        <span className="text-xl shrink-0 mt-0.5">{s.icon}</span>
                        <div className="flex-1">
                          <span className="text-[10px] font-bold text-primary/70 uppercase tracking-wide">Étape {i + 1}</span>
                          <p className="text-sm text-white/75 leading-snug">{s.text}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </>
              )}

              {/* Android : étapes texte */}
              {phoneType === 'android' && (
                <div className="space-y-2">
                  {PWA_STEPS.android.map((s, i) => (
                    <div key={i} className="flex items-start gap-3 rounded-2xl bg-white/[0.05] border border-white/[0.07] px-4 py-3">
                      <span className="text-xl shrink-0 mt-0.5">{s.icon}</span>
                      <div className="flex-1">
                        <span className="text-[10px] font-bold text-primary/70 uppercase tracking-wide">Étape {i + 1}</span>
                        <p className="text-sm text-white/75 leading-snug">{s.text}</p>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {!phoneType && (
                <p className="text-sm text-white/30 text-center py-4">Choisis ton type de téléphone ci-dessus</p>
              )}
            </div>
          )}
        </div>

        {/* CTA */}
        <div className="py-6 space-y-2">
          <button
            onClick={onNext[step]}
            disabled={loading}
            className="w-full py-4 rounded-2xl font-bold text-sm text-white disabled:opacity-50 active:scale-[0.98] transition-transform shadow-lg"
            style={{ background: 'linear-gradient(135deg, var(--c-primary) 0%, var(--c-primary-dark) 100%)', boxShadow: '0 4px 20px rgba(36,92,51,0.35)' }}
          >
            {loading ? 'Enregistrement…' : step < 3 ? 'Continuer →' : "C'est parti ! 🎉"}
          </button>
          <button
            onClick={step < 3 ? () => setStep(s => s + 1) : onDone}
            className="w-full py-2 text-sm text-white/20 text-center"
          >
            {step < 3 ? 'Passer cette étape' : "Passer pour l'instant"}
          </button>
        </div>
      </div>

      {/* Modale vidéo plein écran */}
      {showVideo && createPortal(
        <div className="fixed inset-0 z-[300] flex items-center justify-center bg-black/90" onClick={() => setShowVideo(false)}>
          <button
            onClick={() => setShowVideo(false)}
            className="absolute top-6 right-5 h-10 w-10 flex items-center justify-center rounded-full bg-white/10 text-white active:bg-white/20"
          >
            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
          <div
            className="rounded-2xl overflow-hidden"
            style={{ width: '80vw', maxWidth: 360, aspectRatio: '9/16' }}
            onClick={e => e.stopPropagation()}
          >
            <iframe
              src="https://www.youtube.com/embed/UxCvNcRYVUU?autoplay=1&playsinline=1&rel=0"
              allow="autoplay; fullscreen"
              allowFullScreen
              className="w-full h-full border-0"
            />
          </div>
        </div>,
        document.body
      )}
    </div>,
    document.body
  )
}
