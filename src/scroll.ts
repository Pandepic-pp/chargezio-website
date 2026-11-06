import Lenis from 'lenis'
import gsap from 'gsap'
import { ScrollTrigger } from 'gsap/ScrollTrigger'
import { clamp, smooth, story } from './story'

gsap.registerPlugin(ScrollTrigger)

// One ticker drives everything: Lenis smooth scroll, story progress, DOM captions,
// the charging HUD and the 3D render. Nothing here goes through React state.
export function initScroll(el: HTMLElement) {
  story.reduced = matchMedia('(prefers-reduced-motion: reduce)').matches

  let top = 0
  let total = 1
  let docMax = 1
  const measure = () => {
    top = el.getBoundingClientRect().top + window.scrollY
    total = Math.max(1, el.offsetHeight - window.innerHeight)
    docMax = Math.max(1, document.documentElement.scrollHeight - window.innerHeight)
    story.dirty = 4
  }
  measure()
  const ro = new ResizeObserver(measure)
  ro.observe(el)
  ro.observe(document.body)
  window.addEventListener('resize', measure)

  const caps = Array.from(el.querySelectorAll<HTMLElement>('[data-cap]')).map((node) => ({
    node,
    a: parseFloat(node.dataset.in ?? '0'),
    b: parseFloat(node.dataset.out ?? '1'),
    last: -1,
  }))
  const q = <T extends HTMLElement | SVGElement>(sel: string) => document.querySelector<T>(sel)
  const hud = {
    pct: q('[data-hud="pct"]'),
    kwh: q('[data-hud="kwh"]'),
    mins: q('[data-hud="mins"]'),
    kw: q('[data-hud="kw"]'),
    cost: q('[data-hud="cost"]'),
    ring: q<SVGCircleElement>('[data-hud="ring"]'),
  }
  const bar = q<HTMLElement>('.topbar i')
  const hint = q<HTMLElement>('.scrollhint')

  let lenis: Lenis | null = null
  if (!story.reduced) {
    lenis = new Lenis({ lerp: 0.1, smoothWheel: true, anchors: true })
    lenis.on('scroll', ScrollTrigger.update)
  }
  gsap.ticker.lagSmoothing(0)

  let lastSmooth = -1
  let lastRender = 0
  let slow = 0
  let ema = 16.7
  const RING = 2 * Math.PI * 38

  const tick = (time: number, dt: number) => {
    lenis?.raf(time * 1000)

    const raw = clamp((window.scrollY - top) / total)
    story.progress = raw
    const k = story.reduced ? 1 : 1 - Math.exp((-dt / 1000) * 14)
    let s = story.smooth + (raw - story.smooth) * k
    if (Math.abs(raw - s) < 1e-5) s = raw
    story.smooth = s
    const moving = Math.abs(s - lastSmooth) > 1e-6
    lastSmooth = s

    story.visible = window.scrollY > top - window.innerHeight && window.scrollY < top + total + window.innerHeight

    if (bar) bar.style.transform = `scaleX(${clamp(window.scrollY / docMax)})`
    if (hint) hint.style.opacity = String(1 - smooth(0.0, 0.04, s))

    if (story.visible) {
      for (const c of caps) {
        const fin = smooth(c.a, c.a + 0.035, s)
        const fout = 1 - smooth(c.b - 0.035, c.b, s)
        const o = fin * fout
        if (Math.abs(o - c.last) > 0.002) {
          c.last = o
          c.node.style.opacity = String(o)
          c.node.style.visibility = o < 0.01 ? 'hidden' : 'visible'
          c.node.style.transform = `translate3d(0, ${(1 - fin) * 28 - (1 - fout) * 28}px, 0)`
        }
      }

      if (s > 0.34 && s < 0.64 && hud.pct) {
        const c = smooth(0.38, 0.58, s)
        const pct = Math.round(24 + c * 41)
        hud.pct.textContent = `${pct}%`
        hud.ring?.setAttribute('stroke-dashoffset', String(RING * (1 - pct / 100)))
        if (hud.kwh) hud.kwh.textContent = `${(c * 18.5).toFixed(1)} kWh`
        if (hud.mins) hud.mins.textContent = `${Math.round(c * 48)} min`
        if (hud.cost) hud.cost.textContent = `₹${(c * 166.75).toFixed(2)}`
        if (hud.kw) hud.kw.textContent = c <= 0.001 || c >= 0.999 ? '0 kW' : `${Math.round(76 * (0.55 + 0.45 * Math.sin(c * Math.PI)))} kW`
      }
    }

    // Render only when something changed or the scene is animating on its own.
    const animated = !story.reduced && (s < 0.14 || (s > 0.36 && s < 0.6))
    if (story.visible && story.advance && (moving || animated || story.dirty > 0)) {
      story.advance(time * 1000)
      if (story.dirty > 0) story.dirty--

      // Adaptive resolution: if consecutive rendered frames stay slow, drop resolution a step.
      if (lastRender > 0 && time - lastRender < 0.05) {
        ema = ema * 0.94 + dt * 0.06
        slow = ema > 26 ? slow + 1 : 0
        if (slow > 90) {
          slow = 0
          ema = 16.7
          story.onSlow?.()
        }
      }
      lastRender = time
    }
  }
  gsap.ticker.add(tick)

  // Reveal animations for the sections below the story.
  const ctx = gsap.context(() => {
    if (story.reduced) return
    gsap.utils.toArray<HTMLElement>('[data-reveal]').forEach((node, i) => {
      gsap.from(node, {
        y: 48,
        opacity: 0,
        duration: 0.9,
        ease: 'power3.out',
        delay: (i % 3) * 0.08,
        scrollTrigger: { trigger: node, start: 'top 88%', once: true },
      })
    })
  })

  return () => {
    gsap.ticker.remove(tick)
    ctx.revert()
    lenis?.destroy()
    ro.disconnect()
    window.removeEventListener('resize', measure)
  }
}
