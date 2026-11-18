import { useRef } from 'react'
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

  const slide = (dir: 1 | -1) => {
    const el = track.current
    if (!el) return
    const step = el.querySelector('li')?.getBoundingClientRect().width ?? 300
    el.scrollBy({ left: dir * (step + 24), behavior: 'smooth' })
  }

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
            <div className="flow-nav">
              <button type="button" aria-label="Previous screens" onClick={() => slide(-1)}>
                ←
              </button>
              <button type="button" aria-label="Next screens" onClick={() => slide(1)}>
                →
              </button>
            </div>
          </div>
          <ol className="flow-track" ref={track} tabIndex={0} aria-label="App flow, scroll sideways">
            {steps.map((s, i) => (
              <li className="flow-step" key={s.img}>
                <span className="flow-num">{i + 1}</span>
                <div className="flow-phone">
                  <img src={`/screens/${s.img}.webp`} alt={s.alt} width="720" height="1565" loading="lazy" decoding="async" />
                </div>
                <h3>{s.t}</h3>
                <p>{s.p}</p>
              </li>
            ))}
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
        <button type="button" onClick={() => onSwitch('partners')}>See the partner side</button>
      </div>
    </div>
  )
}
