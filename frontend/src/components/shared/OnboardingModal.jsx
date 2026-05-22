import { useState, useRef, useEffect } from 'react'
import { createPortal } from 'react-dom'
import { membersApi } from '../../services/api'

const inputCls = "w-full rounded-xl bg-white/10 border border-white/15 px-4 py-3 text-white text-sm placeholder-white/25 focus:outline-none focus:border-white/40"
const errorCls = "text-xs text-red-400 mt-1"

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
    <input
      ref={inputRef}
      defaultValue={value}
      onChange={e => onChange(e.target.value)}
      className={inputCls}
      placeholder="23 rue de la Paix, Paris..."
    />
  )
}

const TITLES = ['Ta photo de profil', 'Tes infos', 'Ta localisation']
const DESCS = [
  'Ajoute une photo pour que la famille te reconnaisse.',
  'Renseigne ta date de naissance et ton téléphone.',
  'Indique où tu habites pour apparaître sur la carte famille.',
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
    if (coords.latitude) update.latitude = coords.latitude
    if (coords.longitude) update.longitude = coords.longitude
    if (Object.keys(update).length) {
      setLoading(true)
      try { await membersApi.update(user.memberId, { ...update, familyId: member?.familyId }) } catch {}
      setLoading(false)
    }
    onDone()
  }

  function handlePlaceSelect({ address, postalCode, city, country, latitude, longitude }) {
    setAddress(address)
    setPostalCode(postalCode)
    setCity(city)
    setCountry(country)
    setCoords({ latitude, longitude })
  }

  const onNext = [handleNext0, handleNext1, handleFinish]
  const nextLabel = step < 2 ? 'Suivant' : 'Terminer'
  const skipLabel = step < 2 ? 'Passer cette étape' : "Passer pour l'instant"

  return createPortal(
    <div className="fixed inset-0 z-[200] flex flex-col bg-dark">
      <div className="flex-1 flex flex-col px-6 pb-8 overflow-y-auto" style={{ paddingTop: '3rem' }}>

        {/* Header */}
        <div className="flex items-start gap-3 mb-8">
          {step > 0 && (
            <button
              onClick={() => { setErrors({}); setStep(s => s - 1) }}
              className="mt-1 h-8 w-8 flex items-center justify-center rounded-full bg-white/10 text-white shrink-0"
            >
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
              </svg>
            </button>
          )}
          <div>
            <p className="text-white/50 text-sm mb-1">Bienvenue, {user.firstName} !</p>
            <h2 className="text-2xl font-bold text-white">{TITLES[step]}</h2>
            <p className="text-white/60 text-sm mt-2 leading-relaxed">{DESCS[step]}</p>
          </div>
        </div>

        {/* Contenu */}
        <div className="flex-1">
          {step === 0 && (
            <div className="flex flex-col items-center gap-4">
              <button
                onClick={() => fileRef.current?.click()}
                className="h-28 w-28 rounded-full flex items-center justify-center overflow-hidden border-2 border-dashed border-white/30 bg-white/5"
              >
                {photoPreview
                  ? <img src={photoPreview} alt="" className="h-full w-full object-cover" />
                  : <svg className="h-8 w-8 text-white/30" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M6.827 6.175A2.31 2.31 0 015.186 7.23c-.38.054-.757.112-1.134.175C2.999 7.58 2.25 8.507 2.25 9.574V18a2.25 2.25 0 002.25 2.25h15A2.25 2.25 0 0021.75 18V9.574c0-1.067-.75-1.994-1.802-2.169a47.865 47.865 0 00-1.134-.175 2.31 2.31 0 01-1.64-1.055l-.822-1.316a2.192 2.192 0 00-1.736-1.039 48.774 48.774 0 00-5.232 0 2.192 2.192 0 00-1.736 1.039l-.821 1.316z" />
                      <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 12.75a4.5 4.5 0 11-9 0 4.5 4.5 0 019 0zM18.75 10.5h.008v.008h-.008V10.5z" />
                    </svg>
                }
              </button>
              <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={selectPhoto} />
              <button onClick={() => fileRef.current?.click()} className="text-sm text-white/60 underline underline-offset-2">
                {photoFile || photoPreview ? 'Changer la photo' : 'Choisir une photo'}
              </button>
            </div>
          )}

          {step === 1 && (
            <div className="flex flex-col gap-4">
              <div>
                <label className="block text-xs text-white/50 mb-1.5">Date de naissance</label>
                <input
                  type="date"
                  value={birthDate}
                  onChange={e => { setBirthDate(e.target.value); setErrors(v => ({ ...v, birthDate: null })) }}
                  className={`${inputCls} [color-scheme:dark]`}
                />
                {errors.birthDate && <p className={errorCls}>{errors.birthDate}</p>}
              </div>
              <div>
                <label className="block text-xs text-white/50 mb-1.5">Téléphone</label>
                <input
                  type="tel"
                  value={phone}
                  onChange={e => {
                    setPhone(e.target.value.replace(/[^0-9\s+\-().]/g, ''))
                    setErrors(v => ({ ...v, phone: null }))
                  }}
                  placeholder="06 12 34 56 78"
                  inputMode="tel"
                  className={inputCls}
                />
                {errors.phone && <p className={errorCls}>{errors.phone}</p>}
              </div>
            </div>
          )}

          {step === 2 && (
            <div className="flex flex-col gap-4">
              <div>
                <label className="block text-xs text-white/50 mb-1.5">Adresse</label>
                <PlacesInput value={address} onChange={setAddress} onSelect={handlePlaceSelect} />
              </div>
              <div className="flex gap-3">
                <div className="flex-1">
                  <label className="block text-xs text-white/50 mb-1.5">Code postal</label>
                  <input type="text" value={postalCode} onChange={e => setPostalCode(e.target.value)}
                    placeholder="75001" className={inputCls} />
                </div>
                <div className="flex-1">
                  <label className="block text-xs text-white/50 mb-1.5">Ville</label>
                  <input type="text" value={city} onChange={e => setCity(e.target.value)}
                    placeholder="Paris" className={inputCls} />
                </div>
              </div>
              <div>
                <label className="block text-xs text-white/50 mb-1.5">Pays</label>
                <input type="text" value={country} onChange={e => setCountry(e.target.value)}
                  placeholder="France" className={inputCls} />
              </div>
            </div>
          )}
        </div>

        {/* Progress dots */}
        <div className="flex justify-center gap-2 my-8">
          {TITLES.map((_, i) => (
            <div key={i} className={`h-1.5 rounded-full transition-all duration-300 ${i === step ? 'w-6 bg-primary' : i < step ? 'w-1.5 bg-primary/40' : 'w-1.5 bg-white/20'}`} />
          ))}
        </div>

        {/* Actions */}
        <div className="space-y-3">
          <button
            onClick={onNext[step]}
            disabled={loading}
            className="w-full py-3.5 rounded-2xl bg-primary text-white font-semibold text-sm disabled:opacity-50 active:scale-[0.98] transition-transform"
          >
            {loading ? 'Enregistrement…' : nextLabel}
          </button>
          <button
            onClick={step < 2 ? () => setStep(s => s + 1) : onDone}
            className="w-full py-2 text-sm text-white/35 text-center"
          >
            {skipLabel}
          </button>
        </div>
      </div>
    </div>,
    document.body
  )
}
