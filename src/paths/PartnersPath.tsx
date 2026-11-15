import { useState, type FormEvent } from 'react'
import type { Path } from './types'

// TODO: set this to the real lead endpoint (Supabase function, email service, CRM).
// While it is empty the form only shows the thank-you state and sends nothing.
const LEAD_ENDPOINT = ''

const benefits = [
  { t: 'More drivers find you', p: 'Your stations show on the live map with connectors and availability.' },
  { t: 'Payments handled', p: 'Wallet and UPI inside the app. No card machines, no manual billing.' },
  { t: 'See everything', p: 'Sessions, energy, revenue and uptime for every station.' },
  { t: 'Live status', p: 'Drivers see which chargers are free right now, so fewer wasted trips.' },
]

export default function PartnersPath({ onSwitch }: { onSwitch: (p: Path) => void }) {
  const [sent, setSent] = useState(false)

  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const data = Object.fromEntries(new FormData(e.currentTarget).entries())
    if (LEAD_ENDPOINT) {
      try {
        await fetch(LEAD_ENDPOINT, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data) })
      } catch {
        /* keep the thank-you state; the endpoint owner sees failures server side */
      }
    } else {
      console.info('Lead form submitted (no endpoint set):', data)
    }
    setSent(true)
  }

  return (
    <div className="path-in">
      <section className="section tight">
        <div className="wrap pt-hero">
          <div className="pt-copy">
            <span className="eyebrow">For charging networks</span>
            <h2>Put your chargers in front of every EV driver.</h2>
            <p>
              Connect your stations to Chargezio. Drivers find them on the map, start a session and pay in the app. You see every
              session and every rupee in one dashboard.
            </p>
            <div className="pt-actions">
              <a className="btn" href="#partner-form">
                Become a partner
              </a>
              <a className="btn btn-ghost" href="#partner-how">
                See how it works
              </a>
            </div>
          </div>

          <div className="pt-dash" role="img" aria-label="Sample partner dashboard with sessions, revenue and station status">
            <div className="pt-dash-top">
              <i />
              <i />
              <i />
              <span>Partner dashboard · sample data</span>
            </div>
            <div className="pt-kpis">
              <div>
                <small>Sessions today</small>
                <b>1,284</b>
                <em>+12% vs last week</em>
              </div>
              <div>
                <small>Revenue today</small>
                <b>₹2.4L</b>
                <em>+8%</em>
              </div>
              <div>
                <small>Uptime</small>
                <b>98.6%</b>
                <em>312 of 318 online</em>
              </div>
            </div>
            <div className="pt-chart">
              <svg viewBox="0 0 400 130" aria-hidden="true">
                <g stroke="#e5e6ea" strokeWidth="1">
                  <line x1="28" y1="20" x2="392" y2="20" />
                  <line x1="28" y1="60" x2="392" y2="60" />
                  <line x1="28" y1="100" x2="392" y2="100" />
                </g>
                <text x="0" y="23">80</text>
                <text x="0" y="63">40</text>
                <text x="0" y="103">0</text>
                <path d="M28 88 C60 84 80 70 110 66 S160 40 200 44 S270 70 300 50 S350 26 392 22 L392 100 L28 100Z" fill="#05c158" opacity=".14" />
                <path d="M28 88 C60 84 80 70 110 66 S160 40 200 44 S270 70 300 50 S350 26 392 22" fill="none" stroke="#05c158" strokeWidth="2.5" strokeLinecap="round" />
                <circle cx="392" cy="22" r="4.5" fill="#05c158" />
                <text x="28" y="120">6 am</text>
                <text x="150" y="120">12 pm</text>
                <text x="270" y="120">6 pm</text>
                <text x="352" y="120">Now</text>
              </svg>
            </div>
            <div className="pt-table">
              <table>
                <thead>
                  <tr><th>Station</th><th>Connectors</th><th>Today</th><th>Status</th></tr>
                </thead>
                <tbody>
                  <tr><td>Ecospace, Bellandur</td><td>8 × CCS2</td><td>₹18,420</td><td><span className="pt-pill">Online</span></td></tr>
                  <tr><td>Indiranagar Hub</td><td>6 × Type 2</td><td>₹9,760</td><td><span className="pt-pill busy">Busy</span></td></tr>
                  <tr><td>Whitefield Plaza</td><td>4 × CCS2</td><td>₹0</td><td><span className="pt-pill off">Offline</span></td></tr>
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </section>

      <section className="section tight alt">
        <div className="wrap pt-grid4">
          {benefits.map((b) => (
            <div className="pt-card" key={b.t}>
              <h3>{b.t}</h3>
              <p>{b.p}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="section tight" id="partner-how">
        <div className="wrap">
          <div className="head">
            <span className="eyebrow">How it works</span>
            <h2>Live in three steps.</h2>
          </div>
          <ol className="pt-steps">
            <li><h3>Connect your network</h3><p>Share your station list and link your charger software. Our team helps with setup.</p></li>
            <li><h3>Go live in the app</h3><p>Your stations show on the map with live availability and pricing.</p></li>
            <li><h3>Drivers charge, you get paid</h3><p>Sessions and payments flow through Chargezio. Payouts follow your agreed cycle.</p></li>
          </ol>
          <ul className="chips-row pt-protocols">
            {['OCPP 1.6', 'OCPP 2.0.1', 'CCS2', 'Type 2', 'CHAdeMO', 'GB/T', 'REST API'].map((c) => (
              <li key={c}>{c}</li>
            ))}
          </ul>
          <p className="pt-note">Protocols and connectors we plan to support. Final list to be confirmed.</p>
        </div>
      </section>

      <section className="section tight alt" id="partner-form">
        <div className="wrap pt-split">
          <div className="head">
            <span className="eyebrow">Get started</span>
            <h2>Tell us about your network.</h2>
            <p>We reply within two working days with next steps.</p>
            <div className="pt-faq">
              <details open><summary>What does it cost?</summary><p>Placeholder: commission model to be confirmed.</p></details>
              <details><summary>How long does setup take?</summary><p>Placeholder: typical integration time to be confirmed.</p></details>
              <details><summary>When do I get paid?</summary><p>Placeholder: payout cycle to be confirmed.</p></details>
            </div>
          </div>

          {sent ? (
            <div className="pt-form pt-thanks" role="status">
              <h3>Thanks. We have your details.</h3>
              <p>Our team will get back to you within two working days.</p>
            </div>
          ) : (
            <form className="pt-form" onSubmit={submit}>
              <label className="pt-f"><span>Company</span><input name="company" required placeholder="Your company name" /></label>
              <label className="pt-f"><span>Your name</span><input name="name" required placeholder="Full name" /></label>
              <label className="pt-f"><span>Work email</span><input name="email" type="email" required placeholder="you@company.com" /></label>
              <label className="pt-f"><span>Phone</span><input name="phone" type="tel" placeholder="+91" /></label>
              <label className="pt-f"><span>Charge points</span>
                <select name="chargePoints" defaultValue="50 to 200">
                  <option>50 to 200</option><option>200 to 1,000</option><option>1,000+</option>
                </select>
              </label>
              <label className="pt-f"><span>Cities</span><input name="cities" placeholder="Bengaluru, Pune" /></label>
              <label className="pt-f full"><span>Anything else?</span><textarea name="message" rows={3} placeholder="Software you use, timeline, questions" /></label>
              <div className="pt-f full"><button className="btn" type="submit">Request a call</button></div>
            </form>
          )}
        </div>
      </section>

      <div className="path-switch">
        Drive an EV instead?{' '}
        <button type="button" onClick={() => onSwitch('drivers')}>See the driver side</button>
      </div>
    </div>
  )
}
