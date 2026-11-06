import * as THREE from 'three'
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js'
import { merge } from './math'
import { DC_PIN, PIN_CENTER_Y, PIN_RING } from './carParts'

function at(g: THREE.BufferGeometry, p: [number, number, number], r: [number, number, number] = [0, 0, 0]) {
  g.rotateX(r[0])
  g.rotateY(r[1])
  g.rotateZ(r[2])
  g.translate(...p)
  return g
}
const rbox = (w: number, h: number, d: number, r: number, p: [number, number, number], rot?: [number, number, number]) =>
  at(new RoundedBoxGeometry(w, h, d, 2, r), p, rot)
const cylX = (r0: number, r1: number, len: number, p: [number, number, number], seg = 20) =>
  at(new THREE.CylinderGeometry(r0, r1, len, seg).rotateZ(Math.PI / 2), p)
const cylZ = (r0: number, r1: number, len: number, p: [number, number, number], seg = 20) =>
  at(new THREE.CylinderGeometry(r0, r1, len, seg).rotateX(Math.PI / 2), p)

function colored(g: THREE.BufferGeometry, hex: number) {
  const out = g.index ? g.toNonIndexed() : g
  const c = new THREE.Color(hex)
  const n = out.attributes.position.count
  const arr = new Float32Array(n * 3)
  for (let i = 0; i < n; i++) {
    arr[i * 3] = c.r
    arr[i * 3 + 1] = c.g
    arr[i * 3 + 2] = c.b
  }
  out.setAttribute('color', new THREE.BufferAttribute(arr, 3))
  return out
}

// ------------------------------------------------------------------ station (local origin on the pavement)

export const SW = 0.66 // width
export const SD = 0.42 // depth
export const SH = 1.82 // height

export function buildCabinet() {
  return merge([
    rbox(SW, SH - 0.08, SD, 0.05, [0, 0.07 + (SH - 0.08) / 2, 0]),
    // slightly proud side panels give the cabinet its panel-line look
    rbox(0.03, SH - 0.5, SD - 0.06, 0.012, [SW / 2 + 0.004, 1.0, -0.01]),
    rbox(0.03, SH - 0.5, SD - 0.06, 0.012, [-SW / 2 - 0.004, 1.0, -0.01]),
  ])
}

// Dark plastic and metal details share one mesh with vertex colours.
export function buildStationDetails() {
  const parts: THREE.BufferGeometry[] = []
  const add = (g: THREE.BufferGeometry, hex: number) => parts.push(colored(g, hex))
  // plinth and fixing bolts
  add(rbox(0.82, 0.07, 0.62, 0.02, [0, 0.035, 0]), 0x23262c)
  for (const x of [-0.37, 0.37]) for (const z of [-0.27, 0.27]) add(at(new THREE.CylinderGeometry(0.02, 0.02, 0.014, 6), [x, 0.077, z]), 0x8b9099)
  // top cap and rain lip
  add(rbox(SW + 0.03, 0.045, SD + 0.03, 0.022, [0, SH - 0.005, 0]), 0x3a3f47)
  // screen bezel
  add(rbox(0.5, 0.66, 0.03, 0.03, [0, 1.38, SD / 2 + 0.002]), 0x0c0d10)
  // lower grille panel recess and louvres (front)
  add(rbox(0.5, 0.3, 0.012, 0.01, [0, 0.36, SD / 2 + 0.001]), 0x15171b)
  for (let i = 0; i < 9; i++) add(rbox(0.46, 0.012, 0.022, 0.004, [0, 0.23 + i * 0.032, SD / 2 + 0.01], [0.35, 0, 0]), 0x3b4048)
  // side louvres
  for (const s of [1, -1]) {
    add(rbox(0.012, 0.3, 0.3, 0.01, [s * (SW / 2 + 0.02), 0.36, 0]), 0x15171b)
    for (let i = 0; i < 9; i++) add(rbox(0.022, 0.012, 0.28, 0.004, [s * (SW / 2 + 0.03), 0.23 + i * 0.032, 0], [0, 0, s * -0.35]), 0x3b4048)
  }
  // RFID pad
  add(rbox(0.12, 0.12, 0.014, 0.025, [-0.14, 0.99, SD / 2 + 0.004]), 0x14161a)
  // card / QR plate
  add(rbox(0.1, 0.1, 0.01, 0.01, [0.0, 0.99, SD / 2 + 0.003]), 0xf4f6f8)
  // emergency stop: yellow collar, red mushroom
  add(at(new THREE.CylinderGeometry(0.044, 0.044, 0.012, 24).rotateX(Math.PI / 2), [0.15, 0.99, SD / 2 + 0.006]), 0xf3c11b)
  add(at(new THREE.CylinderGeometry(0.03, 0.036, 0.026, 24).rotateX(Math.PI / 2), [0.15, 0.99, SD / 2 + 0.022]), 0xd42a2a)
  // holster on the right side: a moulded pocket the connector head slides into
  add(rbox(0.19, 0.17, 0.17, 0.045, [SW / 2 + 0.085, 1.1, 0.04]), 0x2a2d33)
  add(cylX(0.058, 0.058, 0.014, [SW / 2 + 0.176, 1.1, 0.04], 28), 0x0b0c0e)
  // cable gland where the cable leaves the cabinet
  add(cylX(0.05, 0.036, 0.1, [SW / 2 + 0.05, 0.6, 0.06], 20), 0x15171b)
  add(cylX(0.058, 0.058, 0.014, [SW / 2 + 0.006, 0.6, 0.06], 20), 0x3b4048)
  // cable hook under the holster
  add(rbox(0.05, 0.02, 0.06, 0.008, [SW / 2 + 0.03, 0.82, 0.05]), 0x2a2d33)
  return merge(parts)
}

export function buildStationLeds() {
  return merge([
    rbox(0.012, 1.3, 0.008, 0.004, [-SW / 2 + 0.03, 1.1, SD / 2 + 0.002]),
    rbox(0.012, 1.3, 0.008, 0.004, [SW / 2 - 0.03, 1.1, SD / 2 + 0.002]),
    rbox(0.46, 0.014, 0.008, 0.004, [0, SH - 0.075, SD / 2 + 0.002]),
  ])
}

// ------------------------------------------------------------------ CCS2 connector (tip at the origin, handle towards +Z)

const HANDLE_TILT = 0.2
const dir = new THREE.Vector3(0, -Math.sin(HANDLE_TILT), Math.cos(HANDLE_TILT))
const NECK_END = new THREE.Vector3(0, -0.02, 0.235)
const HANDLE_LEN = 0.2
const BOOT_LEN = 0.1
export const CABLE_ANCHOR = NECK_END.clone().addScaledVector(dir, HANDLE_LEN + BOOT_LEN)

function alongHandle(g: THREE.BufferGeometry, from: number) {
  const q = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1, 0, 0), HANDLE_TILT)
  g.applyQuaternion(q)
  g.translate(...NECK_END.clone().addScaledVector(dir, from).toArray())
  return g
}

export function buildConnectorBody() {
  const parts: THREE.BufferGeometry[] = []
  // locking insert (round type 2 part) and lower DC lobe
  parts.push(cylZ(0.047, 0.047, 0.06, [0, PIN_CENTER_Y, 0.03], 36))
  parts.push(rbox(0.116, 0.056, 0.06, 0.022, [0, DC_PIN.y, 0.03]))
  // neck, one block holding both
  parts.push(rbox(0.14, 0.17, 0.14, 0.04, [0, -0.002, 0.165]))
  // handle
  parts.push(alongHandle(new RoundedBoxGeometry(0.105, 0.115, HANDLE_LEN, 3, 0.04).rotateX(0), HANDLE_LEN / 2))
  return merge(parts)
}

export function buildConnectorShoulder() {
  return rbox(0.152, 0.192, 0.036, 0.05, [0, -0.002, 0.078])
}

export function buildConnectorMetal() {
  const parts: THREE.BufferGeometry[] = []
  const hole = (x: number, y: number, r: number) => {
    const t = new THREE.TorusGeometry(r, r * 0.28, 6, 14)
    t.translate(x, y, 0.001)
    parts.push(t)
  }
  for (let i = 0; i < 5; i++) {
    const a = Math.PI / 2 + (i * Math.PI * 2) / 5
    hole(Math.cos(a) * PIN_RING, PIN_CENTER_Y + Math.sin(a) * PIN_RING, 0.0068)
  }
  hole(-0.018, PIN_CENTER_Y, 0.0042)
  hole(0.018, PIN_CENTER_Y, 0.0042)
  hole(-DC_PIN.x, DC_PIN.y, 0.0152)
  hole(DC_PIN.x, DC_PIN.y, 0.0152)
  return merge(parts)
}

export function buildConnectorLever() {
  const parts: THREE.BufferGeometry[] = []
  parts.push(rbox(0.05, 0.018, 0.12, 0.007, [0, 0.092, 0.16], [-0.06, 0, 0]))
  parts.push(rbox(0.05, 0.03, 0.02, 0.006, [0, 0.082, 0.1]))
  return merge(parts)
}

export function buildConnectorBoot() {
  const parts: THREE.BufferGeometry[] = []
  const boot = new THREE.CylinderGeometry(0.03, 0.05, BOOT_LEN, 28).rotateX(Math.PI / 2)
  parts.push(alongHandle(boot, HANDLE_LEN + BOOT_LEN / 2))
  for (let i = 0; i < 3; i++) {
    const t = new THREE.TorusGeometry(0.04 - i * 0.004, 0.005, 6, 24)
    parts.push(alongHandle(t, HANDLE_LEN + 0.02 + i * 0.027))
  }
  return merge(parts)
}

export function buildConnectorRing() {
  const t = new THREE.TorusGeometry(0.066, 0.0042, 8, 40)
  t.translate(0, PIN_CENTER_Y, 0.098)
  return t
}
