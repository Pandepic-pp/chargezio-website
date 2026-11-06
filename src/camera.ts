import * as THREE from 'three'
import { clamp, lerp, smooth, story } from './story'
import { carPose } from './layout'

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
  { p: 0.22, pos: [-0.8, 1.4, 5.6], tgt: [-1.9, 0.8, 0.8], box: [-2.55, 1.0, 1.55, 0.95] },
  { p: 0.3, pos: [-1.8, 1.3, 4.3], tgt: [-2.0, 0.8, 0.9], box: [-2.4, 0.95, 1.25, 0.85] },
  // the moment of insertion: a close-up on the plug and the port
  { p: 0.345, pos: [-1.55, 1.15, 3.1], tgt: [-2.0, 0.8, 0.9], box: [-2.1, 0.85, 0.55, 0.5] },
  { p: 0.41, pos: [-2.7, 1.2, 3.4], tgt: [-2.0, 0.78, 0.9], box: [-2.45, 0.95, 1.6, 1.15] },
  { p: 0.52, pos: [-1.1, 1.5, 5.8], tgt: [-1.5, 0.8, 0.5], box: [-2.4, 0.95, 1.6, 1.15] },
  { p: 0.66, pos: [0.4, 1.5, 7.8], tgt: [0, 0.8, 0], box: [-2.2, 0.95, 1.9, 1.0] },
  { p: 0.72, pos: [0.2, 1.5, 7.8], tgt: [0.3, 0.8, 0], box: [0.0, 0.8, 2.7, 0.9] },
  { p: 1.0, pos: [-0.6, 1.4, 7.4], tgt: [3.5, 0.9, 0], box: [1.6, 0.8, 4.6, 0.9] },
]

const P = new THREE.Vector3()
const T = new THREE.Vector3()
const D = new THREE.Vector3()
const rad = THREE.MathUtils.degToRad

export function applyCamera(cam: THREE.PerspectiveCamera, p: number, aspect: number, time: number, width = 1200) {
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

  // Gentle idle drift in the hero only.
  if (!story.reduced) {
    const w = 1 - smooth(0, 0.14, p)
    P.x += Math.sin(time * 0.5) * 0.25 * w
    P.y += Math.sin(time * 0.37) * 0.06 * w
  }

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
