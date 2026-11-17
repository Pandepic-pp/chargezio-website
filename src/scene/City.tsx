import { useLayoutEffect, useMemo, useRef } from 'react'
import * as THREE from 'three'
import { MAIN_FAR, MAIN_NEAR } from './cityLayout'
import {
  AVE_Z,
  CROSS_A,
  CROSS_B,
  EXTENT,
  ISLAND_R,
  NEW_PAVE_Y,
  RINGS,
  RING_OUT,
  ROAD_W,
  ROAD_Y,
} from './cityLayout'
import { Lamps, TreeSet, type Item } from './props'
import { useInk } from './ink'
import { makeAsphalt, makePaving } from './textures'

// The new roads: cross roads A and B through the main road, the avenue, two roundabouts, their pavements,
// junction ramps and markings. Everything here sits at ROAD_Y (just above the main road's pavement) so the roads
// read as running across it.

type Seg = { x0: number; z0: number; x1: number; z1: number }
const vertical = (x: number, z0: number, z1: number): Seg => ({ x0: x, z0, x1: x, z1 })
const horizontal = (z: number, x0: number, x1: number): Seg => ({ x0, z0: z, x1, z1: z })

const SEGS: Seg[] = [
  vertical(CROSS_A, -EXTENT - 40, MAIN_FAR),
  vertical(CROSS_A, MAIN_NEAR, AVE_Z - RING_OUT),
  vertical(CROSS_A, AVE_Z + RING_OUT, EXTENT + 40),
  vertical(CROSS_B, -EXTENT - 40, MAIN_FAR),
  vertical(CROSS_B, MAIN_NEAR, AVE_Z - RING_OUT),
  vertical(CROSS_B, AVE_Z + RING_OUT, EXTENT + 40),
  horizontal(AVE_Z, -EXTENT - 60, CROSS_A - RING_OUT),
  horizontal(AVE_Z, CROSS_A + RING_OUT, CROSS_B - RING_OUT),
  horizontal(AVE_Z, CROSS_B + RING_OUT, EXTENT + 60),
]

// Plane whose UVs repeat every `tile` metres
function tiled(w: number, h: number, tile: number) {
  const g = new THREE.PlaneGeometry(w, h)
  const uv = g.attributes.uv
  for (let i = 0; i < uv.count; i++) uv.setXY(i, (uv.getX(i) * w) / tile, (uv.getY(i) * h) / tile)
  return g
}

function circleTiled(r: number, tile: number) {
  const g = new THREE.CircleGeometry(r, 72)
  const uv = g.attributes.uv
  for (let i = 0; i < uv.count; i++) uv.setXY(i, (uv.getX(i) * 2 * r) / tile, (uv.getY(i) * 2 * r) / tile)
  return g
}

function Dashes({ seg }: { seg: Seg }) {
  const horiz = seg.z0 === seg.z1
  const len = Math.abs(horiz ? seg.x1 - seg.x0 : seg.z1 - seg.z0)
  const n = Math.max(1, Math.floor(len / 6))
  const ref = useRef<THREE.InstancedMesh>(null)
  useLayoutEffect(() => {
    const m = ref.current!
    const o = new THREE.Object3D()
    const a = horiz ? Math.min(seg.x0, seg.x1) : Math.min(seg.z0, seg.z1)
    for (let i = 0; i < n; i++) {
      const t = a + 3 + i * 6
      o.position.set(horiz ? t : seg.x0, ROAD_Y + 0.004, horiz ? seg.z0 : t)
      o.rotation.set(-Math.PI / 2, 0, horiz ? 0 : Math.PI / 2)
      o.updateMatrix()
      m.setMatrixAt(i, o.matrix)
    }
    m.instanceMatrix.needsUpdate = true
  }, [horiz, n, seg])
  return (
    <instancedMesh ref={ref} args={[undefined, undefined, n]} frustumCulled={false}>
      <planeGeometry args={[2.6, 0.15]} />
      <meshStandardMaterial color="#ececec" roughness={0.9} polygonOffset polygonOffsetFactor={-3} polygonOffsetUnits={-3} />
    </instancedMesh>
  )
}

function Roadway({ seg, asphalt, paving }: { seg: Seg; asphalt: THREE.Texture; paving: THREE.Texture }) {
  const horiz = seg.z0 === seg.z1
  const len = Math.abs(horiz ? seg.x1 - seg.x0 : seg.z1 - seg.z0)
  const cx = (seg.x0 + seg.x1) / 2
  const cz = (seg.z0 + seg.z1) / 2
  const road = useMemo(() => (horiz ? tiled(len, ROAD_W, 6) : tiled(ROAD_W, len, 6)), [horiz, len])
  const strip = useMemo(() => (horiz ? tiled(len, 7, 3.2) : tiled(7, len, 3.2)), [horiz, len])
  const stripBox = useMemo(() => new THREE.BoxGeometry(horiz ? len : 7, NEW_PAVE_Y - ROAD_Y - 0.04, horiz ? 7 : len), [horiz, len])
  const off = ROAD_W / 2 + 3.5
  const h = NEW_PAVE_Y - ROAD_Y - 0.04
  const sides: [number, number][] = horiz ? [[0, -off], [0, off]] : [[-off, 0], [off, 0]]
  const edge = horiz ? [len, 0.14] : [0.14, len]
  return (
    <group>
      <mesh geometry={road} rotation-x={-Math.PI / 2} position={[cx, ROAD_Y, cz]}>
        <meshStandardMaterial map={asphalt} color="#9a9a9a" roughness={0.96} />
      </mesh>
      {sides.map(([dx, dz], i) => (
        <group key={i}>
          <mesh geometry={stripBox} position={[cx + dx, ROAD_Y + h / 2, cz + dz]}>
            <meshStandardMaterial color="#a9aeb5" roughness={0.9} />
          </mesh>
          <mesh geometry={strip} rotation-x={-Math.PI / 2} position={[cx + dx, NEW_PAVE_Y, cz + dz]}>
            <meshStandardMaterial map={paving} color="#b4b8be" roughness={0.9} />
          </mesh>
          {/* edge line */}
          <mesh rotation-x={-Math.PI / 2} position={[cx + (horiz ? 0 : Math.sign(dx) * (ROAD_W / 2 - 0.4)), ROAD_Y + 0.004, cz + (horiz ? Math.sign(dz) * (ROAD_W / 2 - 0.4) : 0)]}>
            <planeGeometry args={edge as [number, number]} />
            <meshStandardMaterial color="#e6e6e6" roughness={0.9} polygonOffset polygonOffsetFactor={-3} polygonOffsetUnits={-3} />
          </mesh>
        </group>
      ))}
      <Dashes seg={seg} />
    </group>
  )
}

function Roundabout({ x, z, asphalt }: { x: number; z: number; asphalt: THREE.Texture }) {
  const disc = useMemo(() => circleTiled(RING_OUT, 6), [])
  const islandRef = useRef<THREE.Mesh>(null)
  useInk(islandRef, { width: 1.8 })
  const trees: Item[] = useMemo(
    () => [0, 1, 2].map((i) => ({ x: x + Math.cos((i * 2 * Math.PI) / 3 + 0.4) * 3.2, z: z + Math.sin((i * 2 * Math.PI) / 3 + 0.4) * 3.2, y: NEW_PAVE_Y, s: 0.85 })),
    [x, z],
  )
  return (
    <group position={[x, 0, z]}>
      <mesh geometry={disc} rotation-x={-Math.PI / 2} position={[0, ROAD_Y, 0]}>
        <meshStandardMaterial map={asphalt} color="#9a9a9a" roughness={0.96} />
      </mesh>
      <mesh rotation-x={-Math.PI / 2} position={[0, ROAD_Y + 0.004, 0]}>
        <ringGeometry args={[RING_OUT - 0.55, RING_OUT - 0.4, 72]} />
        <meshStandardMaterial color="#e6e6e6" roughness={0.9} polygonOffset polygonOffsetFactor={-3} polygonOffsetUnits={-3} />
      </mesh>
      <mesh rotation-x={-Math.PI / 2} position={[0, ROAD_Y + 0.004, 0]}>
        <ringGeometry args={[ISLAND_R + 0.9, ISLAND_R + 1.02, 72]} />
        <meshStandardMaterial color="#e6e6e6" roughness={0.9} polygonOffset polygonOffsetFactor={-3} polygonOffsetUnits={-3} />
      </mesh>
      {/* island: kerb, grass, trees */}
      <mesh ref={islandRef} position={[0, ROAD_Y + (NEW_PAVE_Y - ROAD_Y) / 2, 0]}>
        <cylinderGeometry args={[ISLAND_R, ISLAND_R, NEW_PAVE_Y - ROAD_Y, 56]} />
        <meshStandardMaterial color="#c9ccd0" roughness={0.85} />
      </mesh>
      <mesh rotation-x={-Math.PI / 2} position={[0, NEW_PAVE_Y + 0.003, 0]}>
        <circleGeometry args={[ISLAND_R - 0.5, 56]} />
        <meshStandardMaterial color="#8fb98a" roughness={1} />
      </mesh>
      <group position={[-x, 0, -z]}>
        <TreeSet items={trees} />
      </group>
    </group>
  )
}

// A short ramp where a cross road meets the main road (the new roads sit slightly higher than it)
function Ramp({ x, z, dir }: { x: number; z: number; dir: 1 | -1 }) {
  const run = 0.5
  const slope = Math.atan2(ROAD_Y, run)
  return (
    <mesh rotation-x={-Math.PI / 2 - dir * slope} position={[x, ROAD_Y / 2 + 0.002, z + (dir * run) / 2]}>
      <planeGeometry args={[ROAD_W, run / Math.cos(slope)]} />
      <meshStandardMaterial color="#555961" roughness={0.95} />
    </mesh>
  )
}

export function City({ high }: { high: boolean }) {
  const asphalt = useMemo(() => makeAsphalt(high ? 512 : 256), [high])
  const paving = useMemo(() => makePaving(512), [])
  const blocks = useMemo(() => tiled(2 * (EXTENT + 220), 300, 3.2), [])

  // lamps along the pavements of the new roads, arms reaching over the road
  const lamps: Item[] = useMemo(() => {
    const out: Item[] = []
    const edge = ROAD_W / 2 + 1.0
    for (const cx of [CROSS_A, CROSS_B]) {
      for (let z = 16; z < AVE_Z - 24; z += 38) {
        out.push({ x: cx - edge, z, y: NEW_PAVE_Y, rot: 0 })
        out.push({ x: cx + edge, z: z + 19, y: NEW_PAVE_Y, rot: Math.PI })
      }
      for (let z = -36; z > -200; z -= 38) {
        out.push({ x: cx - edge, z, y: NEW_PAVE_Y, rot: 0 })
        out.push({ x: cx + edge, z: z - 19, y: NEW_PAVE_Y, rot: Math.PI })
      }
    }
    for (let x = -150; x < 220; x += 38) {
      if (Math.abs(x - CROSS_A) < 26 || Math.abs(x - CROSS_B) < 26) continue
      out.push({ x, z: AVE_Z - edge, y: NEW_PAVE_Y, rot: Math.PI / 2 })
      out.push({ x: x + 19, z: AVE_Z + edge, y: NEW_PAVE_Y, rot: -Math.PI / 2 })
    }
    return out
  }, [])

  // trees on the new pavements
  const trees: Item[] = useMemo(() => {
    const out: Item[] = []
    const edge = ROAD_W / 2 + 5.6
    for (const cx of [CROSS_A, CROSS_B]) {
      for (let z = 24; z < AVE_Z - 24; z += 22) out.push({ x: cx + (z % 2 ? edge : -edge), z, y: NEW_PAVE_Y, s: 0.75 })
      for (let z = -44; z > -190; z -= 26) out.push({ x: cx + edge, z, y: NEW_PAVE_Y, s: 0.8 })
    }
    for (let x = -140; x < 210; x += 26) {
      if (Math.abs(x - CROSS_A) < 24 || Math.abs(x - CROSS_B) < 24) continue
      out.push({ x, z: AVE_Z + edge, y: NEW_PAVE_Y, s: 0.8 })
    }
    return out
  }, [])

  return (
    <group>
      {/* paved city blocks south of the main road's near pavement and north of its far pavement */}
      <mesh geometry={blocks} rotation-x={-Math.PI / 2} position={[0, 0.14, 31.5 + 150]}>
        <meshStandardMaterial map={paving} color="#aeb2b8" roughness={0.9} />
      </mesh>
      <mesh geometry={blocks} rotation-x={-Math.PI / 2} position={[0, 0.14, -58 - 150]}>
        <meshStandardMaterial map={paving} color="#aeb2b8" roughness={0.9} />
      </mesh>

      {SEGS.map((s, i) => (
        <Roadway key={i} seg={s} asphalt={asphalt} paving={paving} />
      ))}
      {RINGS.map((r, i) => (
        <Roundabout key={i} x={r.x} z={r.z} asphalt={asphalt} />
      ))}
      {[CROSS_A, CROSS_B].map((x) => (
        <group key={x}>
          <Ramp x={x} z={MAIN_NEAR} dir={1} />
          <Ramp x={x} z={MAIN_FAR} dir={-1} />
        </group>
      ))}
      <Lamps items={lamps} />
      <TreeSet items={trees} />
    </group>
  )
}
