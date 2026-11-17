import { useSyncExternalStore } from 'react'

// Ambient sound: the on/off switch and the browser autoplay rules. The sounds themselves are synthesised in
// audioEngine.ts (no audio files, so nothing is copyrighted) and loaded on demand.
//
// Browsers only allow audio after a click, tap or key press. Until then the state is 'pending' and the
// first gesture anywhere on the page starts the sound (unless the visitor muted it earlier).

export type SoundState = 'pending' | 'on' | 'off'

const KEY = 'chargezio-sound'

function savedOff(): boolean {
  try {
    return localStorage.getItem(KEY) === 'off'
  } catch {
    return false
  }
}
function save(off: boolean) {
  try {
    localStorage.setItem(KEY, off ? 'off' : 'on')
  } catch {
    /* storage can be blocked */
  }
}

let state: SoundState = savedOff() ? 'off' : 'pending'
let ctx: AudioContext | null = null
let engine: import('./audioEngine').Engine | null = null
let loading = false
const subs = new Set<() => void>()

function setState(s: SoundState) {
  if (s === state) return
  state = s
  subs.forEach((f) => f())
}

// Must run inside a user gesture: the AudioContext is created and resumed right here, synchronously
// (Safari insists), and the engine that fills it is loaded afterwards.
function start() {
  const AC = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext
  if (!AC) {
    setState('off')
    return
  }
  if (!ctx) {
    ctx = new AC()
    // the icon follows what the browser really does: blocked audio shows as pending, and flips to on once it runs
    ctx.onstatechange = () => {
      if (ctx?.state === 'running' && state === 'pending') setState('on')
    }
  }
  void ctx.resume()
  setState('on')
  const c0 = ctx
  setTimeout(() => {
    if (state === 'on' && c0.state === 'suspended' && !document.hidden) setState('pending')
  }, 400)
  if (engine || loading) {
    engine?.setMuted(false)
    return
  }
  loading = true
  const c = ctx
  void import('./audioEngine')
    .then((m) => {
      engine = m.createEngine()
      engine.attach(c)
      engine.setMuted(state !== 'on')
    })
    .catch(() => {
      loading = false
      setState('off')
    })
}

export function toggleSound() {
  if (state === 'on') {
    save(true)
    setState('off')
    engine?.setMuted(true)
  } else {
    save(false)
    start()
  }
}

// Starts the sound on the first click / tap / key press anywhere (except on the sound button, which has its own handler).
export function initSound() {
  const gesture = (e: Event) => {
    if (state === 'off') return
    if ((e.target as Element | null)?.closest?.('[data-sound-toggle]')) return
    if (!ctx) start()
    else if (ctx.state === 'suspended' && state === 'on' && !document.hidden) void ctx.resume()
  }
  const events = ['pointerup', 'touchend', 'click', 'keydown'] as const
  events.forEach((n) => window.addEventListener(n, gesture, { passive: true }))
  return () => events.forEach((n) => window.removeEventListener(n, gesture))
}

const subscribe = (f: () => void) => {
  subs.add(f)
  return () => {
    subs.delete(f)
  }
}
export const useSoundState = () => useSyncExternalStore(subscribe, () => state)
