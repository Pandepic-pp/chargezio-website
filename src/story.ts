// Shared, mutable story state. Read every frame by the 3D scene and the DOM overlay.
// It is a plain object on purpose: nothing here should trigger a React re-render.

export const clamp = (x: number, a = 0, b = 1) => Math.min(b, Math.max(a, x))
export const lerp = (a: number, b: number, t: number) => a + (b - a) * t
export const smooth = (a: number, b: number, x: number) => {
  const t = clamp((x - a) / (b - a))
  return t * t * (3 - 2 * t)
}

export type Quality = 'high' | 'low'
export type Theme = 'light' | 'dark'

export const story = {
  progress: 0, // raw scroll progress through the story, 0 to 1
  smooth: 0, // lightly damped progress, used by the scene
  visible: true,
  reduced: false,
  quality: 'high' as Quality,
  dirty: 4, // force a few renders after mount or resize
  advance: null as null | ((timeMs: number) => void),
  onSlow: null as null | (() => void),
  // Opening shot: bird's-eye view of the city, slow zoom to the car, then the camera settles into the hero shot.
  // Scrolling is locked until it ends.
  loaderDone: false, // the loading screen has gone
  carReady: false, // the car model has been added to the scene
  introDone: false,
  introT: 0, // seconds into the opening shot
  theme: 'light' as Theme,
  night: 0, // 0 (day) .. 1 (night), eased towards the chosen theme every frame
  introSpeed: 1, // raised when the viewer tries to scroll, to skip ahead
  onIntroDone: null as null | (() => void),
}

export const INTRO_SECONDS = 12 // the camera work is laid out on a 15 s design timeline (camera.ts) and squeezed to this

export function detectQuality(): Quality {
  if (import.meta.env.DEV && new URLSearchParams(location.search).get('q') === 'low') return 'low'
  const nav = navigator as Navigator & { deviceMemory?: number }
  const cores = nav.hardwareConcurrency ?? 8
  const mem = nav.deviceMemory ?? 8
  return cores <= 4 || mem <= 4 ? 'low' : 'high'
}

export function hasWebGL(): boolean {
  try {
    const c = document.createElement('canvas')
    const gl = c.getContext('webgl2') || c.getContext('webgl')
    if (!gl) return false
    ;(gl as WebGLRenderingContext).getExtension('WEBGL_lose_context')?.loseContext()
    return true
  } catch {
    return false
  }
}
