import { useCallback, useRef, useState } from 'react'

const NEUTRAL_ZONE_DEG = 15
const TRIGGER_OFFSET_DEG = 30
const TRIGGER_COOLDOWN_MS = 400
const SUPPORT_TIMEOUT_MS = 1500
const CALIBRATION_SAMPLES = 3

const needsPermissionRequest = typeof window !== 'undefined'
  && typeof window.DeviceOrientationEvent !== 'undefined'
  && typeof window.DeviceOrientationEvent.requestPermission === 'function'

// Détecte l'inclinaison avant/arrière du téléphone (angle beta) pour un jeu façon
// "tel sur le front" : baisser le front = beta qui descend sous la ligne de base = correct,
// relever le front = beta qui monte au-dessus = passe. La zone neutre + le cooldown évitent
// qu'une seule inclinaison ne déclenche plusieurs fois de suite.
export default function useTiltDetector() {
  const [supported, setSupported] = useState(null)
  const [permissionState, setPermissionState] = useState('unknown')

  const listenerRef = useRef(null)
  const wakeLockRef = useRef(null)
  const baselineRef = useRef(null)
  const samplesRef = useRef([])
  const armedRef = useRef(true)
  const lastTriggerRef = useRef(0)
  const supportTimeoutRef = useRef(null)

  const requestPermission = useCallback(async () => {
    if (!needsPermissionRequest) {
      setPermissionState('unnecessary')
      return 'unnecessary'
    }
    try {
      const result = await window.DeviceOrientationEvent.requestPermission()
      setPermissionState(result === 'granted' ? 'granted' : 'denied')
      return result
    } catch {
      setPermissionState('denied')
      return 'denied'
    }
  }, [])

  const stop = useCallback(() => {
    if (listenerRef.current) {
      window.removeEventListener('deviceorientation', listenerRef.current)
      listenerRef.current = null
    }
    if (supportTimeoutRef.current) {
      clearTimeout(supportTimeoutRef.current)
      supportTimeoutRef.current = null
    }
    if (wakeLockRef.current) {
      wakeLockRef.current.release().catch(() => {})
      wakeLockRef.current = null
    }
    baselineRef.current = null
    samplesRef.current = []
    armedRef.current = true
  }, [])

  const start = useCallback((onTilt) => {
    stop()

    if (typeof window === 'undefined' || !('DeviceOrientationEvent' in window)) {
      setSupported(false)
      return
    }

    if (navigator.wakeLock) {
      navigator.wakeLock.request('screen').then(lock => { wakeLockRef.current = lock }).catch(() => {})
    }

    let receivedEvent = false

    function handleOrientation(event) {
      if (event.beta == null) return
      receivedEvent = true
      setSupported(true)
      if (supportTimeoutRef.current) {
        clearTimeout(supportTimeoutRef.current)
        supportTimeoutRef.current = null
      }

      if (baselineRef.current == null) {
        samplesRef.current.push(event.beta)
        if (samplesRef.current.length >= CALIBRATION_SAMPLES) {
          baselineRef.current = samplesRef.current.reduce((a, b) => a + b, 0) / samplesRef.current.length
        }
        return
      }

      const delta = event.beta - baselineRef.current
      const now = Date.now()

      if (armedRef.current && now - lastTriggerRef.current > TRIGGER_COOLDOWN_MS) {
        if (delta < -TRIGGER_OFFSET_DEG) {
          armedRef.current = false
          lastTriggerRef.current = now
          onTilt('correct')
        } else if (delta > TRIGGER_OFFSET_DEG) {
          armedRef.current = false
          lastTriggerRef.current = now
          onTilt('pass')
        }
      } else if (!armedRef.current && Math.abs(delta) < NEUTRAL_ZONE_DEG) {
        armedRef.current = true
      }
    }

    listenerRef.current = handleOrientation
    window.addEventListener('deviceorientation', handleOrientation)

    supportTimeoutRef.current = setTimeout(() => {
      if (!receivedEvent) setSupported(false)
    }, SUPPORT_TIMEOUT_MS)
  }, [stop])

  return { supported, permissionState, needsPermissionRequest, requestPermission, start, stop }
}
