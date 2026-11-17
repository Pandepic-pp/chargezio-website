import * as THREE from 'three'
import { clamp, lerp, smooth, story } from './story'
import { carPose } from './layout'
import { INTRO_DRIVE_END, routePose } from './scene/route'

type V3 = [number, number, number]
// What must stay in frame at each point of the story (world metres): centre x, centre y, half width, half height.
type Box = [number, number, number, number]

// Story timeline (progress 0 to 1):
//  0.00 to 0.14  hero, car idle, charger rises
//  0.14 to 0.36  connector travels to the car and plugs in
//  0.36 to 0.60  charging
//  0.60 to 0.68  unplug
//  0.68 to 0.98  car drives away
//
// pos / tgt: the hand-tuned wide-screen shot. box: the part of the scene the story needs on screen.
// On narrow screens the camera is placed from the box, so the plug, the cable and the charger stay
// in view and the viewer can follow what happens even when the rest of the scene is cropped.
const KEYS: { p: number; pos: V3; tgt: V3; box: Box }[] = [
  { p: 0.0, pos: [3.4, 1.8, 9.8], tgt: [0, 0.75, 0], box: [0.0, 0.75, 2.5, 0.85] },
  { p: 0.12, pos: [1.4, 1.55, 7.6], tgt: [-0.2, 0.75, 0.2], box: [-1.9, 0.95, 2.6, 1.05] },
  { p: 0.22, pos: [-0.65, 1.4, 5.6], tgt: [-1.7, 0.8, 0.8], box: [-2.3, 1.0, 1.65, 0.95] },
  { p: 0.3, pos: [-1.5, 1.3, 4.3], tgt: [-1.7, 0.85, 0.9], box: [-2.15, 0.95, 1.35, 0.85] },
  // the moment of insertion: a close-up on the plug and the port
  { p: 0.345, pos: [-1.1, 1.15, 3.1], tgt: [-1.65, 0.9, 0.9], box: [-1.8, 0.9, 0.6, 0.5] },
  { p: 0.41, pos: [-2.4, 1.2, 3.4], tgt: [-1.7, 0.8, 0.9], box: [-2.2, 0.95, 1.7, 1.15] },
  { p: 0.52, pos: [-0.9, 1.5, 5.8], tgt: [-1.35, 0.8, 0.5], box: [-2.25, 0.95, 1.7, 1.15] },
  { p: 0.66, pos: [0.4, 1.5, 7.8], tgt: [0, 0.8, 0], box: [-2.2, 0.95, 1.9, 1.0] },
  { p: 0.72, pos: [0.2, 1.5, 7.8], tgt: [0.3, 0.8, 0], box: [0.0, 0.8, 2.7, 0.9] },
  { p: 1.0, pos: [-0.6, 1.4, 7.4], tgt: [3.5, 0.9, 0], box: [1.6, 0.8, 4.6, 0.9] },
]

// The charger (x = -3.5) and the whole parked car (about 4.4 m long, centred on x = 0): centre x, centre y, half width, half height.
// It reaches up to the canopy so the sign is not pushed under the header.
const FULL_SCENE: Box = [-0.85, 1.75, 3.3, 1.75]

const P = new THREE.Vector3()
const T = new THREE.Vector3()
const D = new THREE.Vector3()
const rad = THREE.MathUtils.degToRad

// The camera only moves with the story: no idle drift, no random motion.
export function applyCamera(cam: THREE.PerspectiveCamera, p: number, aspect: number, _time: number, width = 1200) {
  let i = 0
  while (i < KEYS.length - 2 && p > KEYS[i + 1].p) i++
  const a = KEYS[i]
  const b = KEYS[i + 1]
  const k = smooth(a.p, b.p, p)
  P.set(lerp(a.pos[0], b.pos[0], k), lerp(a.pos[1], b.pos[1], k), lerp(a.pos[2], b.pos[2], k))
  T.set(lerp(a.tgt[0], b.tgt[0], k), lerp(a.tgt[1], b.tgt[1], k), lerp(a.tgt[2], b.tgt[2], k))
  const box = a.box.map((v, n) => lerp(v, b.box[n], k)) as Box

  // Which layout the page uses: text on the left (wide) or text at the bottom (narrow, same rule as the CSS).
  const wide = Math.min(smooth(1.06, 1.14, aspect), smooth(740, 780, width))

  // Narrow (portrait) screens: while the car is parked, frame the whole charger and the whole car, not just the plug, so the
  // scene reads properly. The close-up at the moment of insertion keeps its tight framing on purpose. Wide screens are untouched.
  const parked = smooth(0.1, 0.16, p) * (1 - smooth(0.62, 0.68, p))
  const closeUp = smooth(0.27, 0.335, p) * (1 - smooth(0.355, 0.43, p))
  const widen = (1 - wide) * parked * (1 - closeUp)
  for (let n = 0; n < 4; n++) box[n] = lerp(box[n], FULL_SCENE[n], widen)
  const fov = 34 + 12 * clamp((1.1 - aspect) / 0.5) + 6 * smooth(0.7, 1, p)
  const tanHalf = Math.tan(rad(fov / 2))

  // Distance needed to keep the box in the part of the screen the text leaves free.
  // the charging caption carries a taller HUD card, so the scene gets less room while it is showing
  const hud = smooth(0.34, 0.38, p) * (1 - smooth(0.6, 0.64, p))
  const usableW = lerp(0.94, 0.56, wide)
  const usableH = lerp(lerp(0.56, 0.42, hud), 0.78, wide)
  const need = Math.max((box[2] * 2 * 1.08) / (2 * tanHalf * aspect * usableW), (box[3] * 2 * 1.08) / (2 * tanHalf * usableH))

  // Narrow screens aim at the box. Wide screens keep the tuned shot and only pull back (and re-aim)
  // when the box would not fit in the part of the screen the text leaves free.
  const narrow = 1 - wide
  D.copy(P).sub(T)
  const d0 = D.length()
  const dir = D.divideScalar(d0)
  const bind = smooth(d0 * 0.92, d0 * 1.12, need)
  const aim = Math.max(narrow, bind)
  const d1 = Math.max(lerp(d0, need, narrow), need)
  T.x = lerp(T.x, box[0], aim)
  T.y = lerp(T.y, box[1], aim * 0.85)
  P.copy(T).addScaledVector(dir, d1)

  // Follow the car while it drives, but lag more at the end so it pulls away.
  const pose = carPose(p)
  const follow = lerp(0.72, 0.45, smooth(0.8, 1, p))
  P.x += pose.x * follow
  T.x += pose.x * follow
  P.z += pose.z * 0.85
  T.z += pose.z * 0.95

  if (Math.abs(cam.fov - fov) > 0.01) {
    cam.fov = fov
    cam.updateProjectionMatrix()
  }

  cam.position.copy(P)
  cam.lookAt(T)

  // Layout shift: keep the subject clear of the text. Wide puts text on the left, narrow puts it at the
  // bottom. Shifts are parallel moves, so perspective stays correct.
  const dist = P.distanceTo(T)
  const visH = 2 * tanHalf * dist
  cam.translateX(-0.12 * visH * aspect * wide)
  cam.translateY(lerp(lerp(-0.1, -0.2, hud), 0.07, wide) * visH)
}


// ------------------------------------------------------------------ opening shot
// Bird's-eye view of the city, a quick descent onto the hero car, then a full 360 degree orbit around it that starts early and
// runs while the car drives in (down the cross road, round the roundabout, through the turn and along the main road). The orbit
// ends at the moment the car stops in its bay, with the camera back at the hero azimuth; the camera then comes down and settles
// into the hero shot.
// The camera sits at (distance, elevation, azimuth) around a target. Distance and elevation are interpolated through key poses
// with a smooth spline; the azimuth is eased by hand (so the orbit starts and stops cleanly); the target slides from the middle
// of the map onto the car. The last pose is the hero shot that applyCamera produced, so the hand-over is exact.
const CAR_C = new THREE.Vector3(0, 0.8, 0)
const MAP_C = new THREE.Vector3(-30, 0.8, 42)
const _q0 = new THREE.Quaternion()
const _m = new THREE.Matrix4()
const _heroP = new THREE.Vector3()
const _heroQ = new THREE.Quaternion()
const _up = new THREE.Vector3(0, 1, 0)
const _tgt = new THREE.Vector3()
const rad2 = (d: number) => (d * Math.PI) / 180

// All times below are in "design seconds": the shot is laid out as if it lasted DESIGN seconds, and is then stretched or squeezed
// to INTRO_SECONDS, so making the intro shorter or longer keeps every beat in proportion (the orbit still ends as the car stops).
const DESIGN = 15
const ORBIT_START = 5.0
const ORBIT_END = 13.5 // the car stops now (INTRO_DRIVE_END), and the orbit ends with it
const ORBIT_FROM = 0.5 // azimuth offset from the hero azimuth when the orbit starts
const ORBIT_TURN = -Math.PI * 2 // the orbit turns the azimuth through a full circle (clockwise seen from above), back to the hero azimuth

// [seconds, ln distance, elevation]
// The towers stand 18 m or more either side of the cross roads and about 30 m either side of the main road, and the near-side
// low-rise is under 12 m, so the camera flies over that early on (high) and then tightens: about 24 m out at the start of the orbit,
// 12 m by the end. While the car pulls into the bay the camera is in front of the station, and the fascia (3.6 to 4.1 m up, 4.4 m
// out) must not sweep across the car: from 12.2 s the camera is low enough (about 22 degrees) that its sight line to the car
// passes under the fascia, and it keeps coming down to the hero view afterwards.
const KEYS3: [number, number, number][] = [
  [0.0, Math.log(170), rad2(72)],
  [2.5, Math.log(80), rad2(58)],
  [5.0, Math.log(24), rad2(35)],
  [8.0, Math.log(20), rad2(32)],
  [11.0, Math.log(15.5), rad2(28)],
  [12.2, Math.log(13), rad2(23)],
  [ORBIT_END, Math.log(12.2), rad2(21)],
]

const _fwd = new THREE.Vector3()
const _rollQ = new THREE.Quaternion()

export function applyIntro(cam: THREE.PerspectiveCamera, t: number, heroFov: number) {
  _heroP.copy(cam.position)
  _heroQ.copy(cam.quaternion)
  const d = _heroP.clone().sub(CAR_C)
  const r1 = d.length()
  const e1 = Math.asin(d.y / r1)
  const a1 = Math.atan2(d.x, d.z)
  const keys = [...KEYS3.map((k) => [k[0], k[1], k[2]]), [DESIGN, Math.log(r1), e1]]

  // piecewise cubic Hermite through the keys (Catmull-Rom tangents, flat at both ends so it starts and stops softly)
  const tt = clamp(t)
  const ts = tt * DESIGN
  let i = 0
  while (i < keys.length - 2 && ts > keys[i + 1][0]) i++
  const k0 = keys[i]
  const k1 = keys[i + 1]
  const h = k1[0] - k0[0]
  const u = (ts - k0[0]) / h
  const tangent = (j: number, c: number) => {
    if (j <= 0 || j >= keys.length - 1) return 0
    return (keys[j + 1][c] - keys[j - 1][c]) / (keys[j + 1][0] - keys[j - 1][0])
  }
  const herm = (c: number) => {
    const p0 = k0[c]
    const p1 = k1[c]
    const m0 = tangent(i, c) * h
    const m1 = tangent(i + 1, c) * h
    const u2 = u * u
    const u3 = u2 * u
    return (2 * u3 - 3 * u2 + 1) * p0 + (u3 - 2 * u2 + u) * m0 + (-2 * u3 + 3 * u2) * p1 + (u3 - u2) * m1
  }
  const r = Math.exp(herm(1))
  const e = herm(2)
  // azimuth: eased by hand. First a small drift, then the full orbit, which starts and stops at rest
  const off = ts < ORBIT_START ? lerp(1.0, ORBIT_FROM, smooth(0, ORBIT_START, ts)) : lerp(ORBIT_FROM, ORBIT_TURN, smooth(ORBIT_START, ORBIT_END, ts))
  const a = a1 + off

  // target: middle of the map first, then the car
  const pose = routePose(tt / INTRO_DRIVE_END)
  _tgt.set(pose.x, 0.8, pose.z)
  const w = smooth(1.0, 5.0, ts)
  const target = MAP_C.clone().lerp(_tgt, w)
  cam.position.set(target.x + r * Math.cos(e) * Math.sin(a), target.y + r * Math.sin(e), target.z + r * Math.cos(e) * Math.cos(a))

  // look at the target first, hand over to the hero orientation over the last part
  _m.lookAt(cam.position, target, _up)
  _q0.setFromRotationMatrix(_m)
  // keep the car in the middle of the picture through the whole orbit, and only turn to the hero view as the camera settles
  cam.quaternion.copy(_q0).slerp(_heroQ, smooth(ORBIT_END - 0.5, DESIGN, ts))

  // dreamy float: the camera drifts, rocks and breathes a little, then everything settles as it comes to rest
  const calm = 1 - smooth(5.5, DESIGN, ts)
  cam.position.y += 0.012 * r * Math.sin(ts * 0.62 + 1.1) * calm
  _fwd.set(0, 0, -1).applyQuaternion(cam.quaternion)
  cam.quaternion.premultiply(_rollQ.setFromAxisAngle(_fwd, 0.05 * Math.sin(ts * 0.55) * calm))

  const fov = heroFov + 8 * (1 - smooth(0, 12, ts)) + 0.9 * Math.sin(ts * 0.7) * calm
  if (Math.abs(cam.fov - fov) > 0.01) {
    cam.fov = fov
    cam.updateProjectionMatrix()
  }
}
