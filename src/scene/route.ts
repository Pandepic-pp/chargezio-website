import * as THREE from 'three'
import { AVE_Z, CROSS_A, LANE, RINGS, RING_LANE, ringPass, ROAD_Y, roadY } from './cityLayout'
import { clamp, smooth } from '../story'

// The hero car's drive in during the opening shot:
//   down cross road A, round roundabout R1, on to the main road with a right turn, then along the lane and into the bay.
// The route is sampled densely once; a speed profile (slow in the roundabout and the turn, easing to a stop in the bay)
// is turned into a time table, so position, heading, steering and wheel spin all come from one source.

type P = [number, number]
const TURN_R = 5.4
const START_Z = 125

function build() {
  const pts: P[] = []
  const flags: number[] = [] // 1 = indicating
  const push = (x: number, z: number, f = 0) => {
    pts.push([x, z])
    flags.push(f)
  }

  // 1. cross road A: from the south, through the roundabout, down to the junction
  const lane = CROSS_A + LANE
  const zs = TURN_R - 3.0
  const a = RINGS[0]
  const via: P[] = [[lane, START_Z], [lane, a.z + 40], [lane, a.z + 24], ...ringPass(a, [0, -1]), [lane, a.z - 24], [lane, a.z - 40], [lane, 40], [lane, zs]]
  const curve = new THREE.CatmullRomCurve3(via.map(([x, z]) => new THREE.Vector3(x, 0, z)), false, 'centripetal')
  const n1 = Math.ceil(curve.getLength() / 0.5)
  for (const p of curve.getSpacedPoints(n1)) push(p.x, p.z)

  // 2. the right turn onto the main road (indicating)
  const cx = lane + TURN_R
  for (let i = 1; i <= 40; i++) {
    const th = Math.PI + ((Math.PI / 2) * i) / 40
    push(cx + TURN_R * Math.cos(th), zs + TURN_R * Math.sin(th), 1)
  }
  const turnEnd = pts.length

  // 3. along lane 1 towards the station
  const xEnd = cx
  for (let i = 1; i <= 30; i++) push(xEnd + ((-26 - xEnd) * i) / 30, -3.0)

  // 4. into the bay (same shape as the old arrival: slows, steers left... right into the bay, indicating)
  for (let i = 1; i <= 220; i++) {
    const t = i / 220
    const x = -26 * Math.pow(1 - t, 1.6)
    const z = -3.0 * (1 - smooth(0.22, 0.9, t))
    push(x, z, t > 0.2 && t < 0.92 ? 1 : 0)
  }
  return { pts, flags, turnEnd, zs }
}

const R = build()
const N = R.pts.length
const S = new Float64Array(N) // cumulative distance
const X = new Float64Array(N)
const Z = new Float64Array(N)
for (let i = 0; i < N; i++) {
  X[i] = R.pts[i][0]
  Z[i] = R.pts[i][1]
  if (i > 0) S[i] = S[i - 1] + Math.hypot(X[i] - X[i - 1], Z[i] - Z[i - 1])
}
export const ROUTE_LENGTH = S[N - 1]

// heading (yaw about +y, same convention as the car: yaw = atan2(-dz, dx)), smoothed, plus curvature for steering
const YAW = new Float64Array(N)
for (let i = 0; i < N; i++) {
  const a = Math.max(0, i - 3)
  const b = Math.min(N - 1, i + 3)
  const dx = X[b] - X[a]
  const dz = Z[b] - Z[a]
  YAW[i] = Math.hypot(dx, dz) > 1e-6 ? Math.atan2(-dz, dx) : i > 0 ? YAW[i - 1] : 0
  if (i > 0) while (YAW[i] - YAW[i - 1] > Math.PI) YAW[i] -= 2 * Math.PI
  if (i > 0) while (YAW[i] - YAW[i - 1] < -Math.PI) YAW[i] += 2 * Math.PI
}
// the bay: the last metres end straight
YAW[N - 1] = 0
const STEER = new Float64Array(N)
for (let i = 0; i < N; i++) {
  const a = Math.max(0, i - 6)
  const b = Math.min(N - 1, i + 6)
  const ds = Math.max(1e-3, S[b] - S[a])
  STEER[i] = clamp(Math.atan(2.78 * ((YAW[b] - YAW[a]) / ds)), -0.5, 0.5)
}

// speed profile (m/s) along the route
const ringIn = (() => {
  for (let i = 0; i < N; i++) if (Math.hypot(X[i] - RINGS[0].x, Z[i] - RINGS[0].z) < RING_LANE + 4) return S[i]
  return 0
})()
const ringOut = (() => {
  for (let i = N - 1; i >= 0; i--) if (Math.hypot(X[i] - RINGS[0].x, Z[i] - RINGS[0].z) < RING_LANE + 4) return S[i]
  return 0
})()
const turnStart = S[R.turnEnd - 41]
const turnEnd = S[R.turnEnd - 1]
function speedAt(s: number) {
  let v = 12.5
  // slow for the roundabout, in and out
  v = Math.min(v, 6.5 + 0.55 * Math.max(0, ringIn - s), 6.5 + 0.35 * Math.max(0, s - ringOut))
  // slow for the turn
  v = Math.min(v, 5.5 + 0.4 * Math.max(0, turnStart - s), 5.5 + 0.35 * Math.max(0, s - turnEnd))
  // main road cruise, then ease to a stop in the bay
  const rem = ROUTE_LENGTH - s
  v = Math.min(v, 9.0, 0.35 + 2.7 * Math.sqrt(Math.max(0, rem)))
  return Math.max(v, 0.25)
}
const T = new Float64Array(N) // time at each sample
for (let i = 1; i < N; i++) {
  const ds = S[i] - S[i - 1]
  const v = 0.5 * (speedAt(S[i]) + speedAt(S[i - 1]))
  T[i] = T[i - 1] + ds / v
}
const T_END = T[N - 1]

function indexAtTime(t: number) {
  let lo = 0
  let hi = N - 1
  while (hi - lo > 1) {
    const m = (lo + hi) >> 1
    if (T[m] <= t) lo = m
    else hi = m
  }
  return lo
}

export type IntroPose = {
  x: number
  y: number
  z: number
  yaw: number
  steer: number
  travel: number
  pitch: number
  speed: number
  turning: number
  braking: number
}

// u: 0 (start of the drive) .. 1 (parked)
export function routePose(u: number): IntroPose {
  const t = clamp(u) * T_END
  const i = indexAtTime(t)
  const j = Math.min(N - 1, i + 1)
  const f = T[j] > T[i] ? (t - T[i]) / (T[j] - T[i]) : 0
  const s = S[i] + (S[j] - S[i]) * f
  const x = X[i] + (X[j] - X[i]) * f
  const z = Z[i] + (Z[j] - Z[i]) * f
  const yaw = YAW[i] + (YAW[j] - YAW[i]) * f
  const steer = STEER[i] + (STEER[j] - STEER[i]) * f
  const v = speedAt(s)
  const vA = speedAt(Math.max(0, s - 1.5))
  const vB = speedAt(Math.min(ROUTE_LENGTH, s + 1.5))
  const acc = (v * (vB - vA)) / 3 // m/s^2
  const braking = clamp(-acc / 1.8)
  return {
    x,
    y: roadY(x, z),
    z,
    yaw,
    steer,
    travel: s - ROUTE_LENGTH, // 0 once parked, like the scroll story expects
    pitch: -0.014 * braking * smooth(0.5, 3, v),
    speed: v,
    turning: R.flags[i],
    braking,
  }
}

// the car is parked at this fraction of the opening shot; the camera finishes its swing into the hero shot after that
export const INTRO_DRIVE_END = 13.5 / 15 // the car is parked 0.9 of the way through the opening shot (13.5 of its 15 design seconds)

export const ROUTE_START = { x: X[0], z: Z[0] }
export const INTRO_ROAD_Y = ROAD_Y
export const AVENUE_Z = AVE_Z
