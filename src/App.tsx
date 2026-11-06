import { lazy, Suspense, useEffect, useRef, useState } from 'react'
import { detectQuality, hasWebGL, story } from './story'
import { initScroll } from './scroll'

const Experience = lazy(() => import('./Experience'))

function Logo() {
  return (
    <a className="logo" href="#top" aria-label="Chargezio home">
      <svg viewBox="0 0 24 24" width="26" height="26" aria-hidden="true">
        <path d="M12 2C8.1 2 5 5.1 5 9c0 5.2 7 13 7 13s7-7.8 7-13c0-3.9-3.1-7-7-7z" fill="#05C158" />
        <path d="M12.8 5.5 8.8 10.7h2.7l-.6 4.3 4-5.3h-2.7z" fill="#fff" />
      </svg>
      <span>Chargezio</span>
    </a>
  )
}

function StoreButtons() {
  return (
    <div className="stores">
      <a className="store" href="#" aria-label="Download on the App Store">
        <svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true">
          <path fill="currentColor" d="M16.4 12.6c0-2.3 1.9-3.4 2-3.5-1.1-1.6-2.8-1.8-3.4-1.8-1.4-.1-2.8.9-3.5.9s-1.8-.8-3-.8c-1.5 0-3 .9-3.8 2.3-1.6 2.8-.4 7 1.2 9.2.8 1.1 1.7 2.4 2.9 2.3 1.2 0 1.6-.8 3-.8s1.8.8 3 .7c1.2 0 2-1.1 2.8-2.2.9-1.3 1.2-2.5 1.3-2.6-.1 0-2.5-1-2.5-3.7zM14.1 5.8c.6-.8 1.1-1.9 1-3-1 0-2.1.6-2.8 1.4-.6.7-1.1 1.8-1 2.9 1.1.1 2.2-.5 2.8-1.3z" />
        </svg>
        <span>
          <small>Download on the</small>
          App Store
        </span>
      </a>
      <a className="store" href="#" aria-label="Get it on Google Play">
        <svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true">
          <path fill="currentColor" d="M4 2.8v18.4c0 .5.5.8.9.6l9.6-9.2L4.9 2.2c-.4-.2-.9.1-.9.6zm11.5 8.1 2.8-2.7-11-6.2 8.2 8.9zm0 2.2-8.2 8.9 11-6.2-2.8-2.7zM20.3 10.7l-2.2-1.2-3 2.5 3 2.5 2.3-1.3c.8-.5.8-1.6-.1-2.5z" />
        </svg>
        <span>
          <small>Get it on</small>
          Google Play
        </span>
      </a>
    </div>
  )
}

function Caption({ a, b, wide, children }: { a: number; b: number; wide?: boolean; children: React.ReactNode }) {
  return (
    <div className="cap">
      <div className={wide ? 'cap-in wide' : 'cap-in'} data-cap data-in={a} data-out={b}>
        {children}
      </div>
    </div>
  )
}

export default function App() {
  const storyRef = useRef<HTMLElement>(null)
  const [webgl] = useState(hasWebGL)
  const [quality] = useState(() => detectQuality())
  const [ready, setReady] = useState(!webgl)

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

  return (
    <>
      <div className={`loader ${ready ? 'done' : ''}`} aria-hidden={ready}>
        <Logo />
        <div className="loader-bar">
          <i />
        </div>
      </div>

      <header className="header" id="top">
        <Logo />
        <nav aria-label="Main">
          <a href="#app">The app</a>
          <a href="#download">Download</a>
        </nav>
        <a className="btn btn-sm" href="#download">
          Get the app
        </a>
      </header>
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
              <p>Find a charger, plug in and pay. All from one app.</p>
              <a className="btn" href="#download">
                Get the app
              </a>
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

        <section className="section" id="app">
          <div className="wrap">
            <div className="head" data-reveal>
              <span className="eyebrow">04 · The app</span>
              <h2>Everything for the road ahead.</h2>
              <p>Wallet, trips and route planning in one place.</p>
            </div>

            <div className="phones">
              <figure className="phone-wrap" data-reveal>
                <div className="phone" role="img" aria-label="Wallet and payments screen">
                  <div className="ph-head">
                    <b>Wallet &amp; Payments</b>
                    <span>Manage your balance and transactions</span>
                  </div>
                  <div className="balance">
                    <span>Chargezio Wallet Balance</span>
                    <strong>₹2,450.00</strong>
                    <em>Add Money</em>
                  </div>
                  <div className="chips">
                    <i>₹500</i>
                    <i>₹1,000</i>
                    <i>₹2,000</i>
                  </div>
                  <div className="row">
                    <span>Primary</span>
                    <b>Chargezio Wallet</b>
                  </div>
                  <div className="row">
                    <span>Linked</span>
                    <b>Paytm Wallet</b>
                  </div>
                </div>
                <figcaption>Wallet</figcaption>
              </figure>

              <figure className="phone-wrap mid" data-reveal>
                <div className="phone" role="img" aria-label="My trips screen">
                  <div className="ph-head">
                    <b>My Trips</b>
                    <span>Your charging session history</span>
                  </div>
                  <div className="stats">
                    <div>
                      <b>28</b>
                      <span>Sessions</span>
                    </div>
                    <div>
                      <b>₹3,248</b>
                      <span>Spent</span>
                    </div>
                    <div>
                      <b>168 kWh</b>
                      <span>Energy</span>
                    </div>
                  </div>
                  <div className="card">
                    <div className="card-top">
                      <div>
                        <b>ChargeOne Ecospace</b>
                        <span>Bellandur, Bengaluru</span>
                      </div>
                      <div className="amt">
                        <b>₹166.75</b>
                        <em>Completed</em>
                      </div>
                    </div>
                    <div className="meta">
                      <span>18.5 kWh</span>
                      <span>48 min</span>
                      <span>76 kW</span>
                    </div>
                  </div>
                  <div className="card">
                    <div className="card-top">
                      <div>
                        <b>BPCL EV Point</b>
                        <span>Koramangala, Bengaluru</span>
                      </div>
                      <div className="amt">
                        <b>₹82.80</b>
                        <em>Completed</em>
                      </div>
                    </div>
                    <div className="meta">
                      <span>9.2 kWh</span>
                      <span>22 min</span>
                      <span>60 kW</span>
                    </div>
                  </div>
                </div>
                <figcaption>Trips</figcaption>
              </figure>

              <figure className="phone-wrap" data-reveal>
                <div className="phone" role="img" aria-label="Trip planner screen">
                  <div className="ph-head">
                    <b>Trip Planner</b>
                    <span>Plan your EV journey</span>
                  </div>
                  <div className="route">
                    <div>
                      <span>From</span>
                      <b>Bengaluru, Karnataka</b>
                    </div>
                    <div>
                      <span>To</span>
                      <b>Madikeri, Coorg</b>
                    </div>
                  </div>
                  <div className="modes">
                    <div className="on">
                      <b>Fastest</b>
                      <span>4h 10m</span>
                    </div>
                    <div>
                      <b>Balanced</b>
                      <span>4h 35m</span>
                    </div>
                    <div>
                      <b>Eco</b>
                      <span>5h 20m</span>
                    </div>
                  </div>
                  <div className="map" aria-hidden="true">
                    <svg viewBox="0 0 200 110" preserveAspectRatio="none">
                      <path d="M12 92 C50 90 60 40 100 50 S160 20 188 18" fill="none" stroke="#05C158" strokeWidth="4" strokeLinecap="round" />
                      <circle cx="12" cy="92" r="6" fill="#fff" stroke="#05C158" strokeWidth="3" />
                      <circle cx="188" cy="18" r="6" fill="#05C158" />
                      <circle cx="82" cy="46" r="5" fill="#25C96D" />
                      <circle cx="140" cy="36" r="5" fill="#25C96D" />
                    </svg>
                  </div>
                  <div className="pill">2 enroute chargers</div>
                </div>
                <figcaption>Trip planner</figcaption>
              </figure>
            </div>

            <ul className="chips-row" data-reveal>
              <li>Live charger map</li>
              <li>Wallet and payments</li>
              <li>Trip planner</li>
              <li>Charging history</li>
              <li>Receipts and invoices</li>
            </ul>
          </div>
        </section>

        <section className="section cta-section" id="download">
          <div className="wrap">
            <div className="cta" data-reveal>
              <h2>Ready to charge?</h2>
              <p>Download Chargezio and plug in today.</p>
              <StoreButtons />
            </div>
          </div>
        </section>
      </main>

      <footer className="footer">
        <Logo />
        <span>Charge anywhere. Drive everywhere.</span>
        <span>© 2026 Chargezio</span>
      </footer>
    </>
  )
}
