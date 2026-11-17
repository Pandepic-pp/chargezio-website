import { useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js'
import { KERB_Z, PAVE_Y, STATION } from '../layout'
import { story } from '../story'
import { useInk } from './ink'
import { makeStationSign } from './textures'

// The Chargezio charging station the car pulls into: dropped kerb, its own paving, a canopy over the charger,
// a branded totem and bay markings (the bay itself is drawn in Road.tsx). The bay is x = 0, z = 0, the charger stands
// under the canopy on the pavement side.
export const STATION_HALF = 6.4 // half length of the dropped kerb / forecourt along x
const ROOF_Y = 3.9

export function Station() {
  const sign = useMemo(() => makeStationSign(2048, 256, true, (STATION_HALF * 2 + 0.4) / 0.46), [])
  const totemSign = useMemo(() => makeStationSign(512, 640, false), [])
  const roofGeo = useMemo(() => new RoundedBoxGeometry(STATION_HALF * 2 + 0.6, 0.2, 2.9, 3, 0.06), [])
  const fasciaGeo = useMemo(() => new RoundedBoxGeometry(STATION_HALF * 2 + 0.6, 0.5, 0.16, 3, 0.05), [])
  const colGeo = useMemo(() => new THREE.CylinderGeometry(0.09, 0.11, ROOF_Y, 14), [])
  const totemGeo = useMemo(() => new RoundedBoxGeometry(1.0, 4.0, 0.36, 3, 0.05), [])
  const roofRef = useRef<THREE.Mesh>(null)
  const fasciaRef = useRef<THREE.Mesh>(null)
  const totemRef = useRef<THREE.Mesh>(null)
  const col1 = useRef<THREE.Mesh>(null)
  const col2 = useRef<THREE.Mesh>(null)
  const col3 = useRef<THREE.Mesh>(null)
  const col4 = useRef<THREE.Mesh>(null)
  useInk(roofRef, { width: 2 })
  useInk(fasciaRef, { width: 2 })
  useInk(totemRef, { width: 2 })
  useInk(col1, { width: 1.6 })
  useInk(col2, { width: 1.6 })
  useInk(col3, { width: 1.6 })
  useInk(col4, { width: 1.6 })

  // night: the canopy's light strips come on and light the bay and the charger
  const stripMat = useMemo(() => new THREE.MeshBasicMaterial({ color: '#aab2b4', toneMapped: false }), [])
  const signMat = useRef<THREE.MeshBasicMaterial>(null)
  const pA = useRef<THREE.PointLight>(null)
  const pB = useRef<THREE.PointLight>(null)
  const pC = useRef<THREE.PointLight>(null)
  const dim = useMemo(() => new THREE.Color('#aab2b4'), [])
  const lit = useMemo(() => new THREE.Color('#f6fff9'), [])
  const signDay = useMemo(() => new THREE.Color('#d9dcdc'), [])
  const signNight = useMemo(() => new THREE.Color('#ffffff'), [])
  useFrame(() => {
    const n = story.night
    stripMat.color.lerpColors(dim, lit, n)
    if (signMat.current) signMat.current.color.lerpColors(signDay, signNight, n)
    if (pA.current) pA.current.intensity = 55 * n
    if (pB.current) pB.current.intensity = 55 * n
    if (pC.current) pC.current.intensity = 7 * n
  })

  const slope = Math.atan2(PAVE_Y, 0.42)
  const frontZ = 4.4
  const cols: [React.RefObject<THREE.Mesh | null>, number, number][] = [
    [col1, -STATION_HALF + 0.5, 1.9],
    [col2, STATION_HALF - 0.5, 1.9],
    [col3, -STATION_HALF + 0.5, frontZ - 0.35],
    [col4, STATION_HALF - 0.5, frontZ - 0.35],
  ]

  return (
    <group>
      {/* dropped kerb: the road surface ramps up to the forecourt, no kerb between them */}
      <mesh rotation-x={-Math.PI / 2 - slope} position={[0, PAVE_Y / 2 + 0.002, KERB_Z - 0.04 + 0.21]}>
        <planeGeometry args={[STATION_HALF * 2, 0.44]} />
        <meshStandardMaterial color="#44484f" roughness={0.95} />
      </mesh>

      {/* forecourt paving and a green edge line */}
      <mesh rotation-x={-Math.PI / 2} position={[0, PAVE_Y + 0.0025, (KERB_Z + 0.16 + frontZ + 0.2) / 2]}>
        <planeGeometry args={[STATION_HALF * 2, frontZ + 0.2 - (KERB_Z + 0.16)]} />
        <meshStandardMaterial color="#8d9299" roughness={0.9} />
      </mesh>
      <mesh position={[0, PAVE_Y + 0.006, frontZ + 0.2]}>
        <boxGeometry args={[STATION_HALF * 2, 0.012, 0.12]} />
        <meshStandardMaterial color="#05C158" roughness={0.6} />
      </mesh>
      <mesh position={[-STATION_HALF, PAVE_Y + 0.006, (KERB_Z + 0.16 + frontZ + 0.2) / 2]}>
        <boxGeometry args={[0.12, 0.012, frontZ + 0.2 - (KERB_Z + 0.16)]} />
        <meshStandardMaterial color="#05C158" roughness={0.6} />
      </mesh>
      <mesh position={[STATION_HALF, PAVE_Y + 0.006, (KERB_Z + 0.16 + frontZ + 0.2) / 2]}>
        <boxGeometry args={[0.12, 0.012, frontZ + 0.2 - (KERB_Z + 0.16)]} />
        <meshStandardMaterial color="#05C158" roughness={0.6} />
      </mesh>

      {/* canopy over the charger */}
      <mesh ref={roofRef} geometry={roofGeo} position={[0, ROOF_Y + 0.1, (1.5 + frontZ) / 2]}>
        {/* glass roof: the car stays visible through it from above */}
        <meshStandardMaterial color="#dfe8e6" roughness={0.15} metalness={0.1} transparent opacity={0.3} depthWrite={false} />
      </mesh>
      <mesh ref={fasciaRef} geometry={fasciaGeo} position={[0, ROOF_Y - 0.05, frontZ]}>
        <meshStandardMaterial color="#1d2228" roughness={0.5} />
      </mesh>
      <mesh position={[0, ROOF_Y - 0.05, frontZ + 0.085]}>
        <planeGeometry args={[STATION_HALF * 2 + 0.4, 0.46]} />
        <meshBasicMaterial ref={signMat} map={sign} toneMapped={false} />
      </mesh>
      {/* light strips under the canopy */}
      {[2.2, 3.7].map((z) => (
        <mesh key={z} rotation-x={Math.PI / 2} position={[0, ROOF_Y - 0.004, z]} material={stripMat}>
          <planeGeometry args={[STATION_HALF * 2 - 0.8, 0.22]} />
        </mesh>
      ))}
      <pointLight ref={pA} position={[-3.6, ROOF_Y - 0.3, 2.9]} color="#e9fff3" intensity={0} distance={12} decay={2} />
      <pointLight ref={pB} position={[2.4, ROOF_Y - 0.3, 2.9]} color="#e9fff3" intensity={0} distance={12} decay={2} />
      <pointLight ref={pC} position={[STATION.x, 1.9, STATION.z + 0.9]} color="#9ff0c0" intensity={0} distance={5} decay={2} />
      {cols.map(([ref, x, z], i) => (
        <mesh key={i} ref={ref} geometry={colGeo} position={[x, ROOF_Y / 2 + PAVE_Y, z]}>
          <meshStandardMaterial color="#cfd3d8" roughness={0.45} metalness={0.4} />
        </mesh>
      ))}

      {/* totem beside the entrance */}
      <mesh ref={totemRef} geometry={totemGeo} position={[-STATION_HALF - 1.5, PAVE_Y + 2.0, 3.0]}>
        <meshStandardMaterial color="#1d2228" roughness={0.5} />
      </mesh>
      <mesh position={[-STATION_HALF - 1.5, PAVE_Y + 2.6, 3.0 + 0.185]}>
        <planeGeometry args={[0.92, 1.15]} />
        <meshBasicMaterial map={totemSign} toneMapped={false} />
      </mesh>
    </group>
  )
}
