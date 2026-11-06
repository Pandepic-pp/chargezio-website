import * as THREE from 'three'
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js'
import { merge, roundedSlab, roundedRectShape } from './math'
import { ARCH_R, AXLE_X, BELT, PORT_X, PORT_Y, WHEEL_R, WHEEL_W, portFrame, sideNormal, sideZ, yBot } from './carShape'

// Wheel parts are built with the axle along +Z and the outer face towards +Z.
const toAxisZ = (g: THREE.BufferGeometry) => g.rotateX(Math.PI / 2)

export function buildTire(high: boolean) {
  const a = WHEEL_W / 2
  const half: [number, number][] = [
    [0.2415, 0.098],
    [0.2415, 0.116],
    [0.25, a],
    [0.275, a - 0.001],
    [0.31, a - 0.003],
    [0.337, a - 0.009],
    [0.35, 0.097],
    [WHEEL_R - 0.0015, 0.074],
    [WHEEL_R, 0.054],
    [WHEEL_R - 0.002, 0.047],
    [WHEEL_R - 0.0045, 0.041],
    [WHEEL_R - 0.002, 0.035],
    [WHEEL_R, 0.024],
    [WHEEL_R + 0.0005, 0.0],
  ]
  const pts: THREE.Vector2[] = []
  for (const [r, z] of half) pts.push(new THREE.Vector2(r, -z))
  for (const [r, z] of [...half].reverse()) pts.push(new THREE.Vector2(r, z))
  // reorder so the lathe goes from the inner bead to the outer bead
  const g = new THREE.LatheGeometry(pts, high ? 80 : 44)
  g.computeVertexNormals()
  return toAxisZ(g)
}

function spokeGeometry() {
  const s = new THREE.Shape()
  s.moveTo(0.04, -0.034)
  s.lineTo(0.19, -0.03)
  s.quadraticCurveTo(0.232, -0.036, 0.238, -0.05)
  s.lineTo(0.238, 0.05)
  s.quadraticCurveTo(0.232, 0.036, 0.19, 0.03)
  s.lineTo(0.04, 0.034)
  s.quadraticCurveTo(0.028, 0, 0.04, -0.034)
  const g = new THREE.ExtrudeGeometry(s, { depth: 0.02, bevelEnabled: true, bevelSize: 0.003, bevelThickness: 0.003, bevelSegments: 2, curveSegments: 6 })
  return g
}

// Silver alloy: ten spokes, polished lip, hub and bolts.
export function buildRimMetal() {
  const parts: THREE.BufferGeometry[] = []
  const spoke = spokeGeometry()
  for (let i = 0; i < 10; i++) {
    const g = spoke.clone()
    g.rotateZ((i * Math.PI * 2) / 10 + (i % 2 ? 0.07 : -0.07))
    g.translate(0, 0, 0.06 + (i % 2) * 0.006)
    parts.push(g)
  }
  const lip = new THREE.TorusGeometry(0.2335, 0.011, 8, 64)
  lip.translate(0, 0, 0.1)
  parts.push(lip)
  const hub = new THREE.CylinderGeometry(0.058, 0.066, 0.03, 32)
  toAxisZ(hub)
  hub.translate(0, 0, 0.068)
  parts.push(hub)
  const hubRing = new THREE.TorusGeometry(0.052, 0.005, 6, 32)
  hubRing.translate(0, 0, 0.086)
  parts.push(hubRing)
  for (let i = 0; i < 5; i++) {
    const b = new THREE.CylinderGeometry(0.0075, 0.0075, 0.012, 6)
    toAxisZ(b)
    const ang = (i * Math.PI * 2) / 5 + 0.3
    b.translate(Math.cos(ang) * 0.077, Math.sin(ang) * 0.077, 0.082)
    parts.push(b)
  }
  return merge(parts)
}

// Dark steel: barrel interior, brake disc and the hub flange behind the spokes.
export function buildRimDark() {
  const parts: THREE.BufferGeometry[] = []
  const barrel = new THREE.CylinderGeometry(0.2275, 0.2275, 0.21, 40, 1, true)
  toAxisZ(barrel)
  barrel.translate(0, 0, 0.0)
  parts.push(barrel)
  const disc = new THREE.CylinderGeometry(0.168, 0.168, 0.022, 48)
  toAxisZ(disc)
  disc.translate(0, 0, 0.012)
  parts.push(disc)
  const hat = new THREE.CylinderGeometry(0.085, 0.085, 0.05, 28)
  toAxisZ(hat)
  hat.translate(0, 0, 0.03)
  parts.push(hat)
  // face plate behind the spokes, dished like a real wheel
  const dish = new THREE.CylinderGeometry(0.235, 0.09, 0.04, 40, 1, true)
  toAxisZ(dish)
  dish.translate(0, 0, 0.052)
  parts.push(dish)
  return merge(parts)
}

export function buildCaliper() {
  const g = new THREE.TorusGeometry(0.152, 0.03, 8, 16, 0.72)
  g.scale(1, 1, 1.9)
  g.rotateZ(1.95)
  g.translate(0, 0, 0.012)
  return g
}

export function buildHubBadge() {
  const g = new THREE.CylinderGeometry(0.03, 0.03, 0.006, 24)
  toAxisZ(g)
  g.translate(0, 0, 0.087)
  return g
}

// ------------------------------------------------------------ wheel wells and arch trim

export function buildWellLiner() {
  const parts: THREE.BufferGeometry[] = []
  for (const sx of [-1, 1]) {
    for (const sz of [-1, 1]) {
      const cyl = new THREE.CylinderGeometry(ARCH_R - 0.003, ARCH_R - 0.003, 0.56, 36, 1, true, Math.PI / 2 - 0.55, Math.PI + 1.1)
      toAxisZ(cyl)
      cyl.translate(sx * AXLE_X, WHEEL_R, sz * (0.38 + 0.28))
      parts.push(cyl)
      const back = new THREE.CircleGeometry(ARCH_R, 32, 0, Math.PI)
      back.translate(sx * AXLE_X, WHEEL_R, sz * 0.4)
      if (sz < 0) back.rotateY(0)
      parts.push(back)
    }
  }
  return merge(parts)
}

// Black plastic flare that frames each arch on the near side, following the skin exactly.
export function buildArchTrim() {
  const pos: number[] = []
  const idx: number[] = []
  const steps = 56
  const rows = [
    { r: ARCH_R - 0.001, dz: -0.045 },
    { r: ARCH_R - 0.001, dz: 0.0 },
    { r: ARCH_R + 0.01, dz: 0.008 },
    { r: ARCH_R + 0.026, dz: 0.001 },
  ]
  let base = 0
  for (const cx of [-AXLE_X, AXLE_X]) {
    // stop where the circle meets the underside of the body
    const a0 = Math.asin((yBot(cx) + 0.012 - WHEEL_R) / ARCH_R)
    for (let i = 0; i <= steps; i++) {
      const al = a0 + (i / steps) * (Math.PI - 2 * a0)
      for (const row of rows) {
        const x = cx + Math.cos(al) * row.r
        const y = WHEEL_R + Math.sin(al) * row.r
        pos.push(x, y, sideZ(x, Math.max(y, yBot(x) + 0.012)) + row.dz)
      }
    }
    for (let i = 0; i < steps; i++) {
      for (let k = 0; k < rows.length - 1; k++) {
        const a = base + i * 4 + k
        const b = base + (i + 1) * 4 + k
        idx.push(a, b, a + 1, b, b + 1, a + 1)
      }
    }
    base += (steps + 1) * 4
  }
  const g = new THREE.BufferGeometry()
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3))
  g.setIndex(idx)
  g.computeVertexNormals()
  return g
}

// ------------------------------------------------------------ small exterior parts

function place(g: THREE.BufferGeometry, p: [number, number, number], r: [number, number, number] = [0, 0, 0]) {
  g.rotateX(r[0])
  g.rotateY(r[1])
  g.rotateZ(r[2])
  g.translate(...p)
  return g
}

export function buildExteriorTrim() {
  const parts: THREE.BufferGeometry[] = []
  // flush door handles, near side
  for (const [x, y] of [
    [-0.1, 0.9],
    [-1.02, 0.905],
  ] as const) {
    parts.push(place(new RoundedBoxGeometry(0.15, 0.024, 0.016, 2, 0.007), [x, y, sideZ(x, y) + 0.001]))
  }
  // mirrors (near and far)
  for (const s of [1, -1]) {
    const stalk = new THREE.BoxGeometry(0.05, 0.03, 0.09)
    parts.push(place(stalk, [0.64, 0.99, s * 0.9]))
    const shell = new THREE.SphereGeometry(0.5, 20, 14)
    shell.scale(0.2, 0.115, 0.17)
    parts.push(place(shell, [0.62, 1.05, s * 1.0], [0, s * 0.1, 0]))
  }
  // roof shark fin
  const fin = new THREE.CylinderGeometry(0.012, 0.03, 0.07, 10)
  fin.scale(2.6, 1, 0.8)
  parts.push(place(fin, [-1.15, 1.425, 0]))
  return merge(parts)
}

export function buildMirrorGlass() {
  const parts: THREE.BufferGeometry[] = []
  for (const s of [1, -1]) {
    const g = new THREE.CircleGeometry(0.5, 20)
    g.scale(0.15, 0.092, 1)
    g.rotateY(Math.PI + s * 0.1)
    parts.push(place(g, [0.513, 1.05, s * 1.0]))
  }
  return merge(parts)
}

// ------------------------------------------------------------ interior (seen faintly through the glass)

export function buildInterior() {
  const parts: THREE.BufferGeometry[] = []
  const col = (g: THREE.BufferGeometry, hex: number) => {
    const c = new THREE.Color(hex)
    const n = g.attributes.position.count
    const arr = new Float32Array(n * 3)
    for (let i = 0; i < n; i++) {
      arr[i * 3] = c.r
      arr[i * 3 + 1] = c.g
      arr[i * 3 + 2] = c.b
    }
    g.setAttribute('color', new THREE.BufferAttribute(arr, 3))
    return g
  }
  const add = (g: THREE.BufferGeometry, hex: number) => parts.push(col(g.index ? g.toNonIndexed() : g, hex))

  add(place(new THREE.BoxGeometry(2.8, 0.02, 1.5), [-0.5, BELT + 0.012, 0]), 0x0d0e10)
  // dashboard and centre screen
  add(place(new RoundedBoxGeometry(0.34, 0.14, 1.5, 2, 0.05), [0.62, BELT - 0.01, 0]), 0x15171a)
  add(place(new RoundedBoxGeometry(0.04, 0.15, 0.3, 2, 0.01), [0.5, BELT + 0.1, 0], [0, 0, -0.2]), 0x1c2a33)
  // steering wheel (right-hand drive, near side)
  const wheel = new THREE.TorusGeometry(0.14, 0.014, 8, 24)
  add(place(wheel, [0.36, BELT + 0.1, 0.4], [0, Math.PI / 2, 0.45]), 0x0a0a0c)
  add(place(new THREE.CylinderGeometry(0.04, 0.04, 0.04, 12).rotateZ(Math.PI / 2), [0.36, BELT + 0.1, 0.4]), 0x0a0a0c)
  // seats: back and headrest (the cushions sit below the belt line)
  for (const z of [0.4, -0.4]) {
    add(place(new RoundedBoxGeometry(0.12, 0.5, 0.46, 2, 0.05), [-0.3, 0.9, z], [0, 0, 0.22]), 0x1c1d21)
    add(place(new RoundedBoxGeometry(0.09, 0.15, 0.22, 2, 0.04), [-0.37, 1.27, z], [0, 0, 0.2]), 0x1c1d21)
  }
  // rear bench
  add(place(new RoundedBoxGeometry(0.12, 0.45, 1.4, 2, 0.05), [-1.3, 0.92, 0], [0, 0, 0.3]), 0x1c1d21)
  for (const z of [0.42, 0, -0.42]) add(place(new RoundedBoxGeometry(0.08, 0.13, 0.2, 2, 0.04), [-1.38, 1.23, z], [0, 0, 0.3]), 0x1c1d21)
  // centre console
  add(place(new RoundedBoxGeometry(0.7, 0.14, 0.2, 2, 0.04), [0.2, BELT + 0.09, 0]), 0x15171a)
  return merge(parts)
}

// ------------------------------------------------------------ charge port (in the port frame, metres)

export function buildPortHousing() {
  const parts: THREE.BufferGeometry[] = []
  const outer = roundedRectShape(0.192, 0.216, 0.032)
  const hole = new THREE.Path()
  const inner = roundedRectShape(0.168, 0.192, 0.024)
  hole.setFromPoints(inner.getPoints(20))
  outer.holes.push(hole)
  const wall = new THREE.ExtrudeGeometry(outer, { depth: 0.075, bevelEnabled: false, curveSegments: 8 })
  wall.translate(0, 0, -0.075)
  parts.push(wall)
  const back = roundedSlab(0.17, 0.194, 0.01, 0.025, 0, 6)
  back.translate(0, 0, -0.07)
  parts.push(back)
  // type 2 socket collar (the round part of a CCS2 inlet)
  const ring = new THREE.CylinderGeometry(0.053, 0.053, 0.04, 36, 1, true)
  ring.rotateX(Math.PI / 2)
  ring.translate(0.0, 0.034, -0.052)
  parts.push(ring)
  const ringOut = new THREE.RingGeometry(0.052, 0.062, 36)
  ringOut.translate(0.0, 0.034, -0.032)
  parts.push(ringOut)
  return merge(parts)
}

export const PIN_RING = 0.028
export const PIN_CENTER_Y = 0.034
export const DC_PIN = { x: 0.034, y: -0.058, r: 0.0125 }

export function buildPortPins() {
  const parts: THREE.BufferGeometry[] = []
  const pin = (x: number, y: number, r: number) => {
    const g = new THREE.CylinderGeometry(r, r, 0.022, 14)
    g.rotateX(Math.PI / 2)
    g.translate(x, y, -0.058)
    parts.push(g)
  }
  for (let i = 0; i < 5; i++) {
    const a = Math.PI / 2 + (i * Math.PI * 2) / 5
    pin(Math.cos(a) * PIN_RING, PIN_CENTER_Y + Math.sin(a) * PIN_RING, 0.0055)
  }
  pin(-0.018, PIN_CENTER_Y, 0.0034)
  pin(0.018, PIN_CENTER_Y, 0.0034)
  pin(-DC_PIN.x, DC_PIN.y, DC_PIN.r)
  pin(DC_PIN.x, DC_PIN.y, DC_PIN.r)
  return merge(parts)
}

// The flap is cut from the car's own skin, so it sits flush on the curved rear quarter.
// Returns the geometry (relative to its hinge) and where the hinge is in the port frame.
export function buildPortFlap() {
  const f = portFrame()
  const inv = f.quat.clone().invert()
  const outline = roundedRectShape(0.206, 0.226, 0.034).getPoints(10)
  if (outline[0].distanceTo(outline[outline.length - 1]) < 1e-6) outline.pop()
  const n = outline.length
  const rings = [0.34, 0.68, 1]
  const toLocal = (u: number, v: number, off: number) => {
    const x = PORT_X + u
    const y = PORT_Y + v
    return new THREE.Vector3(x, y, sideZ(x, y) + off).sub(f.pos).applyQuaternion(inv)
  }
  const hinge = toLocal(0, 0.113, 0.0)
  const pos: number[] = []
  const nor: number[] = []
  const idx: number[] = []
  let facing = 1
  const put = (u: number, v: number, off: number) => {
    const p = toLocal(u, v, off).sub(hinge)
    pos.push(p.x, p.y, p.z)
    // use the skin's own normal so the flap shades exactly like the panel around it
    const n = sideNormal(PORT_X + u, PORT_Y + v).applyQuaternion(inv).multiplyScalar(facing)
    nor.push(n.x, n.y, n.z)
    return pos.length / 3 - 1
  }
  const skin = (off: number, flip: boolean) => {
    const c = put(0, 0, off)
    const ringIdx: number[][] = rings.map((r) => outline.map((p) => put(p.x * r, p.y * r, off)))
    for (let i = 0; i < n; i++) {
      const j = (i + 1) % n
      if (flip) idx.push(c, ringIdx[0][j], ringIdx[0][i])
      else idx.push(c, ringIdx[0][i], ringIdx[0][j])
    }
    for (let k = 0; k < rings.length - 1; k++) {
      for (let i = 0; i < n; i++) {
        const j = (i + 1) % n
        const A = ringIdx[k]
        const B = ringIdx[k + 1]
        if (flip) idx.push(A[i], A[j], B[i], A[j], B[j], B[i])
        else idx.push(A[i], B[i], A[j], A[j], B[i], B[j])
      }
    }
    return ringIdx[rings.length - 1]
  }
  const outer = skin(0.0035, false)
  facing = -1
  const inner = skin(-0.012, true)
  for (let i = 0; i < n; i++) {
    const j = (i + 1) % n
    idx.push(outer[i], inner[i], outer[j], outer[j], inner[i], inner[j])
  }
  const g = new THREE.BufferGeometry()
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3))
  g.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3))
  g.setIndex(idx)
  return { geo: g, hinge }
}
