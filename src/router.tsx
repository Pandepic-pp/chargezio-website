import { useEffect, useState, type AnchorHTMLAttributes, type MouseEvent } from 'react'

// Tiny router: two pages only ("/" and "/about"), so a library is not worth it.
const read = () => location.pathname.replace(/\/+$/, '') || '/'

export function navigate(to: string) {
  history.pushState(null, '', to)
  window.dispatchEvent(new Event('app:navigate'))
}

export function useRoute() {
  const [route, setRoute] = useState(read)
  useEffect(() => {
    const on = () => setRoute(read())
    window.addEventListener('popstate', on)
    window.addEventListener('app:navigate', on)
    return () => {
      window.removeEventListener('popstate', on)
      window.removeEventListener('app:navigate', on)
    }
  }, [])
  return route
}

export function Link({ to, onClick, ...rest }: { to: string } & AnchorHTMLAttributes<HTMLAnchorElement>) {
  return (
    <a
      href={to}
      {...rest}
      onClick={(e: MouseEvent<HTMLAnchorElement>) => {
        onClick?.(e)
        if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return
        e.preventDefault()
        navigate(to)
      }}
    />
  )
}
