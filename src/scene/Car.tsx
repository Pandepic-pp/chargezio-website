import { useLayoutEffect, useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { story } from '../story'
import { carPose, phases, PORT } from '../layout'
import { AXLE_X, TIRE_Z, WHEEL_R, buildBodyGeometry, buildCabinGeometry } from './carShape'
import { carUniforms, makeBodyMaterial, makeCabinMaterial } from './paint'
import {
  buildArchTrim,
  buildCaliper,
  buildExteriorTrim,
  buildHubBadge,
  buildInterior,
  buildMirrorGlass,
  buildPortFlap,
  buildPortHousing,
  buildPortPins,
  buildRimDark,
  buildRimMetal,
  buildTire,
  buildWellLiner,
} from './carParts'
import { makeAtlas, makeCarShadow, makeRadial } from './textures'

const GREEN = '#05C158'

export function Car({ high }: { high: boolean }) {
  const root = useRef<THREE.Group>(null)
  const body = useRef<THREE.Group>(null)
  const steer = useRef<THREE.Group>(null)
  const spinF = useRef<THREE.Group>(null)
  const spinR = useRef<THREE.Group>(null)
  const flap = useRef<THREE.Group>(null)
  const ringMat = useRef<THREE.MeshStandardMaterial>(null)
  const glowMat = useRef<THREE.MeshBasicMaterial>(null)
  const portLight = useRef<THREE.PointLight>(null)
  const time = useRef(0)

  const geo = useMemo(
    () => ({
      body: buildBodyGeometry(high),
      cabin: buildCabinGeometry(high),
      // dark inner skin so the roof and pillars have an underside when seen from low angles
      headliner: (() => {
        const g = buildCabinGeometry(false)
        g.translate(0.535, -1.0, 0).scale(0.975, 0.93, 0.95).translate(-0.535, 1.0, 0)
        return g
      })(),
      interior: buildInterior(),
      tire: buildTire(high),
      rimMetal: buildRimMetal(),
      rimDark: buildRimDark(),
      caliper: buildCaliper(),
      badge: buildHubBadge(),
      liner: buildWellLiner(),
      archTrim: buildArchTrim(),
      trim: buildExteriorTrim(),
      mirror: buildMirrorGlass(),
      housing: buildPortHousing(),
      pins: buildPortPins(),
      flap: buildPortFlap(),
    }),
    [high],
  )
  const mat = useMemo(
    () => ({
      body: makeBodyMaterial(high),
      cabin: makeCabinMaterial(),
      flap: new THREE.MeshPhysicalMaterial({
        color: '#f1f3f4',
        roughness: 0.3,
        clearcoat: high ? 1 : 0,
        clearcoatRoughness: 0.06,
        side: THREE.DoubleSide,
      }),
    }),
    [high],
  )
  const atlas = useMemo(makeAtlas, [])
  const shadowTex = useMemo(makeCarShadow, [])
  const glowTex = useMemo(() => makeRadial('rgba(5,193,88,0.9)', 'rgba(5,193,88,0)'), [])
  useLayoutEffect(() => {
    carUniforms.uAtlas.value = atlas
  }, [atlas])

  useFrame((_, delta) => {
    const dt = Math.min(delta, 0.1)
    time.current += dt
    const t = time.current
    const p = story.smooth
    const ph = phases(p)
    const pose = carPose(p)

    if (root.current) {
      root.current.position.set(pose.x, 0, pose.z)
      root.current.rotation.y = pose.yaw
    }
    if (body.current) body.current.rotation.z = pose.pitch
    const spin = -pose.travel / WHEEL_R
    if (spinF.current) spinF.current.rotation.z = spin
    if (spinR.current) spinR.current.rotation.z = spin
    if (steer.current) steer.current.rotation.y = pose.steer
    if (flap.current) flap.current.rotation.x = -1.45 * ph.f

    carUniforms.uHead.value = ph.wake
    carUniforms.uTail.value = ph.wake
    carUniforms.uCharge.value = ph.g * (0.7 + 0.3 * Math.sin(t * 4))

    if (ringMat.current) ringMat.current.emissiveIntensity = 0.15 + ph.f * 0.5 + ph.g * (1.4 + 0.5 * Math.sin(t * 5))
    if (glowMat.current) glowMat.current.opacity = 0.32 * ph.g * (0.85 + 0.15 * Math.sin(t * 3))
    if (portLight.current) portLight.current.intensity = ph.g * 0.9
  })

  const tireMat = <meshStandardMaterial color="#141517" roughness={0.92} />
  const rimMat = <meshStandardMaterial color="#cdd2d9" metalness={1} roughness={0.24} />
  const darkMat = <meshStandardMaterial color="#1a1c21" metalness={0.85} roughness={0.5} side={THREE.DoubleSide} />
  const plastic = <meshStandardMaterial color="#0e0f12" roughness={0.55} side={THREE.DoubleSide} />

  const wheel = (x: number, near: boolean, spinRef?: React.RefObject<THREE.Group | null>, steerRef?: React.RefObject<THREE.Group | null>) => (
    <group position={[x, WHEEL_R, near ? TIRE_Z : -TIRE_Z]} rotation-y={near ? 0 : Math.PI}>
      <group ref={steerRef}>
        <group ref={spinRef}>
          <mesh geometry={geo.tire}>{tireMat}</mesh>
          <mesh geometry={geo.rimDark}>{darkMat}</mesh>
          {near && (
            <>
              <mesh geometry={geo.rimMetal}>{rimMat}</mesh>
              <mesh geometry={geo.badge}>
                <meshStandardMaterial color={GREEN} roughness={0.35} />
              </mesh>
            </>
          )}
        </group>
        {near && (
          <mesh geometry={geo.caliper}>
            <meshPhysicalMaterial color={GREEN} roughness={0.32} clearcoat={0.6} />
          </mesh>
        )}
      </group>
    </group>
  )

  return (
    <group ref={root}>
      <group ref={body}>
        <mesh geometry={geo.body} material={mat.body} />
        <mesh geometry={geo.cabin} material={mat.cabin} renderOrder={3} />
        <mesh geometry={geo.headliner}>
          <meshStandardMaterial color="#17181b" roughness={0.9} side={THREE.BackSide} />
        </mesh>
        <mesh geometry={geo.interior}>
          <meshStandardMaterial vertexColors roughness={0.8} />
        </mesh>
        <mesh geometry={geo.trim}>{plastic}</mesh>
        <mesh geometry={geo.mirror}>
          <meshStandardMaterial color="#2a2f38" metalness={1} roughness={0.12} />
        </mesh>
        <mesh geometry={geo.archTrim}>{plastic}</mesh>
        <mesh geometry={geo.liner}>
          <meshStandardMaterial color="#09090b" roughness={0.95} side={THREE.BackSide} />
        </mesh>

        {/* charge port */}
        <group position={PORT.pos} quaternion={PORT.quat}>
          <mesh geometry={geo.housing}>{plastic}</mesh>
          <mesh geometry={geo.pins}>
            <meshStandardMaterial color="#b7bcc4" metalness={1} roughness={0.3} />
          </mesh>
          <mesh position={[0, 0.034, -0.034]}>
            <torusGeometry args={[0.064, 0.0036, 8, 40]} />
            <meshStandardMaterial ref={ringMat} color="#0a0c0e" emissive={GREEN} emissiveIntensity={0.15} />
          </mesh>
          <group ref={flap} position={geo.flap.hinge}>
            <mesh geometry={geo.flap.geo} material={mat.flap} />
          </group>
          <pointLight ref={portLight} position={[0, 0.1, 0.35]} color={GREEN} intensity={0} distance={3.2} decay={2} />
        </group>
      </group>

      {wheel(AXLE_X, true, spinF, steer)}
      {wheel(-AXLE_X, true, spinR)}
      {wheel(AXLE_X, false)}
      {wheel(-AXLE_X, false)}

      {/* soft contact shadow and the charging glow on the ground */}
      <mesh rotation-x={-Math.PI / 2} position={[0, 0.012, 0]} renderOrder={1}>
        <planeGeometry args={[6.2, 3.1]} />
        <meshBasicMaterial map={shadowTex} transparent opacity={0.85} depthWrite={false} toneMapped={false} />
      </mesh>
      <mesh rotation-x={-Math.PI / 2} position={[0, 0.014, 0]} renderOrder={2}>
        <planeGeometry args={[6.4, 3.2]} />
        <meshBasicMaterial ref={glowMat} map={glowTex} transparent opacity={0} depthWrite={false} blending={THREE.AdditiveBlending} toneMapped={false} />
      </mesh>
    </group>
  )
}
