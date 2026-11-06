import * as THREE from 'three'

// All textures are drawn on canvases at start-up, so the site ships with no image files.

function canvas(w: number, h: number) {
  const c = document.createElement('canvas')
  c.width = w
  c.height = h
  return { c, g: c.getContext('2d')! }
}

function tex(c: HTMLCanvasElement, opts: { srgb?: boolean; repeat?: boolean; aniso?: number } = {}) {
  const t = new THREE.CanvasTexture(c)
  if (opts.srgb !== false) t.colorSpace = THREE.SRGBColorSpace
  if (opts.repeat) t.wrapS = t.wrapT = THREE.RepeatWrapping
  t.anisotropy = opts.aniso ?? 8
  t.needsUpdate = true
  return t
}

// Small seeded random so textures look the same on every load.
function rng(seed: number) {
  let s = seed >>> 0
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0
    return s / 4294967296
  }
}

export function pinPath(g: CanvasRenderingContext2D, cx: number, cy: number, s: number) {
  // The Chargezio pin, drawn from the same path as the logo.
  g.save()
  g.translate(cx - 12 * s, cy - 12 * s)
  g.scale(s, s)
  g.beginPath()
  g.moveTo(12, 2)
  g.bezierCurveTo(8.1, 2, 5, 5.1, 5, 9)
  g.bezierCurveTo(5, 14.2, 12, 22, 12, 22)
  g.bezierCurveTo(12, 22, 19, 14.2, 19, 9)
  g.bezierCurveTo(19, 5.1, 15.9, 2, 12, 2)
  g.closePath()
  g.fillStyle = '#05C158'
  g.fill()
  g.beginPath()
  g.moveTo(12.8, 5.5)
  g.lineTo(8.8, 10.7)
  g.lineTo(11.5, 10.7)
  g.lineTo(10.9, 15)
  g.lineTo(14.9, 9.7)
  g.lineTo(12.2, 9.7)
  g.closePath()
  g.fillStyle = '#fff'
  g.fill()
  g.restore()
}

// Number plates (Indian EV plates are green), the rear wordmark and the front badge.
export function makeAtlas() {
  const { c, g } = canvas(1024, 256)
  g.fillStyle = '#e8ebee'
  g.fillRect(0, 0, 1024, 256)
  const plate = (x: number, num: string) => {
    g.fillStyle = '#0f8a4a'
    g.beginPath()
    g.roundRect(x + 4, 4, 504, 107, 12)
    g.fill()
    g.strokeStyle = '#ffffff'
    g.lineWidth = 3
    g.beginPath()
    g.roundRect(x + 11, 11, 490, 93, 8)
    g.stroke()
    g.fillStyle = '#fff'
    g.textAlign = 'center'
    g.textBaseline = 'middle'
    g.font = '700 70px Inter Variable, Arial, sans-serif'
    g.fillText(num, x + 256, 60)
    g.fillStyle = '#ffffffcc'
    g.font = '700 14px Inter Variable, Arial, sans-serif'
    g.fillText('IND', x + 40, 90)
  }
  plate(0, 'KA 03 EV 2026')
  plate(512, 'KA 03 EV 2026')
  // wordmark
  g.fillStyle = '#1b1d22'
  g.fillRect(0, 130, 512, 120)
  g.fillStyle = '#d9dde3'
  g.textAlign = 'center'
  g.textBaseline = 'middle'
  g.font = '800 64px Inter Variable, Arial, sans-serif'
  g.fillText('CHARGEZIO', 256, 192)
  // badge
  g.fillStyle = '#16181c'
  g.fillRect(512, 130, 205, 120)
  pinPath(g, 614, 190, 3.6)
  return tex(c, { aniso: 4 })
}

// Soft ground shadow for the car: body shade, darker under the sills, tyre contact patches.
export function makeCarShadow() {
  const W = 512
  const H = 256
  const { c, g } = canvas(W, H)
  g.clearRect(0, 0, W, H)
  const sx = (x: number) => W / 2 + (x / 6.2) * W
  const sz = (z: number) => H / 2 + (z / 3.1) * H
  g.filter = 'blur(10px)'
  g.fillStyle = 'rgba(15,22,36,0.55)'
  g.beginPath()
  g.roundRect(sx(-2.3), sz(-0.95), sx(2.3) - sx(-2.3), sz(0.95) - sz(-0.95), 34)
  g.fill()
  g.filter = 'blur(5px)'
  g.fillStyle = 'rgba(8,12,22,0.55)'
  for (const x of [-1.39, 1.39]) {
    for (const z of [-0.745, 0.745]) {
      g.beginPath()
      g.roundRect(sx(x - 0.3), sz(z - 0.15), sx(x + 0.3) - sx(x - 0.3), sz(z + 0.15) - sz(z - 0.15), 6)
      g.fill()
    }
  }
  g.filter = 'blur(24px)'
  g.fillStyle = 'rgba(20,30,50,0.32)'
  g.beginPath()
  g.ellipse(W / 2, H / 2, W * 0.4, H * 0.36, 0, 0, Math.PI * 2)
  g.fill()
  return tex(c, { aniso: 1 })
}

export function makeRadial(inner: string, outer: string) {
  const { c, g } = canvas(128, 128)
  const grad = g.createRadialGradient(64, 64, 0, 64, 64, 64)
  grad.addColorStop(0, inner)
  grad.addColorStop(1, outer)
  g.fillStyle = grad
  g.fillRect(0, 0, 128, 128)
  return tex(c, { aniso: 1 })
}

// ---------------------------------------------------------------- road surfaces

// Tiles seamlessly: every mark is drawn again at the wrapped positions.
function wrapDraw(size: number, draw: (ox: number, oy: number) => void) {
  for (const ox of [-size, 0, size]) for (const oy of [-size, 0, size]) draw(ox, oy)
}

export function makeAsphalt(size: number) {
  const { c, g } = canvas(size, size)
  const r = rng(11)
  g.fillStyle = '#888e97'
  g.fillRect(0, 0, size, size)
  // broad tonal patches
  g.filter = `blur(${size / 18}px)`
  for (let i = 0; i < 46; i++) {
    const x = r() * size
    const y = r() * size
    const rad = size * (0.06 + r() * 0.12)
    const v = r() < 0.5 ? 'rgba(60,66,76,0.16)' : 'rgba(170,176,186,0.14)'
    wrapDraw(size, (ox, oy) => {
      g.fillStyle = v
      g.beginPath()
      g.arc(x + ox, y + oy, rad, 0, Math.PI * 2)
      g.fill()
    })
  }
  g.filter = 'none'
  // aggregate: thousands of small stones, dark and light
  const img = g.getImageData(0, 0, size, size)
  const d = img.data
  for (let i = 0; i < d.length; i += 4) {
    const n = (r() - 0.5) * 34 + (r() - 0.5) * 18
    d[i] += n
    d[i + 1] += n
    d[i + 2] += n * 1.02
  }
  g.putImageData(img, 0, 0)
  const stones = Math.floor(size * size * 0.018)
  for (let i = 0; i < stones; i++) {
    const x = r() * size
    const y = r() * size
    const s = 0.7 + r() * 1.8
    const l = r() < 0.5 ? 40 + r() * 50 : 150 + r() * 80
    g.fillStyle = `rgba(${l},${l},${l + 4},${0.25 + r() * 0.4})`
    wrapDraw(size, (ox, oy) => {
      if (x + ox > -4 && x + ox < size + 4 && y + oy > -4 && y + oy < size + 4) g.fillRect(x + ox, y + oy, s, s)
    })
  }
  return tex(c, { repeat: true })
}

export function makePaving(size: number) {
  const { c, g } = canvas(size, size)
  const r = rng(5)
  const n = 8
  const t = size / n
  g.fillStyle = '#9aa1ab'
  g.fillRect(0, 0, size, size)
  for (let i = 0; i < n; i++) {
    for (let j = 0; j < n; j++) {
      const v = 176 + r() * 22 - 8
      g.fillStyle = `rgb(${v - 4},${v - 1},${v + 6})`
      g.fillRect(i * t + 2, j * t + 2, t - 4, t - 4)
      // speckle and a soft wear patch per slab
      const gr = g.createRadialGradient(i * t + r() * t, j * t + r() * t, 2, i * t + t / 2, j * t + t / 2, t * 0.7)
      gr.addColorStop(0, `rgba(${r() < 0.5 ? '255,255,255' : '90,96,108'},0.1)`)
      gr.addColorStop(1, 'rgba(0,0,0,0)')
      g.fillStyle = gr
      g.fillRect(i * t + 2, j * t + 2, t - 4, t - 4)
    }
  }
  const img = g.getImageData(0, 0, size, size)
  const d = img.data
  for (let i = 0; i < d.length; i += 4) {
    const nn = (r() - 0.5) * 16
    d[i] += nn
    d[i + 1] += nn
    d[i + 2] += nn
  }
  g.putImageData(img, 0, 0)
  // grout lines
  g.fillStyle = 'rgba(70,76,88,0.65)'
  for (let i = 0; i <= n; i++) {
    g.fillRect(i * t - 1.5, 0, 3, size)
    g.fillRect(0, i * t - 1.5, size, 3)
  }
  return tex(c, { repeat: true })
}

export function makeConcrete(size: number) {
  const { c, g } = canvas(size, size)
  const r = rng(21)
  g.fillStyle = '#b4bac3'
  g.fillRect(0, 0, size, size)
  const img = g.getImageData(0, 0, size, size)
  const d = img.data
  for (let i = 0; i < d.length; i += 4) {
    const n = (r() - 0.5) * 22
    d[i] += n
    d[i + 1] += n
    d[i + 2] += n
  }
  g.putImageData(img, 0, 0)
  return tex(c, { repeat: true })
}

// Worn road paint: a solid colour with chips taken out and a rough edge. Used as an alpha mask.
export function makePaintWear(w: number, h: number, colour: string, seed: number) {
  const { c, g } = canvas(w, h)
  const r = rng(seed)
  g.fillStyle = colour
  g.fillRect(0, 0, w, h)
  g.globalCompositeOperation = 'destination-out'
  for (let i = 0; i < w * h * 0.0012; i++) {
    g.fillStyle = `rgba(0,0,0,${0.25 + r() * 0.6})`
    const s = 1 + r() * 4
    g.fillRect(r() * w, r() * h, s * (1 + r() * 2), s)
  }
  for (let i = 0; i < 18; i++) {
    const gr = g.createRadialGradient(r() * w, r() * h, 1, r() * w, r() * h, 20 + r() * 50)
    gr.addColorStop(0, 'rgba(0,0,0,0.35)')
    gr.addColorStop(1, 'rgba(0,0,0,0)')
    g.fillStyle = gr
    g.fillRect(0, 0, w, h)
  }
  return tex(c, { repeat: true })
}

// A sheet of surface marks (stains, cracks, patches) laid over the asphalt as transparent decals.
export function makeStains(w: number, h: number, seed: number, kind: 'oil' | 'cracks' | 'patch') {
  const { c, g } = canvas(w, h)
  const r = rng(seed)
  if (kind === 'oil') {
    for (let i = 0; i < 9; i++) {
      const x = w * (0.2 + r() * 0.6)
      const y = h * (0.25 + r() * 0.5)
      const rad = Math.min(w, h) * (0.05 + r() * 0.16)
      const gr = g.createRadialGradient(x, y, 0, x, y, rad)
      gr.addColorStop(0, 'rgba(20,22,28,0.5)')
      gr.addColorStop(0.6, 'rgba(20,22,28,0.22)')
      gr.addColorStop(1, 'rgba(20,22,28,0)')
      g.fillStyle = gr
      g.beginPath()
      g.ellipse(x, y, rad * 1.3, rad * 0.85, r() * 3, 0, Math.PI * 2)
      g.fill()
    }
  } else if (kind === 'cracks') {
    g.strokeStyle = 'rgba(25,27,33,0.85)'
    g.lineCap = 'round'
    const branch = (x: number, y: number, a: number, len: number, wd: number) => {
      g.lineWidth = wd
      g.beginPath()
      g.moveTo(x, y)
      let cx = x
      let cy = y
      let ca = a
      for (let s = 0; s < len; s += 5) {
        ca += (r() - 0.5) * 0.7
        cx += Math.cos(ca) * 5
        cy += Math.sin(ca) * 5
        g.lineTo(cx, cy)
        if (r() < 0.04 && wd > 0.8) branch(cx, cy, ca + (r() < 0.5 ? 1 : -1) * (0.6 + r() * 0.6), len * 0.35, wd * 0.6)
      }
      g.stroke()
    }
    branch(w * 0.05, h * (0.3 + r() * 0.4), 0.05, w * 0.9, 2.2)
  } else {
    // a patch of newer, darker tarmac with a sealed edge
    g.fillStyle = 'rgba(40,44,52,0.55)'
    g.fillRect(6, 6, w - 12, h - 12)
    g.strokeStyle = 'rgba(15,17,22,0.8)'
    g.lineWidth = 3
    g.strokeRect(6, 6, w - 12, h - 12)
    const img = g.getImageData(0, 0, w, h)
    for (let i = 0; i < img.data.length; i += 4) {
      if (img.data[i + 3] > 0) {
        const n = (r() - 0.5) * 60
        img.data[i] = Math.max(0, img.data[i] + n)
        img.data[i + 1] = Math.max(0, img.data[i + 1] + n)
        img.data[i + 2] = Math.max(0, img.data[i + 2] + n)
      }
    }
    g.putImageData(img, 0, 0)
  }
  return tex(c, { aniso: 4 })
}

// Manhole cover and storm drain.
export function makeManhole() {
  const { c, g } = canvas(256, 256)
  g.translate(128, 128)
  g.fillStyle = '#262a31'
  g.beginPath()
  g.arc(0, 0, 120, 0, Math.PI * 2)
  g.fill()
  g.fillStyle = '#3a3f48'
  g.beginPath()
  g.arc(0, 0, 108, 0, Math.PI * 2)
  g.fill()
  g.strokeStyle = '#20242a'
  g.lineWidth = 5
  for (let i = -100; i <= 100; i += 16) {
    g.beginPath()
    g.moveTo(i, -Math.sqrt(100 * 100 - i * i) * 0.96)
    g.lineTo(i, Math.sqrt(100 * 100 - i * i) * 0.96)
    g.stroke()
  }
  g.rotate(Math.PI / 4)
  for (let i = -100; i <= 100; i += 16) {
    g.beginPath()
    g.moveTo(i, -Math.sqrt(100 * 100 - i * i) * 0.96)
    g.lineTo(i, Math.sqrt(100 * 100 - i * i) * 0.96)
    g.stroke()
  }
  g.rotate(-Math.PI / 4)
  g.strokeStyle = '#555b66'
  g.lineWidth = 3
  g.beginPath()
  g.arc(0, 0, 112, 0, Math.PI * 2)
  g.stroke()
  g.fillStyle = '#4a505b'
  g.fillRect(-26, -9, 52, 18)
  return tex(c, { aniso: 4 })
}

export function makeDrain() {
  const { c, g } = canvas(256, 128)
  g.fillStyle = '#1b1e24'
  g.beginPath()
  g.roundRect(4, 4, 248, 120, 10)
  g.fill()
  g.fillStyle = '#434954'
  for (let i = 0; i < 10; i++) {
    g.beginPath()
    g.roundRect(14 + i * 23.2, 14, 14, 100, 4)
    g.fill()
  }
  return tex(c, { aniso: 4 })
}

// EV bay: green floor, white outline and the plug symbol.
export function makeEvBay() {
  const { c, g } = canvas(1024, 512)
  g.fillStyle = '#35b278'
  g.fillRect(0, 0, 1024, 512)
  const r = rng(3)
  g.globalCompositeOperation = 'destination-out'
  for (let i = 0; i < 6000; i++) {
    g.fillStyle = `rgba(0,0,0,${0.15 + r() * 0.5})`
    g.fillRect(r() * 1024, r() * 512, 1 + r() * 4, 1 + r() * 3)
  }
  g.globalCompositeOperation = 'source-over'
  g.strokeStyle = 'rgba(255,255,255,0.92)'
  g.lineWidth = 14
  g.strokeRect(12, 12, 1000, 488)
  return tex(c, { aniso: 8 })
}

export function makeEvSymbol() {
  const { c, g } = canvas(512, 512)
  g.translate(256, 256)
  g.fillStyle = 'rgba(255,255,255,0.95)'
  // plug body
  g.beginPath()
  g.roundRect(-92, -70, 184, 170, 46)
  g.fill()
  g.fillRect(-52, -190, 30, 130)
  g.fillRect(22, -190, 30, 130)
  g.fillRect(-14, 100, 28, 90)
  // bolt cut-out
  g.globalCompositeOperation = 'destination-out'
  g.beginPath()
  g.moveTo(14, -52)
  g.lineTo(-48, 30)
  g.lineTo(-8, 30)
  g.lineTo(-20, 86)
  g.lineTo(48, -8)
  g.lineTo(8, -8)
  g.closePath()
  g.fill()
  return tex(c, { aniso: 8 })
}

export function makeZebra() {
  const { c, g } = canvas(512, 64)
  g.fillStyle = '#f2f3f5'
  g.fillRect(0, 0, 512, 64)
  const r = rng(9)
  g.globalCompositeOperation = 'destination-out'
  for (let i = 0; i < 2600; i++) {
    g.fillStyle = `rgba(0,0,0,${0.2 + r() * 0.5})`
    g.fillRect(r() * 512, r() * 64, 1 + r() * 5, 1 + r() * 3)
  }
  return tex(c, { aniso: 8 })
}

export function makeArrow() {
  const { c, g } = canvas(256, 512)
  g.fillStyle = '#eef0f3'
  g.beginPath()
  g.moveTo(128, 20)
  g.lineTo(220, 200)
  g.lineTo(158, 200)
  g.lineTo(158, 492)
  g.lineTo(98, 492)
  g.lineTo(98, 200)
  g.lineTo(36, 200)
  g.closePath()
  g.fill()
  const r = rng(4)
  g.globalCompositeOperation = 'destination-out'
  for (let i = 0; i < 2200; i++) {
    g.fillStyle = `rgba(0,0,0,${0.2 + r() * 0.5})`
    g.fillRect(r() * 256, r() * 512, 1 + r() * 4, 1 + r() * 4)
  }
  return tex(c, { aniso: 8 })
}

// Facade with a window grid, tinted per building by the material colour.
export function makeFacade(seed: number) {
  const { c, g } = canvas(256, 512)
  const r = rng(seed)
  g.fillStyle = '#ffffff'
  g.fillRect(0, 0, 256, 512)
  const cols = 8
  const rows = 16
  const cw = 256 / cols
  const rh = 512 / rows
  for (let i = 0; i < cols; i++) {
    for (let j = 0; j < rows; j++) {
      const lit = r() < 0.06
      g.fillStyle = lit ? '#fff6d6' : r() < 0.5 ? '#cfdbe9' : '#c2d1e2'
      g.fillRect(i * cw + 6, j * rh + 7, cw - 12, rh - 12)
      g.fillStyle = 'rgba(255,255,255,0.5)'
      g.fillRect(i * cw + 6, j * rh + 7, cw - 12, 3)
    }
  }
  g.fillStyle = 'rgba(0,0,0,0.035)'
  for (let j = 0; j < rows; j += 4) g.fillRect(0, j * rh, 256, 3)
  return tex(c, { repeat: true, aniso: 4 })
}

// ---------------------------------------------------------------- charger

export type ScreenState = { mode: 'idle' | 'connect' | 'charge' | 'done'; pct: number; kw: number; mins: number; cost: number }

export function makeScreen() {
  const W = 384
  const H = 512
  const { c, g } = canvas(W, H)
  const t = tex(c, { aniso: 4 })
  let last = ''
  const draw = (s: ScreenState, pulse: number) => {
    const key = `${s.mode}|${Math.round(s.pct)}|${Math.round(s.kw)}|${Math.round(s.mins)}|${Math.round(s.cost)}|${Math.round(pulse * 8)}`
    if (key === last) return
    last = key
    g.clearRect(0, 0, W, H)
    const bg = g.createLinearGradient(0, 0, 0, H)
    bg.addColorStop(0, '#0d1b17')
    bg.addColorStop(1, '#05100c')
    g.fillStyle = bg
    g.fillRect(0, 0, W, H)
    // header
    pinPath(g, 40, 38, 1.5)
    g.fillStyle = '#fff'
    g.font = '800 26px Inter Variable, Arial, sans-serif'
    g.textAlign = 'left'
    g.textBaseline = 'middle'
    g.fillText('Chargezio', 66, 38)
    g.fillStyle = '#7fe3ab'
    g.font = '600 15px Inter Variable, Arial, sans-serif'
    g.textAlign = 'right'
    g.fillText('DC 60 kW', W - 24, 38)
    g.fillStyle = 'rgba(255,255,255,0.1)'
    g.fillRect(24, 68, W - 48, 1.5)

    g.textAlign = 'center'
    if (s.mode === 'idle') {
      g.fillStyle = '#fff'
      g.font = '800 34px Inter Variable, Arial, sans-serif'
      g.fillText('Ready', W / 2, 150)
      g.fillStyle = '#9fb3aa'
      g.font = '500 20px Inter Variable, Arial, sans-serif'
      g.fillText('Plug in to start', W / 2, 190)
      const a = 0.5 + 0.5 * pulse
      g.strokeStyle = `rgba(5,193,88,${0.25 + 0.5 * a})`
      g.lineWidth = 8
      g.beginPath()
      g.arc(W / 2, 330, 80 + 8 * a, 0, Math.PI * 2)
      g.stroke()
      g.fillStyle = '#05C158'
      g.beginPath()
      g.arc(W / 2, 330, 64, 0, Math.PI * 2)
      g.fill()
      g.fillStyle = '#fff'
      g.beginPath()
      g.moveTo(W / 2 + 6, 296)
      g.lineTo(W / 2 - 22, 336)
      g.lineTo(W / 2 - 2, 336)
      g.lineTo(W / 2 - 8, 366)
      g.lineTo(W / 2 + 22, 322)
      g.lineTo(W / 2 + 2, 322)
      g.closePath()
      g.fill()
    } else if (s.mode === 'connect') {
      g.fillStyle = '#fff'
      g.font = '800 34px Inter Variable, Arial, sans-serif'
      g.fillText('Connecting', W / 2, 150)
      g.fillStyle = '#9fb3aa'
      g.font = '500 20px Inter Variable, Arial, sans-serif'
      g.fillText('Checking your car', W / 2, 190)
      for (let i = 0; i < 3; i++) {
        g.fillStyle = i === Math.floor(pulse * 3) % 3 ? '#05C158' : 'rgba(5,193,88,0.3)'
        g.beginPath()
        g.arc(W / 2 - 36 + i * 36, 320, 12, 0, Math.PI * 2)
        g.fill()
      }
    } else if (s.mode === 'charge') {
      const cx = W / 2
      const cy = 250
      g.lineWidth = 20
      g.strokeStyle = 'rgba(255,255,255,0.12)'
      g.beginPath()
      g.arc(cx, cy, 104, 0, Math.PI * 2)
      g.stroke()
      g.strokeStyle = '#05C158'
      g.lineCap = 'round'
      g.beginPath()
      g.arc(cx, cy, 104, -Math.PI / 2, -Math.PI / 2 + (s.pct / 100) * Math.PI * 2)
      g.stroke()
      g.fillStyle = '#fff'
      g.font = '800 68px Inter Variable, Arial, sans-serif'
      g.textBaseline = 'middle'
      g.fillText(`${Math.round(s.pct)}%`, cx, cy - 6)
      g.fillStyle = '#7fe3ab'
      g.font = '700 18px Inter Variable, Arial, sans-serif'
      g.fillText('Charging', cx, cy + 50)
      g.fillStyle = '#fff'
      g.font = '800 30px Inter Variable, Arial, sans-serif'
      g.fillText(`${Math.round(s.kw)} kW`, cx, 410)
      g.fillStyle = '#9fb3aa'
      g.font = '500 18px Inter Variable, Arial, sans-serif'
      g.fillText(`${Math.round(s.mins)} min   ·   ₹${s.cost.toFixed(0)}`, cx, 452)
    } else {
      g.fillStyle = '#05C158'
      g.beginPath()
      g.arc(W / 2, 200, 70, 0, Math.PI * 2)
      g.fill()
      g.strokeStyle = '#fff'
      g.lineWidth = 14
      g.lineCap = 'round'
      g.lineJoin = 'round'
      g.beginPath()
      g.moveTo(W / 2 - 30, 202)
      g.lineTo(W / 2 - 6, 228)
      g.lineTo(W / 2 + 36, 172)
      g.stroke()
      g.fillStyle = '#fff'
      g.font = '800 34px Inter Variable, Arial, sans-serif'
      g.fillText('Complete', W / 2, 330)
      g.fillStyle = '#9fb3aa'
      g.font = '500 20px Inter Variable, Arial, sans-serif'
      g.fillText('Receipt sent to your app', W / 2, 372)
      g.fillStyle = '#7fe3ab'
      g.font = '700 26px Inter Variable, Arial, sans-serif'
      g.fillText(`₹${s.cost.toFixed(2)}`, W / 2, 428)
    }
    t.needsUpdate = true
  }
  return { texture: t, draw }
}

// Decals on the charger body: logo plate and the safety / price label.
export function makeChargerLabel() {
  const { c, g } = canvas(512, 256)
  g.fillStyle = '#f7f9fa'
  g.fillRect(0, 0, 512, 256)
  g.fillStyle = '#05C158'
  g.fillRect(0, 0, 512, 12)
  pinPath(g, 70, 100, 3.4)
  g.fillStyle = '#14171c'
  g.textAlign = 'left'
  g.textBaseline = 'middle'
  g.font = '800 64px Inter Variable, Arial, sans-serif'
  g.fillText('Chargezio', 130, 100)
  g.fillStyle = '#616274'
  g.font = '600 24px Inter Variable, Arial, sans-serif'
  g.fillText('DC FAST CHARGER  ·  CCS2  ·  60 kW', 36, 170)
  g.fillStyle = '#14171c'
  g.fillRect(36, 200, 440, 2)
  g.fillStyle = '#616274'
  g.font = '500 20px Inter Variable, Arial, sans-serif'
  g.fillText('Open 24 hours   ·   Pay in the app', 36, 228)
  return tex(c, { aniso: 4 })
}

// Cable pulse: a short bright head with a soft tail, scrolled along the cable.
export function makePulse() {
  const { c, g } = canvas(256, 4)
  const grad = g.createLinearGradient(0, 0, 256, 0)
  grad.addColorStop(0, '#000')
  grad.addColorStop(0.1, '#000')
  grad.addColorStop(0.2, '#555')
  grad.addColorStop(0.28, '#fff')
  grad.addColorStop(0.36, '#000')
  grad.addColorStop(1, '#000')
  g.fillStyle = grad
  g.fillRect(0, 0, 256, 4)
  const t = tex(c, { repeat: true, aniso: 1 })
  t.wrapT = THREE.ClampToEdgeWrapping
  return t
}

// Yellow tactile paving (raised dots) used at crossings.
export function makeTactile() {
  const { c, g } = canvas(256, 128)
  g.fillStyle = '#e8c53a'
  g.fillRect(0, 0, 256, 128)
  for (let i = 0; i < 16; i++) {
    for (let j = 0; j < 8; j++) {
      const x = 8 + i * 16
      const y = 8 + j * 16
      const gr = g.createRadialGradient(x - 1.5, y - 1.5, 0.5, x, y, 6)
      gr.addColorStop(0, '#f6dd6d')
      gr.addColorStop(1, '#b8961f')
      g.fillStyle = gr
      g.beginPath()
      g.arc(x, y, 5.2, 0, Math.PI * 2)
      g.fill()
    }
  }
  return tex(c, { aniso: 8 })
}

// The service hatch the charger rises through: a thin frame in the paving.
export function makeHatch() {
  const { c, g } = canvas(256, 192)
  g.strokeStyle = 'rgba(255,255,255,0.95)'
  g.lineWidth = 7
  g.beginPath()
  g.roundRect(10, 10, 236, 172, 18)
  g.stroke()
  g.strokeStyle = 'rgba(255,255,255,0.4)'
  g.lineWidth = 3
  g.beginPath()
  g.roundRect(24, 24, 208, 144, 10)
  g.stroke()
  return tex(c, { aniso: 4 })
}

// Sign: blue square with a plug symbol.
export function makeSign() {
  const { c, g } = canvas(256, 384)
  g.fillStyle = '#e9edf2'
  g.fillRect(0, 0, 256, 384)
  g.fillStyle = '#0a5cc2'
  g.beginPath()
  g.roundRect(10, 10, 236, 236, 18)
  g.fill()
  g.strokeStyle = '#fff'
  g.lineWidth = 5
  g.beginPath()
  g.roundRect(20, 20, 216, 216, 12)
  g.stroke()
  g.save()
  g.translate(128, 120)
  g.scale(0.3, 0.3)
  g.fillStyle = '#fff'
  g.beginPath()
  g.roundRect(-92, -70, 184, 170, 46)
  g.fill()
  g.fillRect(-52, -150, 30, 100)
  g.fillRect(22, -150, 30, 100)
  g.fillRect(-14, 100, 28, 60)
  g.globalCompositeOperation = 'destination-out'
  g.beginPath()
  g.moveTo(14, -52)
  g.lineTo(-48, 30)
  g.lineTo(-8, 30)
  g.lineTo(-20, 86)
  g.lineTo(48, -8)
  g.lineTo(8, -8)
  g.closePath()
  g.fill()
  g.restore()
  g.globalCompositeOperation = 'source-over'
  g.fillStyle = '#14171c'
  g.textAlign = 'center'
  g.textBaseline = 'middle'
  g.font = '800 38px Inter Variable, Arial, sans-serif'
  g.fillText('EV CHARGING', 128, 290)
  g.font = '600 24px Inter Variable, Arial, sans-serif'
  g.fillStyle = '#616274'
  g.fillText('Chargezio only', 128, 334)
  return tex(c, { aniso: 4 })
}
