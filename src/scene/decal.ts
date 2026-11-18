import * as THREE from 'three'

// The wildstyle graffiti on the car's doors: "CHARGEZIO" in all capitals, built from hand-made letter skeletons (not a font):
// tall, fat, looping strokes with arrow tips and long flourishes, leaning hard and interlocking, with strokes inside and out:
// an inline cut into every letter, an inner shade, an accent keyline, a deep outline, a thin pale halo and a drop shadow,
// plus glossy highlights, drips, sparkles, speed streaks and a halftone burst. It is not a sticker: the canvases only hold
// masks that the paint shader (Car.tsx) turns into paint on the door, mixed with the body colour, so it follows the door's
// curve, lighting and reflections.
//   texture A: r letters, g keyline, b outline
//   texture B: r drop shadow, g highlights, b extras (drips, sparkles, streaks, dots)
//   texture C: r inline, g inner shade, b halo
export const DECAL = { x: -0.98, y: 0.5, w: 1.96, h: 0.645 } // where it sits on the doors, in the car's own space (metres)

const W = 2400
const H = Math.round((W * DECAL.h) / DECAL.w)
// the artwork is laid out in units: letters are 100 tall and about 62 wide, one every 64
const ADV = 64
const SX = 0.62
const WORD = 'CHARGEZIO'
const MX = 32 // margins around the word, in units
const MT = 66 // room above the letters for the tall strokes, arrow tips and outlines
const MB = 44
const UW = ADV * WORD.length + 2 * MX - (ADV - 62)
const UH = 100 + MT + MB // = UW * DECAL.h / DECAL.w, so one unit is the same size across and up
const K = W / UW

type Glyph = { stroke: string; spikes: string }
// y points down; every stroke is a line through the middle of the fat letter, every spike is an arrow tip on a stroke end
const GLYPHS: Record<string, Glyph> = {
  C: {
    stroke: 'M 96 12 C 60 -16 2 6 6 50 C 10 100 72 114 100 72 M 96 12 C 112 4 124 10 128 -8',
    spikes: 'M 84 2 L 116 -14 L 104 26 Z M 90 92 L 112 112 L 80 102 Z',
  },
  H: {
    stroke: 'M 14 2 L 22 98 M 80 0 L 88 100 M 16 54 C 38 30 58 76 90 46 C 104 38 118 50 130 34',
    spikes: 'M 4 8 L 18 -20 L 28 10 Z M 124 24 L 144 34 L 124 50 Z',
  },
  A: {
    stroke: 'M 2 98 L 46 4 L 96 98 M 20 68 C 44 50 66 74 90 58 M 46 6 C 54 -14 72 -16 82 -30',
    spikes: 'M 34 6 L 48 -22 L 60 6 Z M 76 -34 L 96 -34 L 84 -16 Z',
  },
  R: {
    stroke: 'M 16 100 L 12 2 M 12 6 C 76 -12 100 46 26 56 M 38 56 C 58 70 70 88 96 102 C 108 110 120 106 128 94',
    spikes: 'M 4 102 L 14 124 L 26 100 Z M 120 88 L 142 90 L 128 108 Z',
  },
  G: {
    stroke: 'M 94 16 C 62 -14 4 6 6 50 C 8 102 76 112 94 68 L 92 54 L 54 58 M 94 16 C 108 8 120 14 124 -2',
    spikes: 'M 84 4 L 116 -10 L 102 28 Z M 44 50 L 38 74 L 64 62 Z',
  },
  E: {
    stroke: 'M 22 2 L 16 98 M 20 6 C 52 -8 76 14 96 2 C 108 -4 118 -2 126 -14 M 18 52 C 46 38 66 62 86 48 M 16 98 C 46 108 76 90 98 102',
    spikes: 'M 118 -22 L 142 -16 L 124 2 Z M 92 94 L 116 102 L 100 118 Z',
  },
  Z: {
    stroke: 'M 6 10 C 40 -8 70 16 94 4 M 92 6 C 70 42 30 64 8 94 M 4 98 C 40 112 70 92 100 102',
    spikes: 'M 84 -4 L 114 2 L 96 24 Z M 92 96 L 118 104 L 100 118 Z',
  },
  I: {
    stroke: 'M 50 4 L 46 98 M 20 6 L 80 2 C 94 0 106 -6 112 -20 M 20 98 L 80 100',
    spikes: 'M 104 -28 L 126 -22 L 106 -6 Z M 12 102 L 4 124 L 30 112 Z',
  },
  O: {
    stroke: 'M 50 2 C 6 2 0 98 50 98 C 96 98 100 2 50 2 Z M 62 22 C 80 36 76 72 56 86',
    spikes: 'M 38 -8 L 66 -4 L 46 14 Z M 56 82 L 74 98 L 48 98 Z',
  },
}
// every letter gets its own tilt, lift and height, fixed so it looks hand-sprayed but never changes
const TILT = [-0.09, 0.06, -0.08, 0.09, -0.05, 0.08, -0.09, 0.05, -0.07]
const LIFT = [6, -10, 8, -8, 11, -9, 7, -11, 6]
const TALL = [1.06, 0.93, 1.1, 0.92, 1.07, 0.94, 1.05, 0.92, 1.07]
const SLANT = -0.3

function layer() {
  const c = document.createElement('canvas')
  c.width = W
  c.height = H
  const g = c.getContext('2d', { willReadFrequently: true })!
  g.lineJoin = 'round'
  g.lineCap = 'round'
  g.fillStyle = '#fff'
  g.strokeStyle = '#fff'
  g.scale(K, K)
  g.translate(MX, MT)
  return { c, g }
}

// one letter's path, leaned, tilted and stretched about its own baseline (the path is transformed, not the pen, so every
// stroke has the same thickness whichever way it runs)
function glyphPath(i: number, which: 'stroke' | 'spikes', ox = 0, oy = 0) {
  const gl = GLYPHS[WORD[i]]
  const m = new DOMMatrix()
    .translate(i * ADV + ox, 100 + LIFT[i] + oy)
    .multiply(new DOMMatrix([1, 0, SLANT, 1, 0, 0]))
    .rotate((TILT[i] * 180) / Math.PI)
    .scale(SX, TALL[i])
    .translate(0, -100)
  const p = new Path2D()
  p.addPath(new Path2D(gl[which]), m)
  return p
}

// all the letters as fat strokes of the given width (spikes are filled and stroked, so they grow with the outline)
function letters(g: CanvasRenderingContext2D, width: number, ox = 0, oy = 0) {
  g.lineWidth = width
  for (let i = 0; i < WORD.length; i++) {
    g.stroke(glyphPath(i, 'stroke', ox, oy))
    const sp = glyphPath(i, 'spikes', ox, oy)
    g.fill(sp)
    g.stroke(sp)
  }
}

function star(g: CanvasRenderingContext2D, x: number, y: number, r: number) {
  g.beginPath()
  g.moveTo(x, y - r)
  g.quadraticCurveTo(x, y, x + r * 0.55, y)
  g.quadraticCurveTo(x, y, x, y + r)
  g.quadraticCurveTo(x, y, x - r * 0.55, y)
  g.quadraticCurveTo(x, y, x, y - r)
  g.fill()
}

// `outer` minus `inner` (two layers of the same letters at different widths) leaves a ring: that is how every line is cut
function ring(outer: number, inner: number, ox = 0, oy = 0) {
  const l = layer()
  letters(l.g, outer, ox, oy)
  l.g.save()
  l.g.globalCompositeOperation = 'destination-out'
  letters(l.g, inner, ox, oy)
  l.g.restore()
  return l
}

const alpha = (l: { g: CanvasRenderingContext2D }) => l.g.getImageData(0, 0, W, H).data

function draw(a: HTMLCanvasElement, b: HTMLCanvasElement, c: HTMLCanvasElement) {
  const FAT = 18
  const fillL = layer()
  letters(fillL.g, FAT)
  const keyL = layer()
  letters(keyL.g, FAT + 11)
  const outL = layer()
  letters(outL.g, FAT + 23)
  const shadowL = layer()
  letters(shadowL.g, FAT + 23, 7, 10)

  // strokes inside: a thin inline cut just in from the edge of every letter, and a shaded lower-right edge for the bubble look
  const inlineL = ring(FAT - 4.5, FAT - 8)
  const shadeL = layer()
  shadeL.g.save()
  shadeL.g.setTransform(1, 0, 0, 1, 0, 0)
  shadeL.g.drawImage(fillL.c, 0, 0)
  shadeL.g.globalCompositeOperation = 'destination-out'
  shadeL.g.drawImage(fillL.c, -3.4 * K, -4.6 * K)
  shadeL.g.restore()
  // strokes outside: a thin pale halo around the dark outline
  const haloL = ring(FAT + 33, FAT + 28.5)

  // highlights: a rim along the upper-left edges, plus small gloss dabs on the letters
  const shineL = layer()
  shineL.g.save()
  shineL.g.setTransform(1, 0, 0, 1, 0, 0)
  shineL.g.drawImage(fillL.c, 0, 0)
  shineL.g.globalCompositeOperation = 'destination-out'
  shineL.g.drawImage(fillL.c, 3.4 * K, 4.6 * K)
  shineL.g.restore()
  for (let i = 0; i < WORD.length; i++) {
    shineL.g.save()
    shineL.g.translate(i * ADV + 16 + SLANT * -46, 100 + LIFT[i] - 74)
    shineL.g.rotate(-0.55)
    shineL.g.beginPath()
    shineL.g.ellipse(0, 0, 9.5, 3.2, 0, 0, Math.PI * 2)
    shineL.g.fill()
    shineL.g.restore()
  }

  // extras: halftone burst, speed streaks, drips and sparkles
  const exL = layer()
  const g = exL.g
  const WW = ADV * WORD.length
  for (let r = 0; r < 10; r++) {
    for (let col = 0; col < 24; col++) {
      const x = WW * 0.52 + col * 10.5 + (r % 2) * 5.2
      const y = -10 + r * 11
      const s = Math.max(0, 4.4 - col * 0.14 - Math.abs(r - 3.5) * 0.2)
      if (s <= 0.3) continue
      g.beginPath()
      g.arc(x, y, s, 0, Math.PI * 2)
      g.fill()
    }
  }
  g.lineWidth = 3.4
  for (let i = 0; i < 4; i++) {
    g.beginPath()
    g.moveTo(-30 + i * 3, 32 + i * 15)
    g.lineTo(10 - i * 2, 36 + i * 15)
    g.stroke()
  }
  const drips: [number, number, number][] = [
    [0, 30, 40],
    [2, 38, 28],
    [4, 34, 48],
    [6, 28, 34],
    [8, 36, 42],
  ]
  for (const [i, ox, len] of drips) {
    const x = i * ADV + ox * 0.6 - 4
    const y0 = 102 + LIFT[i]
    g.lineWidth = 6.5
    g.beginPath()
    g.moveTo(x, y0)
    g.lineTo(x - 2, y0 + len)
    g.stroke()
    g.beginPath()
    g.arc(x - 2, y0 + len + 3, 6, 0, Math.PI * 2)
    g.fill()
  }
  const sparks: [number, number, number][] = [
    [WW * 0.1, -16, 14],
    [WW * 0.32, -24, 11],
    [WW * 0.52, 124, 13],
    [WW * 0.7, -20, 12],
    [WW * 0.86, 122, 15],
    [WW * 0.98, 30, 10],
  ]
  for (const [x, y, r] of sparks) star(g, x, y, r)

  // pack the masks into three opaque images
  const put = (cv: HTMLCanvasElement, r: Uint8ClampedArray, gch: Uint8ClampedArray, bch: Uint8ClampedArray) => {
    const ctx = cv.getContext('2d')!
    const img = ctx.createImageData(W, H)
    for (let i = 0; i < W * H; i++) {
      const t = i * 4 + 3
      img.data[i * 4] = r[t]
      img.data[i * 4 + 1] = gch[t]
      img.data[i * 4 + 2] = bch[t]
      img.data[i * 4 + 3] = 255
    }
    ctx.putImageData(img, 0, 0)
  }
  const out = alpha(outL)
  const sh = alpha(shadowL)
  const shadow = new Uint8ClampedArray(sh.length)
  for (let i = 3; i < sh.length; i += 4) shadow[i] = Math.max(0, sh[i] - out[i]) // the shadow only where the outline is not
  put(a, alpha(fillL), alpha(keyL), out)
  put(b, shadow, alpha(shineL), alpha(exL))
  put(c, alpha(inlineL), alpha(shadeL), alpha(haloL))
}

function maskTexture(cv: HTMLCanvasElement) {
  const tex = new THREE.CanvasTexture(cv)
  tex.colorSpace = THREE.NoColorSpace // masks, not colours
  tex.anisotropy = 8
  tex.generateMipmaps = true
  tex.minFilter = THREE.LinearMipmapLinearFilter
  return tex
}

export function makeGraffitiDecal() {
  const cvs = [0, 1, 2].map(() => {
    const cv = document.createElement('canvas')
    cv.width = W
    cv.height = H
    return cv
  })
  draw(cvs[0], cvs[1], cvs[2])
  return { tex: maskTexture(cvs[0]), texB: maskTexture(cvs[1]), texC: maskTexture(cvs[2]) }
}
