import { useEffect } from 'react'
import { Link } from '../router'
import { Footer, Header } from '../ui'
import { story } from '../story'

// Founder details are placeholders until the real names, roles, bios and photos are supplied.
const founders = [
  { name: 'Founder name', role: 'Role, for example Co-founder and CEO' },
  { name: 'Founder name', role: 'Role, for example Co-founder and CTO' },
  { name: 'Founder name', role: 'Role' },
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
              <h2>The people behind Chargezio.</h2>
            </div>
            <div className="ab-founders">
              {founders.map((f, i) => (
                <div className="ab-founder" key={i}>
                  <div className="ab-photo">Photo</div>
                  <h3>{f.name}</h3>
                  <span>{f.role}</span>
                  <p>Two-line bio goes here.</p>
                </div>
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
