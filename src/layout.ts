import * as THREE from 'three'
import { clamp, smooth } from './story'
import { portFrame } from './scene/carShape'

// One place for the story timeline and the key positions. The 3D scene and the camera both read from
// here, so the camera can frame exactly what the story is showing.

// Street layout (metres). The car parks in the lane next to the kerb, the charger stands on the pavement.
export const KERB_Z = 1.3
export const PAVE_Y = 0.14
export const STATION = new THREE.Vector3(-3.5, PAVE_Y, 1.9)

export const PORT = portFrame()
export const PLUG_TIP = PORT.pos.clone().addScaledVector(PORT.n, -0.06)
export const APPROACH = PORT.pos.clone().addScaledVector(PORT.n, 0.66)
APPROACH.y += 0.03

// Station-local anchors (x right, y up, z towards the camera).
export const HOLSTER_LOCAL = new THREE.Vector3(0.385, 1.1, 0.04)
export const CABLE_OUT_LOCAL = new THREE.Vector3(0.435, 0.6, 0.06)

const HOLSTER_DIR = new THREE.Vector3(1, -0.1, 0.04).normalize()
export const Q_HOLSTER = new THREE.Quaternion().setFromRotationMatrix(
  new THREE.Matrix4().lookAt(new THREE.Vector3(), HOLSTER_DIR.clone().negate(), new THREE.Vector3(0, 1, 0)),
)
export const Q_PLUG = PORT.quat.clone()

export function phases(p: number) {
  return {
    a: smooth(0.14, 0.28, p) - smooth(0.66, 0.72, p), // connector travels to the car
    b: smooth(0.3, 0.36, p) - smooth(0.6, 0.66, p), // insert
    f: smooth(0.12, 0.2, p) - smooth(0.7, 0.76, p), // port flap
    g: smooth(0.34, 0.38, p) * (1 - smooth(0.58, 0.62, p)), // charging
    rise: smooth(0.03, 0.13, p), // charger rises out of the pavement
    wake: smooth(0.62, 0.7, p), // car wakes up: lamps on
  }
}

// How far the charger is below the pavement (so the hero stays clean).
export const riseOffset = (p: number) => -1.95 * (1 - smooth(0.03, 0.13, p))

const tmpA = new THREE.Vector3()
export function connectorPose(p: number, pos: THREE.Vector3, quat: THREE.Quaternion) {
  const { a, b } = phases(p)
  pos.copy(STATION).add(HOLSTER_LOCAL)
  pos.y += riseOffset(p)
  pos.lerp(tmpA.copy(APPROACH), a)
  pos.y += Math.sin(a * Math.PI) * 0.18 * (1 - b)
  pos.lerp(tmpA.copy(PLUG_TIP), b)
  quat.copy(Q_HOLSTER).slerp(Q_PLUG, a)
}

// ---------------------------------------------------------------- car path

const D0 = 0.68
const D1 = 0.98
function carXZ(d: number): [number, number] {
  // pulls out of the bay and settles in the middle of the lane (lane centre is z = -3)
  return [30 * Math.pow(d, 1.7), -2.9 * smooth(0.1, 0.8, d)]
}

export function carPose(p: number) {
  const d = clamp((p - D0) / (D1 - D0))
  const [x, z] = carXZ(d)
  const e = 0.004
  const [x1, z1] = carXZ(Math.min(1, d + e))
  const [x0, z0] = carXZ(Math.max(0, d - e))
  const dx = x1 - x0
  const dz = z1 - z0
  const yaw = dx > 1e-5 ? Math.atan2(-dz, dx) : 0
  const yaw1 = (() => {
    const [xa, za] = carXZ(Math.min(1, d + 3 * e))
    const dxa = xa - x1
    return dxa > 1e-5 ? Math.atan2(-(za - z1), dxa) : 0
  })()
  const ds = Math.hypot(dx, dz) || 1
  const steer = clamp(Math.atan(2.78 * ((yaw1 - yaw) / (ds * 1.5))), -0.45, 0.45)
  return {
    x,
    z,
    yaw,
    steer: dx > 1e-5 ? steer : 0,
    travel: x / Math.max(0.2, Math.cos(yaw)),
    pitch: 0.016 * smooth(0, 0.1, d) * (1 - smooth(0.2, 0.6, d)),
  }
}
