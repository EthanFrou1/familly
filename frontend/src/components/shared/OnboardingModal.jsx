import { useState, useRef, useEffect, createPortal } from 'react'
import { membersApi } from '../../services/api'

export default function OnboardingModal({ user, onDone }) {
  const [step, setStep] = useState(0)
  const [member, setMember] = useState(null)
  const [photoFile, setPhotoFile] = useState(null)
  const [photoPreview, setPhotoPreview] = useState(null)
  const [birthDate, setBirthDate] = useState('')
  const [phone, setPhone] = useState('')
  const [city, setCity] = useState('')
  const [loading, setLoading] = useState(false)
  const fileRef = useRef()

  useEffect(() => {
    membersApi.getById(user.memberId).then(({ data }) => {
      setMember(data)
      if (data.birthDate) setBirthDate(data.birthDate.split('T')[0])
      if (data.phone) setPhone(data.phone)
      if (data.city) setCity(data.city)
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
    const update = {}
    if (birthDate) update.birthDate = birthDate
    if (phone) update.phone = phone
    if (Object.keys(update).length > 0) {
      setLoading(true)
      try { await membersApi.update(user.memberId, { ...update, familyId: member?.familyId }) } catch {}
      setLoading(false)
    }
    setStep(2)
  }

  async function handleFinish() {
    if (city) {
      setLoading(true)
      try { await membersApi.update(user.memberId, { city, familyId: member?.familyId }) } catch {}
      setLoading(false)
    }
    onDone()
  }

  const steps = [
    { title: 'Ta photo de profil', desc: 'Ajoute une photo pour que la famille te reconnaisse.', onNext: handleNext0, nextLabel: 'Suivant' },
    { title: 'Tes infos', desc: 'Renseigne ta date de naissance et ton téléphone.', onNext: handleNext1, nextLabel: 'Suivant' },
    { title: 'Ta ville', desc: 'Indique où tu habites pour apparaître sur la carte famille.', onNext: handleFinish, nextLabel: 'Terminer' },
  ]

  const current = steps[step]

  return createPortal(
    <div className="fixed inset-0 z-[200] flex flex-col bg-dark">
      <div className="flex-1 flex flex-col px-6 pb-8 overflow-y-auto" style={{ paddingTop: '3rem' }}>

        <div className="mb-8">
          <p className="text-white/50 text-sm mb-1">Bienvenue, {user.firstName} !</p>
          <h2 className="text-2xl font-bold text-white">{current.title}</h2>
          <p className="text-white/60 text-sm mt-2 leading-relaxed">{current.desc}</p>
        </div>

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
                {photoFile ? 'Changer la photo' : photoPreview ? 'Changer la photo' : 'Choisir une photo'}
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
                  onChange={e => setBirthDate(e.target.value)}
                  className="w-full rounded-xl bg-white/10 border border-white/15 px-4 py-3 text-white text-sm focus:outline-none focus:border-white/40 [color-scheme:dark]"
                />
              </div>
              <div>
                <label className="block text-xs text-white/50 mb-1.5">Téléphone</label>
                <input
                  type="tel"
                  value={phone}
                  onChange={e => setPhone(e.target.value)}
                  placeholder="06 12 34 56 78"
                  className="w-full rounded-xl bg-white/10 border border-white/15 px-4 py-3 text-white text-sm placeholder-white/25 focus:outline-none focus:border-white/40"
                />
              </div>
            </div>
          )}

          {step === 2 && (
            <div>
              <label className="block text-xs text-white/50 mb-1.5">Ville</label>
              <input
                type="text"
                value={city}
                onChange={e => setCity(e.target.value)}
                placeholder="Paris, Lyon, Marseille…"
                className="w-full rounded-xl bg-white/10 border border-white/15 px-4 py-3 text-white text-sm placeholder-white/25 focus:outline-none focus:border-white/40"
              />
            </div>
          )}
        </div>

        <div className="flex justify-center gap-2 my-8">
          {steps.map((_, i) => (
            <div
              key={i}
              className={`h-1.5 rounded-full transition-all duration-300 ${i === step ? 'w-6 bg-primary' : i < step ? 'w-1.5 bg-primary/40' : 'w-1.5 bg-white/20'}`}
            />
          ))}
        </div>

        <div className="space-y-3">
          <button
            onClick={current.onNext}
            disabled={loading}
            className="w-full py-3.5 rounded-2xl bg-primary text-white font-semibold text-sm disabled:opacity-50 active:scale-[0.98] transition-transform"
          >
            {loading ? 'Enregistrement…' : current.nextLabel}
          </button>
          <button
            onClick={step < steps.length - 1 ? () => setStep(s => s + 1) : onDone}
            className="w-full py-2 text-sm text-white/35 text-center"
          >
            {step < steps.length - 1 ? 'Passer cette étape' : "Passer pour l'instant"}
          </button>
        </div>
      </div>
    </div>,
    document.body
  )
}
