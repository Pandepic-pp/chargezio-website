import { createRoot } from 'react-dom/client'
import '@fontsource-variable/inter'
import 'lenis/dist/lenis.css'
import './styles.css'
import App from './App'
import { applyTheme, initialTheme } from './theme'

history.scrollRestoration = 'manual'
window.scrollTo(0, 0)
document.documentElement.classList.add('intro')

applyTheme(initialTheme(), false, true)

createRoot(document.getElementById('root')!).render(<App />)
