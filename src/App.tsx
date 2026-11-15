import { lazy, Suspense, useEffect, useRef, useState } from 'react'
import { detectQuality, hasWebGL, story } from './story'
import { initScroll, scrollToId } from './scroll'
import { useRoute } from './router'
import { Footer, Header, Logo } from './ui'
import type { Path } from './paths/types'
import DriversPath from './paths/DriversPath'
import PartnersPath from './paths/PartnersPath'
import About from './pages/About'

const Experience = lazy(() => import('./Experience'))

function Caption({ a, b, wide, children }: { a: number; b: number; wide?: boolean; children: React.ReactNode }) {
  return (
    <div className="cap">
      <div className={wide ? 'cap-in wide' : 'cap-in'} data-cap data-in={a} data-out={b}>
        {children}
      </div>
    </div>
  )
}

const pathFromHash = (): Path | null => {
  const h = location.hash.replace('#', '')
  return h === 'partners' || h === 'drivers' ? h : null
}

function Home() {
  const storyRef = useRef<HTMLElement>(null)
  const [webgl] = useState(hasWebGL)
  const [quality] = useState(() => detectQuality())
  const [ready, setReady] = useState(!webgl)
  const [path, setPath] = useState<Path | null>(pathFromHash)

  useEffect(() => {
    story.quality = quality
    if (!storyRef.current) return
    return initScroll(storyRef.current)
  }, [quality])

  // Safety net so the loader never blocks the page.
  useEffect(() => {
    const t = setTimeout(() => setReady(true), 3500)
    return () => clearTimeout(t)
  }, [])

  // A link like /#partners opens straight on that path.
  useEffect(() => {
    if (!pathFromHash()) return
    const t = setTimeout(() => scrollToId('path', 90, true), 700)
    return () => clearTimeout(t)
  }, [])

  function choose(p: Path) {
    setPath(p)
    history.replaceState(null, '', `#${p}`)
    requestAnimationFrame(() => scrollToId('path', 90))
  }

  return (
    <>
      <div className={`loader ${ready ? 'done' : ''}`} aria-hidden={ready}>
        <Logo />
        <div className="loader-bar">
          <i />
        </div>
      </div>

      <Header
        cta={
          <button className="btn btn-sm" type="button" onClick={() => scrollToId('choose')}>
            Get started
          </button>
        }
      />
      <div className="topbar" aria-hidden="true">
        <i />
      </div>

      <main>
        <section className="story" ref={storyRef} aria-label="Chargezio story">
          <div className="sticky">
            {webgl ? (
              <Suspense fallback={null}>
                <Experience quality={quality} onReady={() => setTimeout(() => setReady(true), 350)} />
              </Suspense>
            ) : (
              <div className="nogl" aria-hidden="true" />
            )}

            <div className="scrim" aria-hidden="true" />

            <Caption a={-0.1} b={0.12} wide>
              <h1>
                Charge anywhere.
                <br />
                Drive everywhere.
              </h1>
              <p>One platform for EV drivers and the networks that power them.</p>
              <button className="btn" type="button" onClick={() => scrollToId('choose')}>
                Get started
              </button>
            </Caption>

            <Caption a={0.15} b={0.34}>
              <span className="eyebrow">01 · Plug in</span>
              <h2>Find it. Plug in.</h2>
              <p>Pick a nearby charger in the app, then plug in. That is it.</p>
            </Caption>

            <Caption a={0.37} b={0.6}>
              <span className="eyebrow">02 · Charge</span>
              <h2>Watch it fill up.</h2>
              <p>Live power, energy and cost, right on your phone.</p>
              <div className="hud" aria-label="Sample charging session">
                <svg viewBox="0 0 88 88" width="88" height="88" aria-hidden="true">
                  <circle cx="44" cy="44" r="38" fill="none" stroke="#E5E6EA" strokeWidth="7" />
                  <circle
                    data-hud="ring"
                    cx="44"
                    cy="44"
                    r="38"
                    fill="none"
                    stroke="#05C158"
                    strokeWidth="7"
                    strokeLinecap="round"
                    strokeDasharray={2 * Math.PI * 38}
                    strokeDashoffset={2 * Math.PI * 38 * 0.76}
                    transform="rotate(-90 44 44)"
                  />
                </svg>
                <b data-hud="pct">24%</b>
                <dl>
                  <div>
                    <dt>Energy</dt>
                    <dd data-hud="kwh">0.0 kWh</dd>
                  </div>
                  <div>
                    <dt>Time</dt>
                    <dd data-hud="mins">0 min</dd>
                  </div>
                  <div>
                    <dt>Power</dt>
                    <dd data-hud="kw">0 kW</dd>
                  </div>
                  <div>
                    <dt>Cost</dt>
                    <dd data-hud="cost">₹0.00</dd>
                  </div>
                </dl>
              </div>
            </Caption>

            <Caption a={0.66} b={0.9}>
              <span className="eyebrow">03 · Drive</span>
              <h2>Unplug and go.</h2>
              <p>Your receipt is ready before you pull away.</p>
            </Caption>

            <div className="scrollhint" aria-hidden="true">
              <span>Scroll</span>
              <i />
            </div>
          </div>
        </section>

        <section className="section choose" id="choose">
          <div className="wrap">
            <div className="head center" data-reveal>
              <span className="eyebrow">What next</span>
              <h2>Which side of the plug are you on?</h2>
              <p>Pick one and we will show you what matters to you.</p>
            </div>

            <div className="ch-grid" role="group" aria-label="Choose your path" data-reveal>
              <button type="button" className="ch-card" aria-pressed={path === 'partners'} onClick={() => choose('partners')}>
                <span className="ch-ico" aria-hidden="true">
                  <svg viewBox="0 0 24 24" width="26" height="26"><path fill="currentColor" d="M13 2 4 14h6l-1 8 9-12h-6z" /></svg>
                </span>
                <b>I run charging stations</b>
                <span>Link your network to Chargezio and reach more drivers.</span>
                <em>For partners →</em>
              </button>
              <button type="button" className="ch-card" aria-pressed={path === 'drivers'} onClick={() => choose('drivers')}>
                <span className="ch-ico" aria-hidden="true">
                  <svg viewBox="0 0 24 24" width="26" height="26"><path fill="currentColor" d="M12 2a7 7 0 0 0-7 7c0 5.2 7 13 7 13s7-7.8 7-13a7 7 0 0 0-7-7zm0 9.5A2.5 2.5 0 1 1 12 6.5a2.5 2.5 0 0 1 0 5z" /></svg>
                </span>
                <b>I drive an EV</b>
                <span>Find chargers, pay and plan trips from one app.</span>
                <em>For drivers →</em>
              </button>
            </div>
          </div>
        </section>

        <div id="path" aria-live="polite">
          {path === 'partners' && <PartnersPath onSwitch={choose} />}
          {path === 'drivers' && <DriversPath onSwitch={choose} />}
        </div>
      </main>

      <Footer />
    </>
  )
}

export default function App() {
  const route = useRoute()

  useEffect(() => {
    if (!location.hash) window.scrollTo(0, 0)
  }, [route])

  return route === '/about' ? <About /> : <Home />
}
