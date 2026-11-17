import { useEffect, useState, type ReactNode } from 'react'
import { Link, useRoute } from './router'
import { scrollToId, scrollToTop } from './scroll'
import { story, type Theme } from './story'
import { applyTheme } from './theme'
import { toggleSound, useSoundState } from './audio'

const BASE = import.meta.env.BASE_URL

// The logo has dark lettering, so the dark theme gets a light-lettered copy. CSS shows the right one.
export function Logo() {
  return (
    <Link className="logo" to="/" aria-label="Chargezio home">
      <img className="logo-light" src={BASE + 'logo.svg'} alt="Chargezio" width="103" height="30" />
      <img className="logo-dark" src={BASE + 'logo-dark.svg'} alt="" width="103" height="30" aria-hidden="true" />
    </Link>
  )
}

export function ThemeToggle() {
  const [theme, setTheme] = useState<Theme>(() => story.theme)
  const dark = theme === 'dark'
  const toggle = () => {
    const next: Theme = dark ? 'light' : 'dark'
    setTheme(next)
    applyTheme(next)
  }
  return (
    <button className="hd-icon theme-toggle" type="button" onClick={toggle} aria-label={dark ? 'Switch to light mode' : 'Switch to dark mode'} aria-pressed={dark} title={dark ? 'Light mode' : 'Dark mode'}>
      {dark ? (
        <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true">
          <circle cx="12" cy="12" r="4.2" fill="currentColor" />
          <g stroke="currentColor" strokeWidth="2" strokeLinecap="round">
            <path d="M12 2.5v2.4M12 19.1v2.4M2.5 12h2.4M19.1 12h2.4M5.3 5.3 7 7M17 17l1.7 1.7M18.7 5.3 17 7M7 17l-1.7 1.7" />
          </g>
        </svg>
      ) : (
        <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true">
          <path fill="currentColor" d="M20.2 14.6A8.4 8.4 0 0 1 9.4 3.8a.6.6 0 0 0-.8-.7A9.6 9.6 0 1 0 20.9 15.4a.6.6 0 0 0-.7-.8z" />
        </svg>
      )}
    </button>
  )
}

// Ambient sound switch. 'pending' = waiting for the first click/tap (browsers block audio until then), shown as muted with a pulse.
export function SoundToggle() {
  const state = useSoundState()
  const on = state === 'on'
  const label = on ? 'Mute ambient sound' : state === 'pending' ? 'Turn on ambient sound' : 'Unmute ambient sound'
  return (
    <button
      className={`hd-icon sound-toggle${state === 'pending' ? ' pending' : ''}`}
      type="button"
      data-sound-toggle
      onClick={toggleSound}
      aria-label={label}
      aria-pressed={on}
      title={on ? 'Sound on' : 'Sound off'}
    >
      <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true">
        <path fill="currentColor" d="M3 9.5v5a1 1 0 0 0 1 1h3.2l4.3 3.6c.6.5 1.5.1 1.5-.7V5.6c0-.8-.9-1.2-1.5-.7L7.2 8.5H4a1 1 0 0 0-1 1z" />
        {on ? (
          <g fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
            <path d="M16.6 9.2a4 4 0 0 1 0 5.6" />
            <path d="M19.2 6.6a7.6 7.6 0 0 1 0 10.8" />
          </g>
        ) : (
          <path d="m16.5 9.5 5 5m0-5-5 5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
        )}
      </svg>
    </button>
  )
}

// One nav link: same shape, size and states everywhere. The current page is marked (colour and aria-current).
function NavLink({ to, className = '', children }: { to: string; className?: string; children: ReactNode }) {
  const route = useRoute()
  const current = route === to
  return (
    <Link
      to={to}
      className={`hd-link ${className}`}
      aria-current={current ? 'page' : undefined}
      onClick={(e) => {
        // already on the home page: "Home" scrolls back to the top instead of doing nothing
        if (current && to === '/') {
          e.preventDefault()
          scrollToTop()
        }
      }}
    >
      {children}
    </Link>
  )
}

// The same "Get started" button on every page: on the home page it scrolls to the choice, elsewhere it goes there.
function GetStarted() {
  const route = useRoute()
  return route === '/' ? (
    <button className="btn btn-sm hd-cta" type="button" onClick={() => scrollToId('choose')}>
      Get started
    </button>
  ) : (
    <Link className="btn btn-sm hd-cta" to="/#choose">
      Get started
    </Link>
  )
}

// The header floats clear over the 3D story. Once the page content is under it (past the story, or on any other page)
// it becomes a soft, blurred bar so the content never runs into the buttons.
function useSolid() {
  const [solid, setSolid] = useState(false)
  useEffect(() => {
    let raf = 0
    const check = () => {
      raf = 0
      const story = document.querySelector('.story')
      const next = story ? story.getBoundingClientRect().bottom < 72 : window.scrollY > 8
      setSolid((prev) => (prev === next ? prev : next))
    }
    const on = () => {
      if (!raf) raf = requestAnimationFrame(check)
    }
    check()
    window.addEventListener('scroll', on, { passive: true })
    window.addEventListener('resize', on)
    return () => {
      cancelAnimationFrame(raf)
      window.removeEventListener('scroll', on)
      window.removeEventListener('resize', on)
    }
  }, [])
  return solid
}

export function Header() {
  const solid = useSolid()
  return (
    <header className={`header${solid ? ' solid' : ''}`}>
      <Logo />
      <div className="hd-right">
        <nav className="hd-nav" aria-label="Main">
          <NavLink to="/" className="hd-home">
            Home
          </NavLink>
          <NavLink to="/about">About us</NavLink>
        </nav>
        <div className="hd-tools">
          <SoundToggle />
          <ThemeToggle />
        </div>
        <GetStarted />
      </div>
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
