import { useEffect, useRef } from 'react'
import { StoreButtons } from '../ui'
import type { Path } from './types'

// Real screens captured from the Chargezio app, in the order a driver meets them.
const steps = [
  { img: 'sign-in', t: 'Sign in with your number', p: 'Enter your mobile number and a one-time code. No password to remember.', alt: 'Chargezio sign in screen with a mobile number field' },
  { img: 'find', t: 'Find chargers near you', p: 'See nearby stations on a live map. Filter by DC fast or AC.', alt: 'Home screen with a live map and a list of nearby chargers' },
  { img: 'station', t: 'Check the station', p: 'Photos, address, opening hours and reviews before you drive over.', alt: 'Station details with photos, directions and reviews' },
  { img: 'charging', t: 'Charge and watch it live', p: 'Battery level, power, energy and cost update as you charge.', alt: 'Live charging session with battery percentage, power and cost' },
  { img: 'trip-planner', t: 'Plan the long drive', p: 'Pick a destination and get a route with the charging stops worked out.', alt: 'Trip planner showing a route with a charging stop' },
  { img: 'history', t: 'Keep every session', p: 'Your charging history, spend and energy used, all in one list.', alt: 'My Trips screen with charging history and totals' },
  { img: 'profile', t: 'Your car, your account', p: 'Save your EV, manage payments and see your charging stats.', alt: 'Profile screen with vehicle details and account stats' },
]

export default function DriversPath({ onSwitch }: { onSwitch: (p: Path) => void }) {
  const track = useRef<HTMLOListElement>(null)

  // Endless drift: the list is rendered twice and the scroll position wraps by one copy's width, so the
  // screens loop with no seam. It pauses while the visitor hovers, touches or focuses the row, and they can
  // still swipe or trackpad-scroll it in either direction. Reduced-motion visitors get the manual loop only.
  useEffect(() => {
    const el = track.current
    if (!el) return
    const still = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    const speed = 40 // px per second
    let pos = el.scrollLeft
    let paused = false
    let last = performance.now()
    let raf = 0

    const loopWidth = () => {
      const items = el.children
      const first = items[0] as HTMLElement | undefined
      const copy = items[steps.length] as HTMLElement | undefined
      return first && copy ? copy.offsetLeft - first.offsetLeft : 0
    }
    const wrap = () => {
      const w = loopWidth()
      if (!w) return
      if (el.scrollLeft >= w) el.scrollLeft -= w
      else if (el.scrollLeft <= 0) el.scrollLeft += w
      pos = el.scrollLeft
    }
    const tick = (now: number) => {
      const dt = Math.min(now - last, 100) / 1000
      last = now
      if (!paused && !still) {
        pos += speed * dt
        const w = loopWidth()
        if (w && pos >= w) pos -= w
        el.scrollLeft = pos
      }
      raf = requestAnimationFrame(tick)
    }

    const pause = () => {
      paused = true
    }
    const resume = () => {
      paused = false
      pos = el.scrollLeft
    }
    const onScroll = () => {
      if (paused || still) wrap()
    }
    const onLeave = () => {
      if (!el.contains(document.activeElement)) resume()
    }

    el.addEventListener('pointerenter', pause)
    el.addEventListener('pointerleave', onLeave)
    el.addEventListener('touchstart', pause, { passive: true })
    el.addEventListener('touchend', resume)
    el.addEventListener('focusin', pause)
    el.addEventListener('focusout', resume)
    el.addEventListener('scroll', onScroll, { passive: true })
    raf = requestAnimationFrame(tick)
    return () => {
      cancelAnimationFrame(raf)
      el.removeEventListener('pointerenter', pause)
      el.removeEventListener('pointerleave', onLeave)
      el.removeEventListener('touchstart', pause)
      el.removeEventListener('touchend', resume)
      el.removeEventListener('focusin', pause)
      el.removeEventListener('focusout', resume)
      el.removeEventListener('scroll', onScroll)
    }
  }, [])

  return (
    <div className="path-in">
      <section className="section">
        <div className="wrap">
          <div className="head">
            <span className="eyebrow">For EV drivers</span>
            <h2>See how Chargezio works.</h2>
            <p>From sign in to the road. These are the real screens, in the order you will use them.</p>
          </div>
        </div>

        <div className="flow">
          <div className="flow-bar wrap">
            <span className="flow-count">{steps.length} steps</span>
          </div>
          <ol className="flow-track" ref={track} tabIndex={0} aria-label="App flow, scroll sideways">
            {[...steps, ...steps].map((s, n) => {
              const i = n % steps.length
              const dupe = n >= steps.length
              return (
                <li className="flow-step" key={n} aria-hidden={dupe || undefined}>
                  <span className="flow-num">{i + 1}</span>
                  <div className="flow-phone">
                    <img
                      src={`/screens/${s.img}.webp`}
                      alt={dupe ? '' : s.alt}
                      width="720"
                      height="1565"
                      loading="lazy"
                      decoding="async"
                    />
                  </div>
                  <h3>{s.t}</h3>
                  <p>{s.p}</p>
                </li>
              )
            })}
          </ol>
        </div>

        <div className="wrap">
          <ul className="chips-row">
            <li>Live charger map</li>
            <li>Wallet and payments</li>
            <li>Trip planner</li>
            <li>Charging history</li>
            <li>Receipts and invoices</li>
          </ul>
        </div>
      </section>

      <section className="section cta-section">
        <div className="wrap">
          <div className="cta">
            <h2>Ready to charge?</h2>
            <p>Download Chargezio and plug in today.</p>
            <StoreButtons />
          </div>
        </div>
      </section>

      <div className="path-switch">
        Run charging stations?{' '}
        <button type="button" onClick={() => onSwitch('partners')}>
          See the partner side
        </button>
      </div>
    </div>
  )
}
