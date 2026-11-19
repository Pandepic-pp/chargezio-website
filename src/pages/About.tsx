import { useEffect } from 'react'
import { Link } from '../router'
import { Footer, Header } from '../ui'
import { story } from '../story'

// Founders are shown by role and point of view only: no names, photos or bios.
const founders = [
  {
    role: 'Founder, UX and product experience',
    pov: 'A charging app gets used in a hurry, often with one hand. If a screen needs explaining, the design has failed. Good UX comes from listening to users, then taking things away. Every screen in Chargezio should answer one question: what does the driver do next?',
  },
  {
    role: 'Founder, brand and design direction',
    pov: 'A brand is a promise you keep on every screen. I turn scattered pages, apps and campaigns into one clear identity. For Chargezio that means the same calm, simple feel from the first ad to the last receipt, for drivers and for charging partners.',
  },
  {
    role: 'Founding engineer',
    pov: 'Most charging problems are data problems. Stations, prices and availability sit in different systems that do not talk to each other. I build the integrations and AI tools that connect big systems and make them easy to use in plain language. Chargezio is that idea applied to charging, built on real signals, not assumptions.',
  },
]

export default function About() {
  // Opening on this page first: the sound is gated on the loader, which only the home page sets.
  useEffect(() => {
    story.loaderDone = true
  }, [])

  useEffect(() => {
    const prev = document.title
    document.title = 'About us | Chargezio'
    return () => {
      document.title = prev
    }
  }, [])

  return (
    <>
      <Header />
      <main>
        <section className="ab-hero">
          <div className="wrap">
            <span className="eyebrow">About us</span>
            <h1>Charging should be as easy as filling up.</h1>
            <p>
              Chargezio connects EV drivers and charging networks across India on one platform. Placeholder: replace with the
              company story.
            </p>
          </div>
        </section>

        <section className="section tight">
          <div className="wrap ab-split">
            <p className="ab-quote">We build the layer between drivers and chargers, so neither has to think about the other.</p>
            <div className="ab-values">
              <div><h3>Simple for drivers</h3><p>Find, plug in, pay. Nothing more to learn.</p></div>
              <div><h3>Fair for partners</h3><p>Clear numbers and on-time payouts.</p></div>
              <div><h3>Built in India</h3><p>For Indian roads, connectors and payments.</p></div>
            </div>
          </div>
        </section>

        <section className="section tight alt">
          <div className="wrap">
            <div className="head">
              <span className="eyebrow">Founders</span>
              <h2>Three people, one belief: charging should feel simple.</h2>
              <p>
                We come from fashion tech, where we build products used by thousands of people every day. We bring the same standards
                to EV charging.
              </p>
            </div>
            <div className="ab-founders">
              {founders.map((f) => (
                <figure className="ab-founder" key={f.role}>
                  <figcaption>{f.role}</figcaption>
                  <blockquote>{f.pov}</blockquote>
                </figure>
              ))}
            </div>
          </div>
        </section>

        <section className="section tight">
          <div className="wrap">
            <div className="cta">
              <h2>Want to work with us?</h2>
              <p>Charging network or driver, we would like to hear from you.</p>
              <div className="stores">
                <Link className="btn btn-light" to="/#partners">
                  Become a partner
                </Link>
                <Link className="btn btn-outline" to="/#drivers">
                  Get the app
                </Link>
              </div>
            </div>
          </div>
        </section>
      </main>
      <Footer />
    </>
  )
}
