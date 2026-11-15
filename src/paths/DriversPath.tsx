import { StoreButtons } from '../ui'
import type { Path } from './types'

export default function DriversPath({ onSwitch }: { onSwitch: (p: Path) => void }) {
  return (
    <div className="path-in">
      <section className="section">
        <div className="wrap">
          <div className="head">
            <span className="eyebrow">For EV drivers</span>
            <h2>Everything for the road ahead.</h2>
            <p>Wallet, trips and route planning in one place.</p>
          </div>

          <div className="phones">
            <figure className="phone-wrap">
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

            <figure className="phone-wrap mid">
              <div className="phone" role="img" aria-label="My trips screen">
                <div className="ph-head">
                  <b>My Trips</b>
                  <span>Your charging session history</span>
                </div>
                <div className="stats">
                  <div><b>28</b><span>Sessions</span></div>
                  <div><b>₹3,248</b><span>Spent</span></div>
                  <div><b>168 kWh</b><span>Energy</span></div>
                </div>
                <div className="card">
                  <div className="card-top">
                    <div><b>ChargeOne Ecospace</b><span>Bellandur, Bengaluru</span></div>
                    <div className="amt"><b>₹166.75</b><em>Completed</em></div>
                  </div>
                  <div className="meta"><span>18.5 kWh</span><span>48 min</span><span>76 kW</span></div>
                </div>
                <div className="card">
                  <div className="card-top">
                    <div><b>BPCL EV Point</b><span>Koramangala, Bengaluru</span></div>
                    <div className="amt"><b>₹82.80</b><em>Completed</em></div>
                  </div>
                  <div className="meta"><span>9.2 kWh</span><span>22 min</span><span>60 kW</span></div>
                </div>
              </div>
              <figcaption>Trips</figcaption>
            </figure>

            <figure className="phone-wrap">
              <div className="phone" role="img" aria-label="Trip planner screen">
                <div className="ph-head">
                  <b>Trip Planner</b>
                  <span>Plan your EV journey</span>
                </div>
                <div className="route">
                  <div><span>From</span><b>Bengaluru, Karnataka</b></div>
                  <div><span>To</span><b>Madikeri, Coorg</b></div>
                </div>
                <div className="modes">
                  <div className="on"><b>Fastest</b><span>4h 10m</span></div>
                  <div><b>Balanced</b><span>4h 35m</span></div>
                  <div><b>Eco</b><span>5h 20m</span></div>
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
