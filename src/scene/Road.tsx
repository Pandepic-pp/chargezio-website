import { useLayoutEffect, useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js'
import { story } from '../story'
import { KERB_Z, PAVE_Y, STATION, phases } from '../layout'
import { merge } from './math'
import {
  makeArrow,
  makeAsphalt,
  makeConcrete,
  makeDrain,
  makeEvBay,
  makeEvSymbol,
  makeFacade,
  makeManhole,
  makePaintWear,
  makePaving,
  makeRadial,
  makeSign,
  makeStains,
  makeTactile,
  makeZebra,
} from './textures'

// Street layout (z runs from the camera side towards the far side):
//   pavement  z > 1.46 (raised 0.14)   kerb 1.30..1.46   EV bay -1.22..1.22 (car)
//   lane 1   -1.40..-4.60               lane 2 -4.60..-7.80   far kerb -8.0   far pavement
const X0 = -140
const X1 = 200
const LEN = X1 - X0
const CX = (X0 + X1) / 2
export const LANE1_Z = -3.0

const FAR_KERB_Z = -8.0

function Decal({
  map,
  size,
  pos,
  rot = 0,
  opacity = 1,
  color = '#ffffff',
  y = 0.004,
  order = 1,
}: {
  map: THREE.Texture
  size: [number, number]
  pos: [number, number]
  rot?: number
  opacity?: number
  color?: string
  y?: number
  order?: number
}) {
  return (
    <mesh rotation={[-Math.PI / 2, 0, rot]} position={[pos[0], y, pos[1]]} renderOrder={order}>
      <planeGeometry args={size} />
      <meshStandardMaterial
        map={map}
        color={color}
        transparent
        opacity={opacity}
        roughness={0.92}
        depthWrite={false}
        polygonOffset
        polygonOffsetFactor={-2}
        polygonOffsetUnits={-2}
      />
    </mesh>
  )
}

// Zebra crossing: nine bars running along the road, spaced across it.
function Zebra({ map }: { map: THREE.Texture }) {
  const ref = useRef<THREE.InstancedMesh>(null)
  const n = 9
  useLayoutEffect(() => {
    const m = ref.current!
    const d = new THREE.Object3D()
    d.rotation.x = -Math.PI / 2
    for (let i = 0; i < n; i++) {
      d.position.set(18, 0.0042, -7.3 + i * 0.98)
      d.updateMatrix()
      m.setMatrixAt(i, d.matrix)
    }
    m.instanceMatrix.needsUpdate = true
  }, [])
  return (
    <instancedMesh ref={ref} args={[undefined, undefined, n]} frustumCulled={false} renderOrder={1}>
      <planeGeometry args={[3.2, 0.5]} />
      <meshStandardMaterial map={map} transparent roughness={0.9} depthWrite={false} polygonOffset polygonOffsetFactor={-2} polygonOffsetUnits={-2} />
    </instancedMesh>
  )
}

function Dashes({ wear }: { wear: THREE.Texture }) {
  const ref = useRef<THREE.InstancedMesh>(null)
  const n = 40
  useLayoutEffect(() => {
    const m = ref.current!
    const d = new THREE.Object3D()
    d.rotation.x = -Math.PI / 2
    for (let i = 0; i < n; i++) {
      d.position.set(X0 + 3 + i * 9, 0.004, -4.6)
      d.updateMatrix()
      m.setMatrixAt(i, d.matrix)
    }
    m.instanceMatrix.needsUpdate = true
  }, [])
  return (
    <instancedMesh ref={ref} args={[undefined, undefined, n]} frustumCulled={false} renderOrder={1}>
      <planeGeometry args={[3, 0.15]} />
      <meshStandardMaterial map={wear} transparent roughness={0.9} depthWrite={false} polygonOffset polygonOffsetFactor={-2} polygonOffsetUnits={-2} />
    </instancedMesh>
  )
}

// Street furniture: lamp posts, bollards, trees and buildings. Repeated parts are instanced.
function useInstances(count: number, place: (i: number, o: THREE.Object3D, c: THREE.Color) => void) {
  const ref = useRef<THREE.InstancedMesh>(null)
  useLayoutEffect(() => {
    const m = ref.current!
    const o = new THREE.Object3D()
    const c = new THREE.Color()
    for (let i = 0; i < count; i++) {
      o.position.set(0, 0, 0)
      o.rotation.set(0, 0, 0)
      o.scale.set(1, 1, 1)
      place(i, o, c)
      o.updateMatrix()
      m.setMatrixAt(i, o.matrix)
      m.setColorAt(i, c)
    }
    m.instanceMatrix.needsUpdate = true
    if (m.instanceColor) m.instanceColor.needsUpdate = true
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])
  return ref
}

function seeded(seed: number) {
  let s = seed >>> 0
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0
    return s / 4294967296
  }
}

function LampPosts() {
  const geo = useMemo(() => {
    const pole = new THREE.CylinderGeometry(0.045, 0.07, 6.4, 10)
    pole.translate(0, 3.2, 0)
    const arm = new RoundedBoxGeometry(1.5, 0.07, 0.09, 2, 0.03)
    arm.translate(0.65, 6.35, 0)
    const head = new RoundedBoxGeometry(0.65, 0.1, 0.28, 2, 0.04)
    head.translate(1.25, 6.28, 0)
    const base = new THREE.CylinderGeometry(0.11, 0.13, 0.5, 10)
    base.translate(0, 0.25, 0)
    return merge([pole, arm, head, base])
  }, [])
  // on the far pavement, so they frame the street without standing between the camera and the car
  const xs = [-60, -36, -13, 13, 38, 62, 86]
  const ref = useInstances(xs.length, (i, o) => {
    o.position.set(xs[i], PAVE_Y, FAR_KERB_Z - 0.9)
    o.rotation.y = -Math.PI / 2 // arm reaches over the road
  })
  return (
    <instancedMesh ref={ref} args={[geo, undefined, xs.length]} frustumCulled={false}>
      <meshStandardMaterial color="#59616c" roughness={0.55} metalness={0.5} />
    </instancedMesh>
  )
}

function Trees() {
  const geo = useMemo(() => {
    const trunk = new THREE.CylinderGeometry(0.12, 0.2, 2.6, 8)
    trunk.translate(0, 1.3, 0)
    const colorize = (g: THREE.BufferGeometry, hex: number) => {
      const c = new THREE.Color(hex)
      const a = new Float32Array(g.attributes.position.count * 3)
      for (let i = 0; i < a.length; i += 3) {
        a[i] = c.r
        a[i + 1] = c.g
        a[i + 2] = c.b
      }
      g.setAttribute('color', new THREE.BufferAttribute(a, 3))
      return g
    }
    const parts: THREE.BufferGeometry[] = [colorize(trunk.toNonIndexed(), 0x6b5848)]
    const blobs: [number, number, number, number, number][] = [
      [0, 4.3, 0, 1.7, 0x9cc6a4],
      [0.9, 3.5, 0.3, 1.2, 0x8fbc9a],
      [-0.9, 3.6, -0.3, 1.25, 0xa7cfb0],
      [0.1, 5.2, 0.1, 1.15, 0xb0d5b8],
    ]
    for (const [x, y, z, r, c] of blobs) {
      const s = new THREE.IcosahedronGeometry(r, 1).toNonIndexed()
      s.translate(x, y, z)
      parts.push(colorize(s, c))
    }
    return merge(parts)
  }, [])
  const rand = useMemo(() => seeded(7), [])
  // none in the middle of the hero shot, so the car and the headline stay clean
  const xs = useMemo(
    () => Array.from({ length: 22 }, (_, i) => X0 + 14 + i * 14 + rand() * 3).filter((x) => x < -22 || x > 16),
    [rand],
  )
  const ref = useInstances(xs.length, (i, o) => {
    const s = 0.7 + rand() * 0.35
    o.position.set(xs[i] + 5, PAVE_Y, FAR_KERB_Z - 2.6)
    o.scale.setScalar(s)
    o.rotation.y = rand() * 6
  })
  return (
    <instancedMesh ref={ref} args={[geo, undefined, xs.length]} frustumCulled={false}>
      <meshStandardMaterial vertexColors roughness={0.9} />
    </instancedMesh>
  )
}

function Buildings() {
  const facade = useMemo(() => makeFacade(5), [])
  const rand = useMemo(() => seeded(19), [])
  const n = 36
  const tints = ['#f3f6fb', '#eef1f7', '#f7efe6', '#e8eef5', '#f1f4ee', '#fbf3f3']
  const ref = useInstances(n, (i, o, c) => {
    const row = i % 2
    const w = 12 + rand() * 9
    const h = 14 + rand() * 22
    o.position.set(X0 + 6 + (i >> 1) * 20 + rand() * 4, h / 2, row === 0 ? -36 - rand() * 4 : -64 - rand() * 8)
    o.scale.set(w, h, 12 + rand() * 4)
    c.set(tints[Math.floor(rand() * tints.length)])
  })
  return (
    <instancedMesh ref={ref} args={[undefined, undefined, n]} frustumCulled={false}>
      <boxGeometry args={[1, 1, 1]} />
      <meshStandardMaterial map={facade} roughness={0.85} />
    </instancedMesh>
  )
}

function Bollards() {
  const geo = useMemo(() => {
    const body = new THREE.CylinderGeometry(0.07, 0.07, 0.85, 14)
    body.translate(0, 0.425, 0)
    const cap = new THREE.SphereGeometry(0.07, 14, 8, 0, Math.PI * 2, 0, Math.PI / 2)
    cap.translate(0, 0.85, 0)
    return merge([body, cap])
  }, [])
  const bands = useMemo(() => {
    const g = new THREE.CylinderGeometry(0.0725, 0.0725, 0.1, 14, 1, true)
    g.translate(0, 0.62, 0)
    return g
  }, [])
  const pts: [number, number][] = [
    [-5.5, 2.3],
    [-6.5, 2.3],
  ]
  const a = useInstances(pts.length, (i, o) => o.position.set(pts[i][0], PAVE_Y, pts[i][1]))
  const b = useInstances(pts.length, (i, o) => o.position.set(pts[i][0], PAVE_Y, pts[i][1]))
  return (
    <>
      <instancedMesh ref={a} args={[geo, undefined, pts.length]} frustumCulled={false}>
        <meshStandardMaterial color="#f1c40f" roughness={0.45} />
      </instancedMesh>
      <instancedMesh ref={b} args={[bands, undefined, pts.length]} frustumCulled={false}>
        <meshStandardMaterial color="#1b1d22" roughness={0.5} side={THREE.DoubleSide} />
      </instancedMesh>
    </>
  )
}

function Sign() {
  const tex = useMemo(makeSign, [])
  return (
    <group position={[-7.4, PAVE_Y, 2.9]}>
      <mesh position={[0, 1.2, 0]}>
        <cylinderGeometry args={[0.03, 0.03, 2.4, 10]} />
        <meshStandardMaterial color="#6b727c" metalness={0.6} roughness={0.4} />
      </mesh>
      <mesh position={[0, 2.0, 0.035]}>
        <planeGeometry args={[0.62, 0.93]} />
        <meshStandardMaterial map={tex} roughness={0.4} />
      </mesh>
      <mesh position={[0, 2.0, 0.0]}>
        <boxGeometry args={[0.64, 0.95, 0.04]} />
        <meshStandardMaterial color="#b9bfc8" metalness={0.5} roughness={0.5} />
      </mesh>
    </group>
  )
}

function Furniture() {
  const bin = useMemo(() => {
    const body = new THREE.CylinderGeometry(0.28, 0.25, 0.95, 18)
    body.translate(0, 0.475, 0)
    const lid = new THREE.CylinderGeometry(0.3, 0.3, 0.06, 18)
    lid.translate(0, 0.98, 0)
    return merge([body, lid])
  }, [])
  const bench = useMemo(() => {
    const seat = new RoundedBoxGeometry(1.7, 0.06, 0.5, 2, 0.02)
    seat.translate(0, 0.46, 0)
    const back = new RoundedBoxGeometry(1.7, 0.4, 0.05, 2, 0.02)
    back.translate(0, 0.78, -0.22)
    const l1 = new RoundedBoxGeometry(0.06, 0.46, 0.46, 2, 0.02)
    l1.translate(-0.72, 0.23, 0)
    const l2 = l1.clone().translate(1.44, 0, 0)
    return merge([seat, back, l1, l2])
  }, [])
  return (
    <>
      <mesh geometry={bin} position={[24, PAVE_Y, FAR_KERB_Z - 1.0]}>
        <meshStandardMaterial color="#6fa58a" roughness={0.6} />
      </mesh>
      <mesh geometry={bench} position={[30, PAVE_Y, FAR_KERB_Z - 1.2]}>
        <meshStandardMaterial color="#a38669" roughness={0.7} />
      </mesh>
    </>
  )
}

export function Road({ high }: { high: boolean }) {
  const asphalt = useMemo(() => {
    const t = makeAsphalt(high ? 1024 : 512)
    t.repeat.set(LEN / 6, 9.8 / 6)
    return t
  }, [high])
  const paving = useMemo(() => {
    const t = makePaving(high ? 1024 : 512)
    t.repeat.set(LEN / 3.2, 40 / 3.2)
    return t
  }, [high])
  const farPaving = useMemo(() => {
    const t = makePaving(512)
    t.repeat.set(LEN / 3.2, 50 / 3.2)
    return t
  }, [])
  const concrete = useMemo(() => {
    const t = makeConcrete(256)
    t.repeat.set(LEN / 2, 1)
    return t
  }, [])
  const evBay = useMemo(makeEvBay, [])
  const evSym = useMemo(makeEvSymbol, [])
  const zebra = useMemo(makeZebra, [])
  const arrow = useMemo(makeArrow, [])
  const manhole = useMemo(makeManhole, [])
  const drain = useMemo(makeDrain, [])
  const oil = useMemo(() => makeStains(256, 256, 3, 'oil'), [])
  const grime = useMemo(() => makeStains(256, 256, 17, 'oil'), [])
  const tactile = useMemo(makeTactile, [])
  const crack1 = useMemo(() => makeStains(512, 64, 11, 'cracks'), [])
  const crack2 = useMemo(() => makeStains(512, 64, 23, 'cracks'), [])
  const patch = useMemo(() => makeStains(256, 160, 5, 'patch'), [])
  const edgeWear = useMemo(() => {
    const t = makePaintWear(512, 32, '#f1f3f6', 31)
    t.repeat.set(LEN / 6, 1)
    return t
  }, [])
  const dashWear = useMemo(() => makePaintWear(256, 32, '#f1f3f6', 41), [])
  const gutter = useMemo(() => {
    const c = document.createElement('canvas')
    c.width = 4
    c.height = 64
    const g = c.getContext('2d')!
    const gr = g.createLinearGradient(0, 0, 0, 64)
    gr.addColorStop(0, 'rgba(30,34,40,0.0)')
    gr.addColorStop(0.55, 'rgba(30,34,40,0.35)')
    gr.addColorStop(1, 'rgba(30,34,40,0.6)')
    g.fillStyle = gr
    g.fillRect(0, 0, 4, 64)
    const t = new THREE.CanvasTexture(c)
    t.colorSpace = THREE.SRGBColorSpace
    return t
  }, [])
  const track = useMemo(() => {
    const c = document.createElement('canvas')
    c.width = 4
    c.height = 64
    const g = c.getContext('2d')!
    const gr = g.createLinearGradient(0, 0, 0, 64)
    gr.addColorStop(0, 'rgba(40,44,52,0)')
    gr.addColorStop(0.5, 'rgba(40,44,52,0.32)')
    gr.addColorStop(1, 'rgba(40,44,52,0)')
    g.fillStyle = gr
    g.fillRect(0, 0, 4, 64)
    const t = new THREE.CanvasTexture(c)
    t.colorSpace = THREE.SRGBColorSpace
    return t
  }, [])
  const shadow = useMemo(() => makeRadial('rgba(18,26,40,0.5)', 'rgba(18,26,40,0)'), [])
  const stationShadow = useRef<THREE.MeshBasicMaterial>(null)

  useFrame(() => {
    if (stationShadow.current) stationShadow.current.opacity = 0.75 * phases(story.smooth).rise
  })

  return (
    <>
      {/* asphalt */}
      <mesh rotation-x={-Math.PI / 2} position={[CX, 0, (1.3 + FAR_KERB_Z) / 2]}>
        <planeGeometry args={[LEN, 1.3 - FAR_KERB_Z]} />
        <meshStandardMaterial map={asphalt} bumpMap={asphalt} bumpScale={high ? 1.4 : 0} roughness={0.96} />
      </mesh>
      {/* pavements */}
      <mesh rotation-x={-Math.PI / 2} position={[CX, PAVE_Y, 1.46 + 20]}>
        <planeGeometry args={[LEN, 40]} />
        <meshStandardMaterial map={paving} roughness={0.9} />
      </mesh>
      <mesh rotation-x={-Math.PI / 2} position={[CX, PAVE_Y, FAR_KERB_Z - 0.16 - 25]}>
        <planeGeometry args={[LEN, 50]} />
        <meshStandardMaterial map={farPaving} roughness={0.9} />
      </mesh>
      {/* kerbs */}
      <mesh position={[CX, PAVE_Y / 2, KERB_Z + 0.08]}>
        <boxGeometry args={[LEN, PAVE_Y, 0.16]} />
        <meshStandardMaterial map={concrete} roughness={0.85} />
      </mesh>
      <mesh position={[CX, PAVE_Y / 2, FAR_KERB_Z - 0.08]}>
        <boxGeometry args={[LEN, PAVE_Y, 0.16]} />
        <meshStandardMaterial map={concrete} roughness={0.85} />
      </mesh>
      {/* painted kerb stones along the EV bay */}
      <mesh position={[0, PAVE_Y + 0.001, KERB_Z + 0.08]}>
        <boxGeometry args={[6.5, PAVE_Y, 0.165]} />
        <meshStandardMaterial color="#e9e6dc" roughness={0.7} />
      </mesh>

      {/* gutter dirt and tyre tracks */}
      <Decal map={gutter} size={[LEN, 0.55]} pos={[CX, KERB_Z - 0.275]} y={0.0025} />
      <Decal map={track} size={[LEN, 0.55]} pos={[CX, LANE1_Z - 0.745]} y={0.0028} />
      <Decal map={track} size={[LEN, 0.55]} pos={[CX, LANE1_Z + 0.745]} y={0.0028} />
      <Decal map={track} size={[LEN, 0.55]} pos={[CX, -6.2 - 0.745]} y={0.0028} />
      <Decal map={track} size={[LEN, 0.55]} pos={[CX, -6.2 + 0.745]} y={0.0028} />

      {/* EV bay */}
      <Decal map={evBay} size={[6.6, 2.54]} pos={[0, 0]} y={0.0035} />
      <Decal map={evSym} size={[0.8, 0.8]} pos={[2.95, -0.2]} rot={-Math.PI / 2} y={0.0045} />
      <Decal map={evSym} size={[0.8, 0.8]} pos={[-2.95, -0.2]} rot={Math.PI / 2} y={0.0045} />

      {/* lane lines and dashes */}
      <Decal map={edgeWear} size={[LEN, 0.15]} pos={[CX, -1.4]} />
      <Decal map={edgeWear} size={[LEN, 0.15]} pos={[CX, -7.8]} />
      <Dashes wear={dashWear} />

      {/* crossing, stop line, arrows */}
      <Zebra map={zebra} />
      <Decal map={arrow} size={[0.9, 1.9]} pos={[9.5, LANE1_Z]} rot={-Math.PI / 2} y={0.0042} />
      <Decal map={edgeWear} size={[0.45, 3.2]} pos={[15.6, LANE1_Z]} y={0.0042} />
      <Decal map={arrow} size={[0.9, 1.9]} pos={[-12, LANE1_Z]} rot={-Math.PI / 2} y={0.0042} />

      {/* wear: patches, cracks, stains, covers */}
      <Decal map={patch} size={[2.6, 1.6]} pos={[12.5, -6.2]} y={0.003} />
      <Decal map={patch} size={[1.8, 1.1]} pos={[-9.5, -3.6]} rot={0.04} y={0.003} />
      <Decal map={crack1} size={[6, 0.75]} pos={[-7.5, -2.4]} rot={0.2} y={0.0034} />
      <Decal map={crack2} size={[5, 0.62]} pos={[6.5, -5.6]} rot={-0.15} y={0.0034} />
      <Decal map={crack1} size={[7, 0.8]} pos={[24, -2.0]} rot={0.1} y={0.0034} />
      <Decal map={oil} size={[2.4, 1.6]} pos={[-0.4, 0.1]} y={0.0046} opacity={0.9} />
      <Decal map={oil} size={[1.6, 1.2]} pos={[3.6, -0.5]} y={0.0046} opacity={0.6} />
      <Decal map={manhole} size={[0.78, 0.78]} pos={[6.8, -3.3]} y={0.0045} />
      <Decal map={manhole} size={[0.78, 0.78]} pos={[-15, -3.0]} y={0.0045} />
      <Decal map={drain} size={[0.9, 0.45]} pos={[-6.4, 1.08]} y={0.0045} />
      <Decal map={drain} size={[0.9, 0.45]} pos={[10.2, 1.08]} y={0.0045} />

      {/* pavement: grime, a service cover and tactile paving at the crossing */}
      <Decal map={grime} size={[3.4, 2.4]} pos={[-1.2, 3.4]} y={PAVE_Y + 0.003} opacity={0.5} />
      <Decal map={grime} size={[4.2, 2.6]} pos={[6.5, 4.8]} y={PAVE_Y + 0.003} opacity={0.4} rot={1.1} />
      <Decal map={grime} size={[3.0, 2.0]} pos={[-7.5, 5.0]} y={PAVE_Y + 0.003} opacity={0.45} rot={2.2} />
      <Decal map={drain} size={[1.1, 0.55]} pos={[1.8, 3.6]} y={PAVE_Y + 0.004} opacity={0.9} rot={0.03} />
      <Decal map={tactile} size={[4.4, 0.5]} pos={[18.2, 1.72]} y={PAVE_Y + 0.004} />
      <Decal map={tactile} size={[4.4, 0.5]} pos={[18.2, -8.32]} y={PAVE_Y + 0.004} rot={0} />

      {/* contact shadow under the charger and street furniture */}
      <mesh rotation-x={-Math.PI / 2} position={[STATION.x + 0.08, PAVE_Y + 0.003, STATION.z + 0.05]} renderOrder={1}>
        <planeGeometry args={[1.6, 1.2]} />
        <meshBasicMaterial ref={stationShadow} map={shadow} transparent opacity={0} depthWrite={false} toneMapped={false} />
      </mesh>

      <LampPosts />
      <Trees />
      <Buildings />
      <Bollards />
      <Sign />
      <Furniture />
    </>
  )
}
