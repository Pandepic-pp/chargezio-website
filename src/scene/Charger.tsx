import { useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { smooth, story } from '../story'
import { CABLE_OUT_LOCAL, KERB_Z, PAVE_Y, STATION, connectorPose, phases, riseOffset } from '../layout'
import {
  CABLE_ANCHOR,
  SD,
  buildCabinet,
  buildConnectorBody,
  buildConnectorBoot,
  buildConnectorLever,
  buildConnectorMetal,
  buildConnectorRing,
  buildConnectorShoulder,
  buildStationDetails,
  buildStationLeds,
} from './chargerParts'
import { makeChargerLabel, makeHatch, makePulse, makeRadial, makeScreen, type ScreenState } from './textures'

const GREEN = '#05C158'
const CABLE_R = 0.03

// A cable whose vertices are rewritten every frame (no new geometry, no garbage). It rests on the
// ground and the kerb instead of hanging through them.
function makeCable(N: number) {
  const R = 8
  const g = new THREE.BufferGeometry()
  const pos = new Float32Array((N + 1) * (R + 1) * 3)
  const nor = new Float32Array((N + 1) * (R + 1) * 3)
  const uv = new Float32Array((N + 1) * (R + 1) * 2)
  for (let i = 0; i <= N; i++) {
    for (let j = 0; j <= R; j++) {
      const k = (i * (R + 1) + j) * 2
      uv[k] = (i / N) * 10
      uv[k + 1] = j / R
    }
  }
  const idx: number[] = []
  for (let i = 0; i < N; i++) {
    for (let j = 0; j < R; j++) {
      const a = i * (R + 1) + j
      const b = (i + 1) * (R + 1) + j
      idx.push(a, b, a + 1, b, b + 1, a + 1)
    }
  }
  g.setAttribute('position', new THREE.BufferAttribute(pos, 3))
  g.setAttribute('normal', new THREE.BufferAttribute(nor, 3))
  g.setAttribute('uv', new THREE.BufferAttribute(uv, 2))
  g.setIndex(idx)

  const p0 = new THREE.Vector3()
  const p1 = new THREE.Vector3()
  const p2 = new THREE.Vector3()
  const p3 = new THREE.Vector3()
  const pts = Array.from({ length: N + 1 }, () => new THREE.Vector3())
  const tan = new THREE.Vector3()
  const nrm = new THREE.Vector3()
  const bin = new THREE.Vector3()
  const up = new THREE.Vector3(0, 1, 0)
  const side = new THREE.Vector3(1, 0, 0)

  const groundAt = (z: number) => (z > KERB_Z ? PAVE_Y : 0) + CABLE_R

  function update(from: THREE.Vector3, outDir: THREE.Vector3, to: THREE.Vector3, inDir: THREE.Vector3) {
    p0.copy(from)
    p3.copy(to)
    const chord = p0.distanceTo(p3)
    const lead = 0.3 + 0.22 * chord
    const sag = 0.25 + 0.16 * chord
    p1.copy(p0).addScaledVector(outDir, lead)
    p1.y -= sag
    p2.copy(p3).addScaledVector(inDir, lead)
    p2.y -= sag
    for (let i = 0; i <= N; i++) {
      const t = i / N
      const u = 1 - t
      pts[i]
        .set(0, 0, 0)
        .addScaledVector(p0, u * u * u)
        .addScaledVector(p1, 3 * u * u * t)
        .addScaledVector(p2, 3 * u * t * t)
        .addScaledVector(p3, t * t * t)
    }
    // smooth the heights a little, then rest the cable on the ground
    for (let pass = 0; pass < 2; pass++) {
      for (let i = 1; i < N; i++) pts[i].y = pts[i].y * 0.5 + (pts[i - 1].y + pts[i + 1].y) * 0.25
    }
    for (let i = 1; i < N; i++) pts[i].y = Math.max(pts[i].y, groundAt(pts[i].z))
    for (let i = 0; i <= N; i++) {
      const a = pts[Math.max(0, i - 1)]
      const b = pts[Math.min(N, i + 1)]
      tan.subVectors(b, a).normalize()
      const ref = Math.abs(tan.dot(up)) > 0.95 ? side : up
      nrm.crossVectors(ref, tan).normalize()
      bin.crossVectors(tan, nrm)
      for (let j = 0; j <= R; j++) {
        const ang = (j / R) * Math.PI * 2
        const cx = Math.cos(ang)
        const sy = Math.sin(ang)
        const k = (i * (R + 1) + j) * 3
        const nx = nrm.x * cx + bin.x * sy
        const ny = nrm.y * cx + bin.y * sy
        const nz = nrm.z * cx + bin.z * sy
        nor[k] = nx
        nor[k + 1] = ny
        nor[k + 2] = nz
        pos[k] = pts[i].x + nx * CABLE_R
        pos[k + 1] = pts[i].y + ny * CABLE_R
        pos[k + 2] = pts[i].z + nz * CABLE_R
      }
    }
    g.attributes.position.needsUpdate = true
    g.attributes.normal.needsUpdate = true
  }

  return { geo: g, update }
}

export function Charger({ high }: { high: boolean }) {
  const station = useRef<THREE.Group>(null)
  const conn = useRef<THREE.Group>(null)
  const cableMesh = useRef<THREE.Mesh>(null)
  const ledMat = useRef<THREE.MeshBasicMaterial>(null)
  const ringMat = useRef<THREE.MeshStandardMaterial>(null)
  const cableMat = useRef<THREE.MeshStandardMaterial>(null)
  const hatchMat = useRef<THREE.MeshBasicMaterial>(null)
  const riseGlow = useRef<THREE.MeshBasicMaterial>(null)
  const time = useRef(0)

  const geo = useMemo(
    () => ({
      cabinet: buildCabinet(),
      details: buildStationDetails(),
      leds: buildStationLeds(),
      body: buildConnectorBody(),
      shoulder: buildConnectorShoulder(),
      metal: buildConnectorMetal(),
      lever: buildConnectorLever(),
      boot: buildConnectorBoot(),
      ring: buildConnectorRing(),
    }),
    [],
  )
  const cable = useMemo(() => makeCable(high ? 56 : 36), [high])
  const pulse = useMemo(makePulse, [])
  const screen = useMemo(makeScreen, [])
  const label = useMemo(makeChargerLabel, [])
  const hatch = useMemo(makeHatch, [])
  const glowTex = useMemo(() => makeRadial('rgba(5,193,88,0.85)', 'rgba(5,193,88,0)'), [])

  const tmp = useMemo(
    () => ({
      pos: new THREE.Vector3(),
      quat: new THREE.Quaternion(),
      from: new THREE.Vector3(),
      end: new THREE.Vector3(),
      outDir: new THREE.Vector3(1, 0.02, 0.18).normalize(),
      inDir: new THREE.Vector3(),
      boot: new THREE.Vector3(0, -Math.sin(0.2), Math.cos(0.2)),
      color: new THREE.Color(),
      state: { mode: 'idle', pct: 24, kw: 0, mins: 0, cost: 0 } as ScreenState,
    }),
    [],
  )

  useFrame((_, delta) => {
    const dt = Math.min(delta, 0.1)
    time.current += dt
    const t = time.current
    const p = story.smooth
    const ph = phases(p)
    const sy = riseOffset(p)

    if (station.current) station.current.position.set(STATION.x, STATION.y + sy, STATION.z)

    // connector and cable stay hidden until the charger is above the paving
    const above = ph.rise > 0.45
    if (cableMesh.current) cableMesh.current.visible = above
    if (conn.current) conn.current.visible = above

    // connector and cable
    const c = conn.current
    if (c && above) {
      connectorPose(p, tmp.pos, tmp.quat)
      c.position.copy(tmp.pos)
      c.quaternion.copy(tmp.quat)
      c.updateMatrixWorld()
      tmp.end.copy(CABLE_ANCHOR).applyMatrix4(c.matrixWorld)
      tmp.inDir.copy(tmp.boot).applyQuaternion(tmp.quat)
      tmp.from.copy(STATION).add(CABLE_OUT_LOCAL)
      tmp.from.y += sy
      cable.update(tmp.from, tmp.outDir, tmp.end, tmp.inDir)
    }

    // charge state drives the screen, the light strips, the connector ring and the cable pulses
    const cc = smooth(0.38, 0.58, p)
    const s = tmp.state
    s.mode = p < 0.29 ? 'idle' : p < 0.37 ? 'connect' : p < 0.62 ? 'charge' : p < 0.74 ? 'done' : 'idle'
    s.pct = 24 + cc * 41
    s.kw = cc <= 0.001 || cc >= 0.999 ? 0 : 76 * (0.55 + 0.45 * Math.sin(cc * Math.PI))
    s.mins = cc * 48
    s.cost = cc * 166.75
    screen.draw(s, 0.5 + 0.5 * Math.sin(t * 2.4))

    if (ledMat.current) {
      const col = s.mode === 'idle' ? '#3b82f6' : s.mode === 'connect' ? '#ffb020' : GREEN
      tmp.color.set(col)
      const breathe = s.mode === 'charge' ? 0.7 + 0.3 * Math.sin(t * 4) : s.mode === 'idle' ? 0.6 + 0.4 * Math.sin(t * 2.4) : 1
      ledMat.current.color.copy(tmp.color).multiplyScalar(breathe)
    }
    if (ringMat.current) ringMat.current.emissiveIntensity = 0.3 + ph.g * (1.7 + 0.5 * Math.sin(t * 5))
    if (cableMat.current) cableMat.current.emissiveIntensity = 1.5 * ph.g
    pulse.offset.x -= dt * 1.1 * ph.g

    // faint outline of the hatch the charger rises through, glowing while it moves
    const moving = Math.sin(ph.rise * Math.PI)
    if (hatchMat.current) hatchMat.current.opacity = 0.18 * (1 - ph.rise) + 0.0
    if (riseGlow.current) riseGlow.current.opacity = 0.9 * moving
  })

  const white = <meshPhysicalMaterial color="#f3f5f6" roughness={0.34} clearcoat={0.5} clearcoatRoughness={0.2} />
  const black = <meshPhysicalMaterial color="#121418" roughness={0.38} clearcoat={0.4} />

  return (
    <>
      {/* hatch outline and the glow while the charger rises */}
      <mesh rotation-x={-Math.PI / 2} position={[STATION.x, PAVE_Y + 0.004, STATION.z]} renderOrder={1}>
        <planeGeometry args={[1.0, 0.76]} />
        <meshBasicMaterial ref={hatchMat} map={hatch} transparent opacity={0.18} depthWrite={false} toneMapped={false} />
      </mesh>
      <mesh rotation-x={-Math.PI / 2} position={[STATION.x, PAVE_Y + 0.006, STATION.z]} renderOrder={2}>
        <planeGeometry args={[2.4, 1.9]} />
        <meshBasicMaterial ref={riseGlow} map={glowTex} transparent opacity={0} depthWrite={false} blending={THREE.AdditiveBlending} toneMapped={false} />
      </mesh>

      <group ref={station}>
        <mesh geometry={geo.cabinet}>{white}</mesh>
        <mesh geometry={geo.details}>
          <meshStandardMaterial vertexColors roughness={0.5} metalness={0.2} />
        </mesh>
        <mesh geometry={geo.leds}>
          <meshBasicMaterial ref={ledMat} color="#3b82f6" toneMapped={false} />
        </mesh>
        <mesh position={[0, 1.38, SD / 2 + 0.0175]}>
          <planeGeometry args={[0.42, 0.56]} />
          <meshBasicMaterial map={screen.texture} toneMapped={false} />
        </mesh>
        <mesh position={[0, 0.69, SD / 2 + 0.0025]}>
          <planeGeometry args={[0.46, 0.23]} />
          <meshStandardMaterial map={label} roughness={0.5} />
        </mesh>
      </group>

      {/* connector and cable live in world space so the car can drive away */}
      <group ref={conn}>
        <mesh geometry={geo.body}>{black}</mesh>
        <mesh geometry={geo.shoulder}>
          <meshStandardMaterial color="#6d747e" roughness={0.45} metalness={0.5} />
        </mesh>
        <mesh geometry={geo.metal}>
          <meshStandardMaterial color="#c7ccd3" roughness={0.3} metalness={1} />
        </mesh>
        <mesh geometry={geo.lever}>
          <meshStandardMaterial color={GREEN} roughness={0.4} />
        </mesh>
        <mesh geometry={geo.boot}>
          <meshStandardMaterial color="#0f1013" roughness={0.75} />
        </mesh>
        <mesh geometry={geo.ring}>
          <meshStandardMaterial ref={ringMat} color="#0b0d10" emissive={GREEN} emissiveIntensity={0.3} />
        </mesh>
      </group>
      <mesh ref={cableMesh} geometry={cable.geo} frustumCulled={false}>
        <meshStandardMaterial
          ref={cableMat}
          color="#15181d"
          roughness={0.55}
          emissive={GREEN}
          emissiveMap={pulse}
          emissiveIntensity={0}
          side={THREE.DoubleSide}
        />
      </mesh>
    </>
  )
}
