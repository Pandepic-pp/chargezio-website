import type { ReactNode } from 'react'
import { Link } from './router'

export function Logo() {
  return (
    <Link className="logo" to="/" aria-label="Chargezio home">
      <img src="/logo.svg" alt="Chargezio" width="103" height="30" />
    </Link>
  )
}

export function Header({ cta }: { cta: ReactNode }) {
  return (
    <header className="header">
      <Logo />
      <nav aria-label="Main">
        <Link to="/about">About us</Link>
      </nav>
      {cta}
    </header>
  )
}

export function Footer() {
  return (
    <footer className="footer">
      <Logo />
      <span>Charge anywhere. Drive everywhere.</span>
      <span>
        <Link to="/about">About us</Link> · © 2026 Chargezio
      </span>
    </footer>
  )
}

export function StoreButtons() {
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
