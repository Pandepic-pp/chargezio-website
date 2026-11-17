import { useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import { useGLTF } from '@react-three/drei'
import * as THREE from 'three'
import { smooth } from '../story'
import { PAVE_Y } from '../layout'
import { AVE_Z, CROSS_A, CROSS_B, NEW_PAVE_Y, ROAD_W } from './cityLayout'
import { modelUrl } from './fleet'
import { buildRig, instantiate, walk } from './citizenRig'
import { seeded } from './props'

// Pedestrians: the 14 citizens of a low-poly citizen pack (optimised in Blender to public/models/city/citizens.glb)
// strolling along the pavements. Each walks a straight line back and forth; none walk through the hero shot's foreground.

type Walker = { x0: number; z0: number; x1: number; z1: number; y: number; speed: number; phase: number; len: number; h: number; kind: number; slot: number }

// Dev only: ?npcs=near puts every walker on one short line in front of a camera at (0, 1.4, -5), to inspect the walk.
const NPCS_DEV = import.meta.env.DEV ? new URLSearchParams(location.search).get('npcs') : null
const NEAR = NPCS_DEV === 'near'
// ?npcs=front|side: all 14 citizens in a row (facing the camera, or sideways on) walking on the spot
const LINEUP = NPCS_DEV === 'front' || NPCS_DEV === 'side' ? NPCS_DEV : null

function lines(): { x0: number; z0: number; x1: number; z1: number; y: number; n: number }[] {
  const e = ROAD_W / 2 + 3.5 // middle of a new road's pavement strip
  if (NEAR || LINEUP) return [{ x0: -5, z0: -9.2, x1: 5, z1: -9.2, y: PAVE_Y, n: 7 }, { x0: -5, z0: -10.3, x1: 5, z1: -10.3, y: PAVE_Y, n: 7 }]
  return [
    // main road, near pavement: stay out of the hero shot (|x| < 13)
    { x0: 14, z0: 6.8, x1: 58, z1: 6.8, y: PAVE_Y, n: 3 },
    { x0: 17, z0: 8.6, x1: 44, z1: 8.6, y: PAVE_Y, n: 2 },
    { x0: -58, z0: 7.6, x1: -15, z1: 7.6, y: PAVE_Y, n: 3 },
    // main road, far pavement
    { x0: -62, z0: -12.2, x1: 62, z1: -12.2, y: PAVE_Y, n: 6 },
    { x0: -50, z0: -13.6, x1: 54, z1: -13.6, y: PAVE_Y, n: 4 },
    // cross roads
    { x0: CROSS_A - e, z0: 14, x1: CROSS_A - e, z1: 64, y: NEW_PAVE_Y, n: 2 },
    { x0: CROSS_A + e, z0: 16, x1: CROSS_A + e, z1: 62, y: NEW_PAVE_Y, n: 2 },
    { x0: CROSS_B - e, z0: 14, x1: CROSS_B - e, z1: 64, y: NEW_PAVE_Y, n: 2 },
    { x0: CROSS_B + e, z0: 16, x1: CROSS_B + e, z1: 62, y: NEW_PAVE_Y, n: 2 },
    { x0: CROSS_A - e, z0: -16, x1: CROSS_A - e, z1: -70, y: NEW_PAVE_Y, n: 2 },
    // avenue
    { x0: -28, z0: AVE_Z - e, x1: 50, z1: AVE_Z - e, y: NEW_PAVE_Y, n: 3 },
    { x0: -26, z0: AVE_Z + e, x1: 52, z1: AVE_Z + e, y: NEW_PAVE_Y, n: 3 },
  ]
}

const CITIZENS = 14
const CITIZEN_URL = modelUrl('citizens')
useGLTF.preload(CITIZEN_URL)

export function People() {
  const gltf = useGLTF(CITIZEN_URL)
  const walkers = useMemo<Walker[]>(() => {
    const rand = seeded(5)
    const out: Walker[] = []
    for (const l of lines()) {
      const len = Math.hypot(l.x1 - l.x0, l.z1 - l.z0)
      for (let k = 0; k < l.n; k++) {
        out.push({
          x0: l.x0,
          z0: l.z0 + (rand() - 0.5) * 0.8,
          x1: l.x1,
          z1: l.z1 + (rand() - 0.5) * 0.8,
          y: l.y,
          speed: 1.0 + rand() * 0.6,
          phase: rand() * len * 2,
          len,
          h: 0.95 + rand() * 0.1,
          kind: 0,
          slot: 0,
        })
      }
    }
    // spread the 14 citizens over the walkers (shuffled, so neighbours differ)
    const kinds = Array.from({ length: out.length }, (_, i) => i % CITIZENS)
    for (let i = kinds.length - 1; i > 0; i--) {
      const j = Math.floor(rand() * (i + 1))
      ;[kinds[i], kinds[j]] = [kinds[j], kinds[i]]
    }
    const used = new Array(CITIZENS).fill(0)
    out.forEach((w, i) => {
      w.kind = kinds[i]
      w.slot = used[w.kind]++
    })
    return out
  }, [])
  // one rig (skeleton + skin weights built from the model) per citizen, then a clone of it for every walker
  const walkersObj = useMemo(() => {
    const rigs = Array.from({ length: CITIZENS }, (_, i) => {
      const node = gltf.scene.getObjectByName('citizen_' + String(i).padStart(2, '0'))
      return node ? buildRig(node) : null
    })
    return walkers.map((w) => {
      const rig = rigs[w.kind]
      return rig ? instantiate(rig) : null
    })
  }, [gltf, walkers])
  const t0 = useRef(performance.now())
  if (import.meta.env.DEV) (window as unknown as { __walkers: unknown }).__walkers = walkersObj

  useFrame(() => {
    const t = (performance.now() - t0.current) / 1000
    if (LINEUP) {
      walkers.forEach((w, i) => {
        const o = walkersObj[i]
        if (!o) return
        o.object.position.set((w.kind - 6.5) * 0.85, w.y, -9.2)
        o.object.rotation.set(0, LINEUP === 'front' ? -Math.PI / 2 : 0, 0)
        o.object.scale.setScalar(1)
        walk(o, t * 5)
      })
      return
    }
    const TURN = 0.45 // metres over which a walker turns round at the end of the line
    walkers.forEach((w, i) => {
      const o = walkersObj[i]
      if (!o) return
      const d = (w.phase + t * w.speed) % (2 * w.len)
      const u = d < w.len ? d / w.len : 2 - d / w.len // there and back
      const x = w.x0 + (w.x1 - w.x0) * u
      const z = w.z0 + (w.z1 - w.z0) * u
      // heading: turn gradually at both ends instead of flipping
      const turnBack = smooth(w.len - TURN, w.len + TURN, d) * (1 - smooth(2 * w.len - TURN, 2 * w.len, d))
      const yaw = Math.atan2(-(w.z1 - w.z0), w.x1 - w.x0) + Math.PI * turnBack
      // the walking cycle runs on distance walked (never resets or reverses), about one cycle per 1.4 m
      const cycle = (w.phase + t * w.speed) * 4.5
      o.object.position.set(x, w.y + Math.abs(Math.sin(cycle)) * 0.018, z)
      o.object.rotation.set(0, yaw, 0)
      o.object.scale.setScalar(w.h)
      walk(o, cycle)
    })
  })

  return (
    <group>
      {walkersObj.map((o, i) => (o ? <primitive key={i} object={o.object} /> : null))}
    </group>
  )
}
