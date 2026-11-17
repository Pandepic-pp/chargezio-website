import * as THREE from 'three'
import { clone as cloneSkinned } from 'three/examples/jsm/utils/SkeletonUtils.js'

// The citizens are static, T-posed meshes with no skeleton. This builds one in code: a handful of bones placed from the
// model's own proportions (x forward, y up, z across the shoulders, 1.72 m tall), skin weights from the distance of every
// vertex to the bone segments, and a procedural walk (legs, knees, arms, elbows, a little torso twist).

type V3 = [number, number, number]
const v = (a: V3) => new THREE.Vector3(a[0], a[1], a[2])

const NAMES = ['hips', 'spine', 'head', 'thighL', 'kneeL', 'thighR', 'kneeR', 'upperL', 'foreL', 'handL', 'upperR', 'foreR', 'handR'] as const
type BoneName = (typeof NAMES)[number]
const INDEX = Object.fromEntries(NAMES.map((n, i) => [n, i])) as Record<BoneName, number>

type Joints = {
  hips: V3
  spine: V3
  head: V3
  thigh: [V3, V3] // L, R
  knee: [V3, V3]
  ankle: [V3, V3]
  toe: [V3, V3]
  shoulder: [V3, V3]
  elbow: [V3, V3]
  wrist: [V3, V3]
  tip: [V3, V3]
}

function measure(root: THREE.Object3D): Joints {
  // arm extremes: the vertex furthest out on each side (the fingertips), to find the arm direction
  const tip: [V3, V3] = [[0, 1.3, 0.64], [0, 1.3, -0.64]]
  root.updateWorldMatrix(true, true)
  const p = new THREE.Vector3()
  const best = [0.3, 0.3]
  root.traverse((o) => {
    const m = o as THREE.Mesh
    if (!m.isMesh) return
    const pos = m.geometry.attributes.position
    for (let i = 0; i < pos.count; i++) {
      p.fromBufferAttribute(pos, i)
      if (p.y < 0.9) continue
      for (const s of [0, 1]) {
        const z = s === 0 ? p.z : -p.z
        if (z > best[s]) {
          best[s] = z
          tip[s] = [p.x, p.y, p.z]
        }
      }
    }
  })
  // centre line of each arm: the principal axis of the vertices out beside the body (the arm is a long thin shape)
  const sh: [V3, V3] = [[0, 1.3, 0.19], [0, 1.3, -0.19]]
  const elbow: [V3, V3] = [[0.02, 1.1, 0.42], [0.02, 1.1, -0.42]]
  const wrist: [V3, V3] = [[0.04, 0.99, 0.56], [0.04, 0.99, -0.56]]
  for (const s of [0, 1]) {
    const sign = s === 0 ? 1 : -1
    let pts: THREE.Vector3[] = []
    // arms close to the body leave few vertices out beside it: widen the search if there are too few
    for (const [yMin, zMin] of [[0.88, 0.22], [0.8, 0.2], [0.7, 0.18]]) {
      pts = []
      root.traverse((o) => {
        const m = o as THREE.Mesh
        if (!m.isMesh) return
        const pos = m.geometry.attributes.position
        for (let i = 0; i < pos.count; i++) {
          p.fromBufferAttribute(pos, i)
          if (p.y > yMin && p.y < 1.45 && sign * p.z > zMin) pts.push(p.clone())
        }
      })
      if (pts.length >= 40) break
    }
    if (pts.length < 12) continue
    const mean = new THREE.Vector3()
    pts.forEach((q) => mean.add(q))
    mean.multiplyScalar(1 / pts.length)
    // covariance, then power iteration for the principal direction
    let cxx = 0, cxy = 0, cxz = 0, cyy = 0, cyz = 0, czz = 0
    for (const q of pts) {
      const dx = q.x - mean.x, dy = q.y - mean.y, dz = q.z - mean.z
      cxx += dx * dx; cxy += dx * dy; cxz += dx * dz; cyy += dy * dy; cyz += dy * dz; czz += dz * dz
    }
    const d = new THREE.Vector3(0.05, -0.6, sign)
    for (let it = 0; it < 24; it++) {
      d.set(cxx * d.x + cxy * d.y + cxz * d.z, cxy * d.x + cyy * d.y + cyz * d.z, cxz * d.x + cyz * d.y + czz * d.z).normalize()
    }
    if (d.z * sign < 0) d.negate()
    if (d.y > 0.25 || d.z * sign < 0.1) continue // not a believable arm
    const at = (t: number): V3 => [mean.x + d.x * t, mean.y + d.y * t, mean.z + d.z * t]
    const tShoulder = (sign * 0.19 - mean.z) / (d.z || 1e-6)
    let tTip = tShoulder
    for (const q of pts) tTip = Math.max(tTip, q.clone().sub(mean).dot(d))
    // sleeves can end above the hands, which then hang lower than the points used for the fit: look further along the line
    {
      const first = tTip
      root.traverse((o) => {
        const m = o as THREE.Mesh
        if (!m.isMesh) return
        const pos = m.geometry.attributes.position
        const q = new THREE.Vector3()
        const proj = new THREE.Vector3()
        for (let i = 0; i < pos.count; i++) {
          q.fromBufferAttribute(pos, i)
          if (sign * q.z < 0.2) continue
          const t = q.clone().sub(mean).dot(d)
          if (t <= first || t > first + 0.35) continue
          proj.copy(mean).addScaledVector(d, t)
          if (proj.distanceTo(q) < 0.09) tTip = Math.max(tTip, t)
        }
      })
    }
    const len = tTip - tShoulder
    sh[s] = at(tShoulder)
    elbow[s] = at(tShoulder + len * 0.5)
    wrist[s] = at(tShoulder + len * 0.86)
    tip[s] = at(tTip)
    // the hand does not always continue the arm's line: aim it from where it really is (the middle of the hand vertices)
    const hc = new THREE.Vector3()
    let hn = 0
    for (const q of pts) {
      if (q.clone().sub(mean).dot(d) > tShoulder + len * 0.9) {
        hc.add(q)
        hn++
      }
    }
    if (hn > 3) {
      hc.multiplyScalar(1 / hn)
      tip[s] = [wrist[s][0] + (hc.x - wrist[s][0]) * 2, wrist[s][1] + (hc.y - wrist[s][1]) * 2, wrist[s][2] + (hc.z - wrist[s][2]) * 2]
    }
  }
  // arms the fit could not use: straight from the shoulder to the furthest vertex found earlier
  for (const s of [0, 1]) {
    const sign = s === 0 ? 1 : -1
    const fitted = Math.abs(wrist[s][2]) !== 0.56 || wrist[s][0] !== 0.04
    if (!fitted && best[s] > 0.3) {
      const a = v(tip[s])
      const b = v(sh[s])
      const at = (t: number): V3 => [b.x + (a.x - b.x) * t, b.y + (a.y - b.y) * t, b.z + (a.z - b.z) * t]
      elbow[s] = at(0.5)
      wrist[s] = at(0.86)
      void sign
    }
  }
  return {
    hips: [0, 0.95, 0],
    spine: [0, 1.15, 0],
    head: [0, 1.5, 0],
    thigh: [[0, 0.95, 0.09], [0, 0.95, -0.09]],
    knee: [[0, 0.5, 0.09], [0, 0.5, -0.09]],
    ankle: [[0, 0.08, 0.09], [0, 0.08, -0.09]],
    toe: [[0.13, 0.03, 0.09], [0.13, 0.03, -0.09]],
    shoulder: sh,
    elbow,
    wrist,
    tip,
  }
}

function distToSegment(p: THREE.Vector3, a: THREE.Vector3, b: THREE.Vector3) {
  const ab = b.clone().sub(a)
  const t = Math.max(0, Math.min(1, p.clone().sub(a).dot(ab) / Math.max(1e-6, ab.lengthSq())))
  return p.distanceTo(a.clone().addScaledVector(ab, t))
}

export type Rig = {
  object: THREE.Group
  // rest rotation that brings an arm from the T-pose down to the side, and the elbow's bend axis in the forearm's frame
  hang: [THREE.Quaternion, THREE.Quaternion] // upper arm: from its T-pose direction to hanging
  foreDir: [THREE.Vector3, THREE.Vector3] // elbow to wrist in the T-pose
  handDir: [THREE.Vector3, THREE.Vector3] // wrist to fingertip in the T-pose
}

export function buildRig(node: THREE.Object3D): Rig {
  const J = measure(node)
  const bones: THREE.Bone[] = NAMES.map((n) => {
    const b = new THREE.Bone()
    b.name = n
    return b
  })
  const B = (n: BoneName) => bones[INDEX[n]]
  const abs: Record<BoneName, V3> = {
    hips: J.hips,
    spine: J.spine,
    head: J.head,
    thighL: J.thigh[0],
    kneeL: J.knee[0],
    thighR: J.thigh[1],
    kneeR: J.knee[1],
    upperL: J.shoulder[0],
    foreL: J.elbow[0],
    handL: J.wrist[0],
    upperR: J.shoulder[1],
    foreR: J.elbow[1],
    handR: J.wrist[1],
  }
  const parent: Record<BoneName, BoneName | null> = {
    hips: null,
    spine: 'hips',
    head: 'spine',
    thighL: 'hips',
    kneeL: 'thighL',
    thighR: 'hips',
    kneeR: 'thighR',
    upperL: 'spine',
    foreL: 'upperL',
    handL: 'foreL',
    upperR: 'spine',
    foreR: 'upperR',
    handR: 'foreR',
  }
  for (const n of NAMES) {
    const p = parent[n]
    const a = v(abs[n])
    if (p) {
      B(n).position.copy(a.sub(v(abs[p])))
      B(p).add(B(n))
    } else B(n).position.copy(a)
  }

  // bone segments that pull on the skin: [bone, from, to, sigma]
  const seg: [BoneName, V3, V3, number][] = [
    ['hips', [0, 0.78, 0], [0, 1.0, 0], 0.18],
    ['spine', [0, 1.0, 0], [0, 1.42, 0], 0.2],
    ['head', [0, 1.46, 0], [0, 1.68, 0], 0.16],
    ['thighL', J.thigh[0], J.knee[0], 0.12],
    ['kneeL', J.knee[0], J.ankle[0], 0.1],
    ['kneeL', J.ankle[0], J.toe[0], 0.1],
    ['thighR', J.thigh[1], J.knee[1], 0.12],
    ['kneeR', J.knee[1], J.ankle[1], 0.1],
    ['kneeR', J.ankle[1], J.toe[1], 0.1],
    ['upperL', J.shoulder[0], J.elbow[0], 0.08],
    ['foreL', J.elbow[0], J.wrist[0], 0.065],
    ['handL', J.wrist[0], J.tip[0], 0.07],
    ['upperR', J.shoulder[1], J.elbow[1], 0.08],
    ['foreR', J.elbow[1], J.wrist[1], 0.065],
    ['handR', J.wrist[1], J.tip[1], 0.07],
  ]
  const segs = seg.map(([n, a, b, s]) => ({ i: INDEX[n], a: v(a), b: v(b), s }))

  const group = new THREE.Group()
  group.add(B('hips'))
  group.updateMatrixWorld(true) // the bind pose (inverse bone matrices) is taken from the bones' current world matrices
  const skeleton = new THREE.Skeleton(bones)
  const tmp = new THREE.Vector3()
  node.traverse((o) => {
    const m = o as THREE.Mesh
    if (!m.isMesh) return
    const geo = m.geometry.clone()
    const pos = geo.attributes.position
    const si = new Uint16Array(pos.count * 4)
    const sw = new Float32Array(pos.count * 4)
    const w = new Float32Array(NAMES.length)
    for (let i = 0; i < pos.count; i++) {
      tmp.fromBufferAttribute(pos, i)
      w.fill(0)
      for (const s of segs) {
        const d = distToSegment(tmp, s.a, s.b)
        w[s.i] = Math.max(w[s.i], Math.exp(-((d / s.s) ** 2)))
      }
      w[INDEX.hips] += 0.01
      // keep the four strongest
      const order = Array.from(w.keys()).sort((p, q) => w[q] - w[p]).slice(0, 4)
      let sum = 0
      for (const k of order) sum += w[k]
      order.forEach((k, j) => {
        si[i * 4 + j] = k
        sw[i * 4 + j] = w[k] / sum
      })
    }
    geo.setAttribute('skinIndex', new THREE.Uint16BufferAttribute(si, 4))
    geo.setAttribute('skinWeight', new THREE.Float32BufferAttribute(sw, 4))
    const sm = new THREE.SkinnedMesh(geo, m.material)
    sm.frustumCulled = false
    group.add(sm)
    sm.bind(skeleton)
  })

  const hang: [THREE.Quaternion, THREE.Quaternion] = [new THREE.Quaternion(), new THREE.Quaternion()]
  const foreDir: [THREE.Vector3, THREE.Vector3] = [new THREE.Vector3(), new THREE.Vector3()]
  const handDir: [THREE.Vector3, THREE.Vector3] = [new THREE.Vector3(), new THREE.Vector3()]
  for (const s of [0, 1]) {
    const sign = s === 0 ? 1 : -1
    const upperDir = v(J.elbow[s]).sub(v(J.shoulder[s])).normalize()
    hang[s].setFromUnitVectors(upperDir, new THREE.Vector3(0.03, -1, sign * 0.1).normalize())
    foreDir[s].copy(v(J.wrist[s]).sub(v(J.elbow[s]))).normalize()
    handDir[s].copy(v(J.tip[s]).sub(v(J.wrist[s]))).normalize()
  }
  if (import.meta.env.DEV) {
    const w = window as unknown as { __rigDebug?: Record<string, unknown> }
    w.__rigDebug = w.__rigDebug || {}
    w.__rigDebug[node.name] = { sh: J.shoulder, el: J.elbow, wr: J.wrist, tip: J.tip }
  }
  return { object: group, hang, foreDir, handDir }
}

export type Walker = {
  object: THREE.Group
  bones: Record<BoneName, THREE.Bone>
  rig: Rig
}

export function instantiate(rig: Rig): Walker {
  const object = cloneSkinned(rig.object) as THREE.Group
  const bones = {} as Record<BoneName, THREE.Bone>
  for (const n of NAMES) bones[n] = object.getObjectByName(n) as THREE.Bone
  return { object, bones, rig }
}

const Z = new THREE.Vector3(0, 0, 1)
const Y = new THREE.Vector3(0, 1, 0)
const qa = new THREE.Quaternion()
const qb = new THREE.Quaternion()
const qc = new THREE.Quaternion()
const qd = new THREE.Quaternion()
const dir = new THREE.Vector3()
const want = new THREE.Vector3()

// phase: walking cycle in radians (one full cycle = two steps). Rotations are about world-aligned axes: every bone's
// rest rotation is identity, so a bone's local axes are the model's own.
export function walk(w: Walker, phase: number) {
  const b = w.bones
  const sin = Math.sin
  b.hips.quaternion.setFromAxisAngle(Y, -0.07 * sin(phase))
  b.spine.quaternion.setFromAxisAngle(Y, 0.1 * sin(phase))
  for (const s of [0, 1]) {
    const L = s === 0 ? 'L' : 'R'
    const ph = phase + (s === 0 ? 0 : Math.PI) // the two sides are half a cycle apart
    // leg and knee
    const thigh = sin(ph) * 0.4
    b[`thigh${L}` as BoneName].quaternion.setFromAxisAngle(Z, thigh)
    const knee = -(0.06 + 0.6 * Math.max(0, Math.cos(ph)))
    b[`knee${L}` as BoneName].quaternion.setFromAxisAngle(Z, knee)
    // arm swings against the leg. Every segment is aimed in world space (so any rest pose works): the upper arm hangs and
    // swings, the forearm bends forward more as the hand comes forward, the hand continues the line of the forearm.
    const swing = -sin(ph) * 0.34
    const sign = s === 0 ? 1 : -1
    qa.setFromAxisAngle(Z, swing)
    b[`upper${L}` as BoneName].quaternion.copy(qa).multiply(w.rig.hang[s])
    qc.copy(qa).multiply(w.rig.hang[s]) // world rotation of the upper arm
    const flex = 0.24 + 0.35 * Math.max(0, swing / 0.34)
    dir.copy(w.rig.foreDir[s]).applyQuaternion(qc)
    want.set(Math.sin(flex), -Math.cos(flex), sign * 0.08).normalize()
    qd.setFromUnitVectors(dir, want)
    qb.copy(qc).invert().multiply(qd).multiply(qc) // local rotation of the forearm
    b[`fore${L}` as BoneName].quaternion.copy(qb)
    qc.multiply(qb) // world rotation of the forearm... as parent * local
    dir.copy(w.rig.handDir[s]).applyQuaternion(qc)
    want.set(Math.sin(flex) * 0.8, -Math.cos(flex * 0.8), sign * 0.08).normalize()
    qd.setFromUnitVectors(dir, want)
    b[`hand${L}` as BoneName].quaternion.copy(qc).invert().multiply(qd).multiply(qc)
  }
}
