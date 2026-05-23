import { useState, useEffect, useRef } from 'react'
import { createPortal } from 'react-dom'
import confetti from 'canvas-confetti'
import Avatar from '../shared/Avatar'

export default function BirthdayPopup({ members, onNavigate }) {
  const [index, setIndex] = useState(0)
  const [visible, setVisible] = useState(false)
  const [dismissed, setDismissed] = useState(false)
  const fired = useRef(false)

  const todayBirthdays = members.filter(m => m.daysUntil === 0)
  const alreadyShown = sessionStorage.getItem('birthday_popup_shown') === 'true'

  useEffect(() => {
    if (todayBirthdays.length === 0 || dismissed || alreadyShown) return
    const show = setTimeout(() => {
      setVisible(true)
      sessionStorage.setItem('birthday_popup_shown', 'true')
    }, 600)
    return () => clearTimeout(show)
  }, [todayBirthdays.length, dismissed, alreadyShown])

  // Auto-dismiss after 6s
  useEffect(() => {
    if (!visible) return
    const hide = setTimeout(() => setDismissed(true), 6000)
    return () => clearTimeout(hide)
  }, [visible])

  useEffect(() => {
    if (!visible || fired.current) return
    fired.current = true

    const burst = (origin) =>
      confetti({
        particleCount: 80,
        spread: 70,
        origin,
        colors: ['#52B788', '#34D399', '#6EE7B7', '#A7F3D0', '#10B981'],
        zIndex: 9999,
      })

    burst({ x: 0.1, y: 0.6 })
    setTimeout(() => burst({ x: 0.9, y: 0.6 }), 200)
    setTimeout(() => burst({ x: 0.5, y: 0.4 }), 500)
  }, [visible])

  if (todayBirthdays.length === 0 || dismissed || !visible) return null

  const current = todayBirthdays[index]

  function handleClose() {
    setDismissed(true)
  }

  function handleNavigate() {
    handleClose()
    onNavigate(`/profile/${current.id}`)
  }

  function handleNext() {
    if (index < todayBirthdays.length - 1) setIndex(i => i + 1)
    else handleClose()
  }

  return createPortal(
    // pointer-events-none sur le wrapper = le contenu derrière reste scrollable
    <div className="fixed inset-x-0 bottom-0 z-[999] flex justify-center pb-24 pointer-events-none">
      <div className="pointer-events-auto mx-4 w-full max-w-sm animate-slide-up">
        <div className="rounded-3xl bg-white shadow-2xl overflow-hidden">
          {/* Gradient top bar */}
          <div className="h-1.5 w-full bg-gradient-to-r from-primary via-pink-400 to-yellow-400" />

          <div className="px-5 pt-4 pb-5">
            <div className="flex items-start justify-between mb-4">
              <div>
                <p className="text-[10px] font-bold text-primary uppercase tracking-widest">Anniversaire 🎂</p>
                <p className="text-lg font-bold text-gray-900 mt-0.5 leading-tight">
                  C'est le grand jour pour
                </p>
              </div>
              <button
                onClick={handleClose}
                className="text-gray-300 p-1 -mr-1 active:text-gray-500"
              >
                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <div className="flex items-center gap-3 mb-4">
              <div className="relative">
                <Avatar
                  src={current.profilePictureUrl}
                  name={`${current.firstName} ${current.lastName}`}
                  size="lg"
                />
                <span className="absolute -bottom-1 -right-1 text-lg">🎉</span>
              </div>
              <div>
                <p className="text-base font-bold text-gray-900">
                  {current.firstName} {current.lastName}
                </p>
                <p className="text-sm text-gray-400">
                  {current.age} ans aujourd'hui
                </p>
              </div>
            </div>

            <div className="flex gap-2">
              <button
                onClick={handleNavigate}
                className="flex-1 rounded-2xl bg-primary py-3 text-sm font-bold text-white active:opacity-80"
              >
                Lui souhaiter 🎊
              </button>
              {todayBirthdays.length > 1 && index < todayBirthdays.length - 1 ? (
                <button
                  onClick={handleNext}
                  className="rounded-2xl border border-gray-200 px-4 py-3 text-sm font-semibold text-gray-600 active:bg-gray-50"
                >
                  Suivant
                </button>
              ) : (
                <button
                  onClick={handleClose}
                  className="rounded-2xl border border-gray-200 px-4 py-3 text-sm font-semibold text-gray-600 active:bg-gray-50"
                >
                  Fermer
                </button>
              )}
            </div>

            {todayBirthdays.length > 1 && (
              <div className="flex justify-center gap-1.5 mt-3">
                {todayBirthdays.map((_, i) => (
                  <div
                    key={i}
                    className={`h-1.5 rounded-full transition-all ${i === index ? 'w-4 bg-primary' : 'w-1.5 bg-gray-200'}`}
                  />
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>,
    document.body
  )
}
