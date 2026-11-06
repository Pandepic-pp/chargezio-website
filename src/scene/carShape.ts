import * as THREE from 'three'
import { sstep, spline, clamp01 } from './math'

// The car is described by a few profile curves (metres). It faces +X, +Z is the side the camera sees,
// +Y is up. Everything else (body, cabin, decals, port, mirrors) is derived from these functions,
// so a change here moves every part together.

export const HALF_L = 2.28
export const HALF_W = 0.92
export const BELT = 0.965
export const WHEEL_R = 0.355
export const WHEEL_W = 0.235
export const AXLE_X = 1.39
export const ARCH_R = 0.405
export const TIRE_Z = 0.745 // centre of the tyre across the car

const NL = 3.2 // lower body, underside corner roundness
const NU = 7 // lower body, shoulder roundness

const yTop = spline([
  [-2.28, 0.9],
  [-2.1, 0.965],
  [-1.85, 0.985],
  [-1.2, 0.975],
  [-0.2, 0.965],
  [0.6, 0.955],
  [0.92, 0.94],
  [1.2, 0.875],
  [1.6, 0.805],
  [2.0, 0.745],
  [2.28, 0.7],
])

export const yBot = (x: number) => 0.19 + 0.17 * sstep(1.7, 2.28, Math.abs(x))

export function halfW(x: number) {
  if (x > 1.45) {
    const t = Math.min(1, (x - 1.45) / (HALF_L - 1.45))
    return HALF_W * Math.pow(Math.max(0, 1 - Math.pow(t, 3.4)), 1 / 3.4)
  }
  if (x < -1.55) {
    const t = Math.min(1, (-1.55 - x) / (HALF_L - 1.55))
    return HALF_W * Math.pow(Math.max(0, 1 - Math.pow(t, 2.9)), 1 / 2.9)
  }
  return HALF_W
}

const y0Of = (x: number) => yBot(x) + 0.4 * (yTop(x) - yBot(x))

// Lower body cross-section: th runs from -PI/2 (underside centre) to PI/2 (top centre) on the near side.
function lowerYZ(x: number, th: number): [number, number] {
  const yb = yBot(x)
  const yt = yTop(x)
  const y0 = y0Of(x)
  const w = halfW(x)
  const c = Math.max(0, Math.cos(th))
  const s = Math.sin(th)
  if (s >= 0) return [y0 + (yt - y0) * Math.pow(s, 2 / NU), w * Math.pow(c, 2 / NU)]
  return [y0 - (y0 - yb) * Math.pow(-s, 2 / NL), w * Math.pow(c, 2 / NL)]
}

// Noses and tails are raked back at the bottom so the front is not a vertical wall.
function rake(x: number, y: number) {
  const t = clamp01((y - yBot(x)) / Math.max(0.01, yTop(x) - yBot(x)))
  const k = Math.pow(1 - t, 1.6)
  if (x > 0) return -0.1 * sstep(1.6, HALF_L, x) * k
  return 0.07 * sstep(1.6, HALF_L, -x) * k
}

// Z of the outer skin at height y (near side), for placing handles, flaps and mirrors.
export function sideZ(x: number, y: number) {
  const yb = yBot(x)
  const yt = yTop(x)
  const y0 = y0Of(x)
  const w = halfW(x)
  if (y >= y0) {
    const s = Math.pow(clamp01((y - y0) / (yt - y0)), NU / 2)
    return w * Math.pow(Math.max(0, 1 - s * s), 1 / NU)
  }
  const s = Math.pow(clamp01((y0 - y) / (y0 - yb)), NL / 2)
  return w * Math.pow(Math.max(0, 1 - s * s), 1 / NL)
}

export function sideNormal(x: number, y: number) {
  const e = 0.01
  const fx = (sideZ(x + e, y) - sideZ(x - e, y)) / (2 * e)
  const fy = (sideZ(x, y + e) - sideZ(x, y - e)) / (2 * e)
  return new THREE.Vector3(-fx, -fy, 1).normalize()
}

// ---------- cabin (greenhouse) ----------
export const CAB_X0 = -2.04
export const CAB_X1 = 0.97
const NUC = 2.7
const NLC = 10

const yRoof = spline([
  [0.97, 0.975],
  [0.82, 1.05],
  [0.58, 1.19],
  [0.32, 1.32],
  [0.06, 1.42],
  [-0.2, 1.462],
  [-0.55, 1.475],
  [-0.95, 1.447],
  [-1.35, 1.345],
  [-1.7, 1.19],
  [-1.95, 1.04],
  [-2.04, 0.985],
])
const wCab = spline([
  [0.97, 0.8],
  [0.6, 0.82],
  [-0.5, 0.83],
  [-1.3, 0.8],
  [-1.9, 0.72],
  [-2.04, 0.7],
])

function cabinYZ(x: number, th: number): [number, number] {
  const taper = Math.min(1, Math.sqrt(Math.max(0, (CAB_X1 - x) / 0.14)), Math.sqrt(Math.max(0, (x - CAB_X0) / 0.14)))
  const w = wCab(x) * taper
  const c = Math.max(0, Math.cos(th))
  const s = Math.sin(th)
  if (s >= 0) return [BELT + (yRoof(x) - BELT) * Math.pow(s, 2 / NUC), w * Math.pow(c, 2 / NUC)]
  return [BELT - 0.17 * Math.pow(-s, 2 / NLC), w * Math.pow(c, 2 / NLC)]
}

// ---------- lofting ----------
type Sample = (x: number, th: number) => [number, number]

function loft(xs: number[], NT: number, sec: Sample, withRake: boolean, thOut: boolean) {
  const R = NT * 2
  const NX = xs.length
  const pos = new Float32Array(NX * R * 3)
  const thA = new Float32Array(NX * R)
  for (let i = 0; i < NX; i++) {
    const x = xs[i]
    for (let j = 0; j < R; j++) {
      const k = j <= NT ? j : R - j
      const side = j <= NT ? 1 : -1
      const th = -Math.PI / 2 + (k * Math.PI) / NT
      const [y, z] = sec(x, th)
      const o = (i * R + j) * 3
      pos[o] = withRake ? x + rake(x, y) : x
      pos[o + 1] = y
      pos[o + 2] = z * side
      thA[i * R + j] = th
    }
  }
  const idx: number[] = []
  for (let i = 0; i < NX - 1; i++) {
    for (let j = 0; j < R; j++) {
      const a = i * R + j
      const b = (i + 1) * R + j
      const c = i * R + ((j + 1) % R)
      const d = (i + 1) * R + ((j + 1) % R)
      idx.push(a, b, c, b, d, c)
    }
  }
  const g = new THREE.BufferGeometry()
  g.setAttribute('position', new THREE.BufferAttribute(pos, 3))
  if (thOut) g.setAttribute('aTh', new THREE.BufferAttribute(thA, 1))
  g.setIndex(idx)
  g.computeVertexNormals()

  // The two ends are pinched to a line shared by the near and far halves. Average their normals
  // so there is no visible crease down the middle of the bumpers.
  const nor = g.attributes.normal as THREE.BufferAttribute
  for (const i of [0, NX - 1]) {
    for (let j = 1; j < NT; j++) {
      const a = i * R + j
      const b = i * R + (R - j)
      const nx = nor.getX(a) + nor.getX(b)
      const ny = nor.getY(a) + nor.getY(b)
      const nz = nor.getZ(a) - nor.getZ(b)
      const l = Math.hypot(nx, ny, nz) || 1
      nor.setXYZ(a, nx / l, ny / l, nz / l)
      nor.setXYZ(b, nx / l, ny / l, -nz / l)
    }
  }
  return g
}

const chebyshev = (a: number, b: number, n: number) =>
  Array.from({ length: n }, (_, i) => (a + b) / 2 - ((b - a) / 2) * Math.cos((Math.PI * i) / (n - 1)))

export function buildBodyGeometry(high: boolean) {
  const xs = chebyshev(-HALF_L, HALF_L, high ? 130 : 80)
  return loft(xs, high ? 34 : 22, lowerYZ, true, false)
}

export function buildCabinGeometry(high: boolean) {
  const xs = chebyshev(CAB_X0, CAB_X1, high ? 110 : 70)
  return loft(xs, high ? 30 : 20, cabinYZ, false, true)
}

// ---------- charge port frame (rear quarter, near side) ----------
export const PORT_X = -2.03
export const PORT_Y = 0.835

export function portFrame() {
  const z = sideZ(PORT_X, PORT_Y)
  const pos = new THREE.Vector3(PORT_X, PORT_Y, z)
  const n = sideNormal(PORT_X, PORT_Y)
  const y = new THREE.Vector3(0, 1, 0)
  const x = new THREE.Vector3().crossVectors(y, n).normalize()
  const yy = new THREE.Vector3().crossVectors(n, x).normalize()
  const quat = new THREE.Quaternion().setFromRotationMatrix(new THREE.Matrix4().makeBasis(x, yy, n))
  return { pos, n, quat }
}
