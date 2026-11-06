import * as THREE from 'three'
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js'

export const TAU = Math.PI * 2
export const clamp01 = (x: number) => Math.min(1, Math.max(0, x))
export const sstep = (a: number, b: number, x: number) => {
  const t = clamp01((x - a) / (b - a))
  return t * t * (3 - 2 * t)
}

type Pt = [number, number]

// Smooth 1D curve through points (cubic Hermite, tangents from neighbours).
export function spline(input: Pt[]) {
  const pts = [...input].sort((a, b) => a[0] - b[0])
  const n = pts.length
  const m: number[] = pts.map((_, i) => {
    const a = pts[Math.max(0, i - 1)]
    const b = pts[Math.min(n - 1, i + 1)]
    return (b[1] - a[1]) / (b[0] - a[0])
  })
  return (x: number) => {
    if (x <= pts[0][0]) return pts[0][1]
    if (x >= pts[n - 1][0]) return pts[n - 1][1]
    let i = 0
    while (x > pts[i + 1][0]) i++
    const x0 = pts[i][0]
    const h = pts[i + 1][0] - x0
    const t = (x - x0) / h
    const t2 = t * t
    const t3 = t2 * t
    return (
      (2 * t3 - 3 * t2 + 1) * pts[i][1] +
      (t3 - 2 * t2 + t) * h * m[i] +
      (-2 * t3 + 3 * t2) * pts[i + 1][1] +
      (t3 - t2) * h * m[i + 1]
    )
  }
}

export function merge(parts: THREE.BufferGeometry[]) {
  // mergeGeometries needs matching attributes, so normalise everything first.
  const out = parts.map((g) => {
    const c = g.index ? g.toNonIndexed() : g.clone()
    for (const k of Object.keys(c.attributes)) if (!['position', 'normal', 'uv', 'color'].includes(k)) c.deleteAttribute(k)
    if (!c.attributes.uv) c.setAttribute('uv', new THREE.BufferAttribute(new Float32Array(c.attributes.position.count * 2), 2))
    if (!c.attributes.normal) c.computeVertexNormals()
    return c
  })
  const g = mergeGeometries(out, false)
  if (!g) throw new Error('merge failed')
  return g
}

// Rounded rectangle outline, used for flaps, plates and screens.
export function roundedRectShape(w: number, h: number, r: number) {
  const s = new THREE.Shape()
  const x = -w / 2
  const y = -h / 2
  s.moveTo(x + r, y)
  s.lineTo(x + w - r, y)
  s.quadraticCurveTo(x + w, y, x + w, y + r)
  s.lineTo(x + w, y + h - r)
  s.quadraticCurveTo(x + w, y + h, x + w - r, y + h)
  s.lineTo(x + r, y + h)
  s.quadraticCurveTo(x, y + h, x, y + h - r)
  s.lineTo(x, y + r)
  s.quadraticCurveTo(x, y, x + r, y)
  return s
}

export function roundedSlab(w: number, h: number, d: number, r: number, bevel = 0.004, seg = 4) {
  const g = new THREE.ExtrudeGeometry(roundedRectShape(w, h, r), {
    depth: d,
    bevelEnabled: bevel > 0,
    bevelSize: bevel,
    bevelThickness: bevel,
    bevelSegments: 2,
    curveSegments: seg,
  })
  g.translate(0, 0, -d / 2)
  return g
}
