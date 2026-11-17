import * as THREE from 'three'

// The city map (metres). The main road runs along x (see Road.tsx); everything new hangs off it:
//
//   cross road A  x = -48, crosses the main road and ends in roundabout R1 on the avenue
//   cross road B  x = +70, crosses the main road and ends in roundabout R2 on the avenue
//   avenue        z = +90, runs along x through both roundabouts
//
// Traffic keeps to the right. Looking down the heading, the right-hand side is (-dz, dx) in (x, z).

export const ROAD_W = 9.4
export const LANE = 2.35 // lane centre offset from the road centre line
export const CROSS_A = -48
export const CROSS_B = 70
export const AVE_Z = 90
export const RING_OUT = 15 // roundabout asphalt radius
export const ISLAND_R = 7
export const RING_LANE = 11 // radius cars drive on
export const ROAD_Y = 0.17 // the new roads sit just above the main pavement so they read as crossing it
export const NEW_PAVE_Y = 0.32
export const MAIN_NEAR = 1.3 // main road kerbs
export const MAIN_FAR = -8.0
export const LANE1 = -3.0 // main road, heading +x
export const LANE2 = -6.2 // main road, heading -x
export const RINGS = [
  { x: CROSS_A, z: AVE_Z },
  { x: CROSS_B, z: AVE_Z },
]
export const EXTENT = 240

// height of the road surface at a point: the main road is at 0, the new roads ramp up to ROAD_Y just outside its kerbs
export function roadY(_x: number, z: number) {
  const d = Math.max(z - MAIN_NEAR, MAIN_FAR - z, 0)
  return ROAD_Y * Math.min(1, d / 0.5)
}

type P2 = [number, number]

// Points of a half-circle pass round a roundabout: the car enters on `lane` offset, travelling along `dir` (unit, in x/z).
export function ringPass(c: { x: number; z: number }, dir: P2, R = RING_LANE, n = 14): P2[] {
  const right: P2 = [-dir[1], dir[0]]
  const off = Math.asin(LANE / R)
  const px = c.x + right[0] * LANE - dir[0] * Math.sqrt(R * R - LANE * LANE)
  const pz = c.z + right[1] * LANE - dir[1] * Math.sqrt(R * R - LANE * LANE)
  const thIn = Math.atan2(pz - c.z, px - c.x)
  const sweep = Math.PI - 2 * off
  const out: P2[] = []
  for (let i = 0; i <= n; i++) {
    const th = thIn - (sweep * i) / n // right-hand traffic goes round with decreasing angle
    out.push([c.x + R * Math.cos(th), c.z + R * Math.sin(th)])
  }
  return out
}

// A lane running along `dir` through a roundabout centred on c, entered `before` metres away and left `after` metres away.
function laneThrough(c: { x: number; z: number }, dir: P2, before: number, after: number): P2[] {
  const right: P2 = [-dir[1], dir[0]]
  const at = (m: number): P2 => [c.x + right[0] * LANE + dir[0] * m, c.z + right[1] * LANE + dir[1] * m]
  return [at(-before), at(-before * 0.62), ...ringPass(c, dir), at(after * 0.62), at(after)]
}

export function curveOf(points: P2[]) {
  return new THREE.CatmullRomCurve3(points.map(([x, z]) => new THREE.Vector3(x, 0, z)), false, 'centripetal')
}

export type Route = { name: string; curve: THREE.CatmullRomCurve3; length: number; speed: number; count: number }

const route = (name: string, points: P2[], speed: number, count: number): Route => {
  const curve = curveOf(points)
  return { name, curve, length: curve.getLength(), speed, count }
}

// Lanes used by the background traffic (the main road lanes are straight).
export const ROUTES: Route[] = (() => {
  const A = RINGS[0]
  const B = RINGS[1]
  const r: Route[] = []
  r.push(route('main-east', [[-135, LANE1], [0, LANE1], [EXTENT, LANE1]], 8.6, 5))
  r.push(route('main-west', [[EXTENT, LANE2], [0, LANE2], [-EXTENT, LANE2]], 9.4, 5))
  r.push(route('A-north', [[CROSS_A + LANE, 165], ...laneThrough(A, [0, -1], 30, 30).slice(0, -2), [CROSS_A + LANE, 40], [CROSS_A + LANE, -8], [CROSS_A + LANE, -EXTENT]], 7.8, 3))
  r.push(route('A-south', [[CROSS_A - LANE, -EXTENT], [CROSS_A - LANE, -8], [CROSS_A - LANE, 40], ...laneThrough(A, [0, 1], 30, 30).slice(2), [CROSS_A - LANE, 235]], 8.2, 3))
  r.push(route('B-north', [[CROSS_B + LANE, 235], ...laneThrough(B, [0, -1], 30, 30).slice(0, -2), [CROSS_B + LANE, 40], [CROSS_B + LANE, -8], [CROSS_B + LANE, -EXTENT]], 8.0, 3))
  r.push(route('B-south', [[CROSS_B - LANE, -EXTENT], [CROSS_B - LANE, -8], [CROSS_B - LANE, 40], ...laneThrough(B, [0, 1], 30, 30).slice(2), [CROSS_B - LANE, 235]], 7.6, 3))
  r.push(route('ave-east', [[CROSS_A - 110, AVE_Z + LANE], ...laneThrough(A, [1, 0], 30, 30).slice(0, -2), ...laneThrough(B, [1, 0], 30, 30).slice(2), [CROSS_B + 110, AVE_Z + LANE]], 8.4, 4))
  r.push(route('ave-west', [[CROSS_B + 110, AVE_Z - LANE], ...laneThrough(B, [-1, 0], 30, 30).slice(0, -2), ...laneThrough(A, [-1, 0], 30, 30).slice(2), [CROSS_A - 110, AVE_Z - LANE]], 8.0, 4))
  return r
})()

// Shared position/state of the hero car so the traffic can keep out of its way.
export const hero = { x: 0, z: 0, yaw: 0, moving: false }
