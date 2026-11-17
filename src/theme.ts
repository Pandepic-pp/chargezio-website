import { story, type Theme } from './story'

const KEY = 'chargezio-theme'

export function initialTheme(): Theme {
  try {
    const saved = localStorage.getItem(KEY)
    if (saved === 'light' || saved === 'dark') return saved
  } catch {
    /* storage can be blocked */
  }
  return matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
}

// Sets the page theme (CSS variables) and tells the 3D scene, which eases its lights and sky to match.
export function applyTheme(t: Theme, persist = true, instant = false) {
  story.theme = t
  if (instant) story.night = t === 'dark' ? 1 : 0
  story.dirty = 6
  document.documentElement.dataset.theme = t
  document.querySelector('meta[name="theme-color"]')?.setAttribute('content', t === 'dark' ? '#0d131b' : '#F3F8FE')
  if (persist) {
    try {
      localStorage.setItem(KEY, t)
    } catch {
      /* ignore */
    }
  }
}
