import { useLayoutEffect, useMemo, useRef } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import { useGLTF } from './gltf'
import * as THREE from 'three'
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js'
import { INTRO_SECONDS, clamp, smooth, story } from '../story'
import { carPose, phases, PORT } from '../layout'
import { hero } from './cityLayout'
import { INTRO_DRIVE_END, routePose } from './route'
import { makeHalo } from './ink'
import { makeCarShadow, makeRadial } from './textures'
import { beamGeometry, beamMaterial, beamTexture } from './beams'

// The car is the Mahindra BE 6 style EV built in Blender (public/models/be6.glb, Draco compressed).
// Node names in the file:
//   BE6_Body                    all static parts (paint, glass, lamps, trim, mirrors ...), one primitive per material
//   Wheel_{FL,FR,RL,RR}_Steer   pivot at the wheel centre (front pair turns about Y)
//     Wheel_xx_Spin             tyre, rim, disc (spins about Z, the axle)
//     Caliper_xx                static brake caliper
//   Charge_Flap                 origin on the front hinge edge (opens about Y)

const GREEN = '#05C158'
const BASE = import.meta.env.BASE_URL
const URL = BASE + 'models/be6.glb'
useGLTF.preload(URL)

// Lamp materials (by name in the GLB). Their emission is driven by the story.
const HEAD = ['BE6_DRL_LED', 'BE6_DRL_Diffuser', 'BE6_Projector_LED']
const TAIL = ['BE6R_Tail_LED', 'BE6R_Tail_Diffuser', 'BE6R_Emblem_Lit']
const HEAD_K: Record<string, number> = { BE6_DRL_LED: 5.0, BE6_DRL_Diffuser: 0.45, BE6_Projector_LED: 2.2 }
const TAIL_K: Record<string, number> = { BE6R_Tail_LED: 1.8, BE6R_Tail_Diffuser: 1.7, BE6R_Emblem_Lit: 1.6 }
const BRAKE = ['BE6R_Brake_LED']
const INDICATOR = ['BE6R_Indicator_LED', 'BE6S_Indicator_Amber']
const WHEEL_R = 0.383
const FLAP_OPEN = 1.35

export function Car({ high }: { high: boolean }) {
  const { scene } = useGLTF(URL)
  const root = useRef<THREE.Group>(null)
  const body = useRef<THREE.Group>(null)
  const flap = useRef<THREE.Object3D | null>(null)
  const steer = useRef<THREE.Object3D[]>([])
  const spin = useRef<THREE.Object3D[]>([])
  type Mat = THREE.MeshStandardMaterial
  const lamps = useRef<{ head: Mat[]; tail: Mat[]; brake: Mat[]; ind: Mat[]; roof: Mat[] }>({ head: [], tail: [], brake: [], ind: [], roof: [] })
  const envMats = useRef<{ m: Mat; base: number }[]>([])
  const halos = useRef<{ h: ReturnType<typeof makeHalo>; kind: 'tail' | 'brake' | 'drl' | 'beam' | 'ind' }[]>([])
  const lastNight = useRef(-1)
  const spL = useRef<THREE.SpotLight>(null)
  const spR = useRef<THREE.SpotLight>(null)
  const tgL = useRef<THREE.Object3D>(null)
  const tgR = useRef<THREE.Object3D>(null)
  const tailLight = useRef<THREE.PointLight>(null)
  // the light on the road: two soft pools ahead (one per headlamp) and two short red ones behind (tail lamps), the same as the traffic
  const beamTex = useMemo(beamTexture, [])
  const beamMat = useMemo(() => beamMaterial(beamTex, '#fff1d6', 0), [beamTex])
  const tailBeamMat = useMemo(() => beamMaterial(beamTex, '#ff3a22', 0), [beamTex])
  const beamFGeo = useMemo(() => beamGeometry(1), [])
  const beamRGeo = useMemo(() => beamGeometry(-1), [])
  const ringMat = useRef<THREE.MeshStandardMaterial>(null)
  const glowMat = useRef<THREE.MeshBasicMaterial>(null)
  const portLight = useRef<THREE.PointLight>(null)
  const time = useRef(0)
  const carInv = useMemo(() => ({ value: new THREE.Matrix4() }), [])

  const shadowTex = useMemo(makeCarShadow, [])
  const glowTex = useMemo(() => makeRadial('rgba(5,193,88,0.9)', 'rgba(5,193,88,0)'), [])

  const model = useMemo(() => scene.clone(true), [scene])

  // A studio reflection map used by the car only: soft boxes give the paint and glass the long highlights
  // that make the body shape readable (the street's own light rig is too flat for that).
  const gl = useThree((st) => st.gl)
  const env = useMemo(() => {
    const pm = new THREE.PMREMGenerator(gl)
    const tex = pm.fromScene(new RoomEnvironment(), 0.25).texture
    pm.dispose()
    return tex
  }, [gl])

  useLayoutEffect(() => {
    const head: THREE.MeshStandardMaterial[] = []
    const tail: THREE.MeshStandardMaterial[] = []
    const brake: Mat[] = []
    const ind: Mat[] = []
    const roof: Mat[] = []
    envMats.current = []
    for (const h of halos.current) h.h.dispose()
    const newHalos: typeof halos.current = []
    const seen = new Set<THREE.Material>()
    steer.current = []
    spin.current = []
    model.traverse((o) => {
      if (/^Wheel_(FL|FR)_Steer$/.test(o.name)) steer.current.push(o)
      if (/^Wheel_(FL|FR|RL|RR)_Spin$/.test(o.name)) {
        o.rotation.order = 'YXZ'
        spin.current.push(o)
      }
      if (o.name === 'Charge_Flap') flap.current = o
      const m = o as THREE.Mesh
      if (!m.isMesh) return
      m.castShadow = false
      m.receiveShadow = false
      {
        const mm = Array.isArray(m.material) ? m.material[0] : m.material
        const nm = (mm as THREE.Material).name
        const kind: 'tail' | 'brake' | 'drl' | 'beam' | 'ind' | null = /^BE6R_(Tail_LED|Emblem_Lit)$/.test(nm)
          ? 'tail'
          : nm === 'BE6R_Brake_LED'
            ? 'brake'
            : nm === 'BE6_DRL_LED'
              ? 'drl'
              : nm === 'BE6_Projector_LED'
                ? 'beam'
                : /^(BE6R_Indicator_LED|BE6S_Indicator_Amber)$/.test(nm)
                  ? 'ind'
                  : null
        if (kind) {
          const color = kind === 'tail' || kind === 'brake' ? '#ff2a1c' : kind === 'ind' ? '#ffa020' : '#dfeeff'
          newHalos.push({ h: makeHalo(m, color, kind === 'drl' ? [4, 10] : [5, 14]), kind })
        }
      }
      const mats = Array.isArray(m.material) ? m.material : [m.material]
      for (const mat of mats) {
        if (seen.has(mat)) continue
        seen.add(mat)
        const sm = mat as THREE.MeshStandardMaterial
        if (HEAD.includes(sm.name)) head.push(sm)
        else if (TAIL.includes(sm.name)) tail.push(sm)
        else if (BRAKE.includes(sm.name)) brake.push(sm)
        else if (INDICATOR.includes(sm.name)) ind.push(sm)
        else if (sm.name === 'LED_Roof') roof.push(sm)
        if (/Indicator|Brake_LED|Reverse_LED|LED_Roof/.test(sm.name)) sm.emissiveIntensity = 0
        sm.envMap = env
        sm.envMapIntensity = 1
        if (sm.name === 'Body_Paint') {
          // matte paint in the logo's gradient, green #05CB3F at the front fading to blue #0282EA at the back (the car's own +X is
          // the front): almost no metal, soft highlights, no clear coat
          const p = sm as THREE.MeshPhysicalMaterial
          p.color.set('#ffffff')
          p.onBeforeCompile = (shader) => {
            shader.uniforms.uCarInv = carInv
            shader.uniforms.uBlue = { value: new THREE.Color('#0282EA') }
            shader.uniforms.uGreen = { value: new THREE.Color('#05CB3F') }
            shader.vertexShader = shader.vertexShader
              .replace('#include <common>', '#include <common>\nvarying vec3 vCar;\nuniform mat4 uCarInv;')
              .replace('#include <begin_vertex>', '#include <begin_vertex>\nvCar = (uCarInv * modelMatrix * vec4(transformed, 1.0)).xyz;')
            shader.fragmentShader = shader.fragmentShader
              .replace('#include <common>', '#include <common>\nvarying vec3 vCar;\nuniform vec3 uBlue;\nuniform vec3 uGreen;')
              .replace(
                '#include <color_fragment>',
                `#include <color_fragment>
                float gt = clamp((vCar.x + 2.15) / 4.3, 0.0, 1.0); // 0 at the tail, 1 at the nose
                vec3 gc = mix(uBlue, uGreen, gt) * 0.62;
                diffuseColor.rgb *= gc;`,
              )
          }
          p.metalness = 0.15
          p.roughness = 0.6
          p.envMapIntensity = 1.1
          if ('clearcoat' in p) {
            p.clearcoat = 0
            p.clearcoatRoughness = 0.6
          }
          p.specularIntensity = 0.7
        } else if (/Glass/.test(sm.name)) {
          sm.depthWrite = false
          sm.roughness = 0.06
          sm.metalness = 0.1
          sm.envMapIntensity = 1.5
        } else if (/Piano/.test(sm.name)) {
          sm.roughness = 0.14
          sm.envMapIntensity = 1.3
        }
        // The body skins, glass, seals and trim all sit a millimetre or two apart. Depth bias keeps the order stable after
        // decimation: glass and trim in front, then the paint skins, then the black underbody shell.
        if (/Lens/.test(sm.name)) {
          // lamp lenses sit over the lamp, so they get the strongest bias and never write depth
          sm.polygonOffset = true
          sm.polygonOffsetFactor = -9
          sm.polygonOffsetUnits = -9
          sm.depthWrite = false
          // the lens only tints the lamp: keep it light so the LED underneath reads bright
          if (/Tail_Lens/.test(sm.name)) sm.opacity = 0.1
        } else if (/LED|Diffuser|Emblem_Lit|Amber/.test(sm.name)) {
          // the lit parts must come in front of their (piano black) housings, which have bias -5 below
          sm.polygonOffset = true
          sm.polygonOffsetFactor = -8
          sm.polygonOffsetUnits = -8
          // lit parts skip tone mapping, which would wash a red LED out towards pink
          sm.toneMapped = false
        } else if (/Glass|Seal|Trim|Brushed|Piano|Gap|Recess/.test(sm.name)) {
          sm.polygonOffset = true
          sm.polygonOffsetFactor = -5
          sm.polygonOffsetUnits = -5
        } else if (sm.name === 'Body_Paint') {
          sm.polygonOffset = true
          sm.polygonOffsetFactor = -3
          sm.polygonOffsetUnits = -3
        }
        envMats.current.push({ m: sm, base: sm.envMapIntensity })
        sm.needsUpdate = true
      }
    })
    // steering pivots turn about Y first, spin about the axle (Z)
    for (const s of steer.current) s.rotation.order = 'YXZ'
    lamps.current = { head, tail, brake, ind, roof }
    halos.current = newHalos
    lastNight.current = -1
    // the headlamp spots aim down the road
    if (spL.current && tgL.current) spL.current.target = tgL.current
    if (spR.current && tgR.current) spR.current.target = tgR.current
    story.carReady = true
    story.dirty = 4
  }, [model, high, env])

  useFrame((_, delta) => {
    const dt = Math.min(delta, 0.1)
    time.current += dt
    const t = time.current
    const p = story.smooth
    const ph = phases(p)
    // during the opening shot the car drives in from down the road and parks; afterwards the scroll story takes over
    const arriving = !story.introDone
    const uc = clamp(story.introT / INTRO_SECONDS / INTRO_DRIVE_END)
    const route = arriving ? routePose(uc) : null
    const pose = route ?? { ...carPose(p), y: 0 }
    // let the traffic know where the hero car is, so it keeps out of its way
    hero.x = pose.x
    hero.z = pose.z
    hero.yaw = pose.yaw
    hero.moving = arriving ? uc < 0.995 : p > 0.69 && p < 0.9

    if (import.meta.env.DEV) (window as unknown as { __car: unknown }).__car = { x: pose.x, z: pose.z, yaw: pose.yaw, p, arriving, uc }
    if (root.current) {
      root.current.position.set(pose.x, pose.y, pose.z)
      root.current.rotation.y = pose.yaw
    }
    if (body.current) body.current.rotation.z = pose.pitch
    if (root.current) {
      root.current.updateMatrixWorld()
      carInv.value.copy(root.current.matrixWorld).invert() // gradient is fixed to the car, not the world
    }
    const ang = -pose.travel / WHEEL_R
    for (const s of spin.current) s.rotation.z = ang
    for (const s of steer.current) s.rotation.y = pose.steer
    if (flap.current) flap.current.rotation.y = FLAP_OPEN * ph.f

    const n = story.night
    // "drive": the car is moving (arriving or leaving). Lamps follow the Blender car's own lamp parts by material name.
    const drive = route ? 1 - smooth(0.975, 1.0, uc) : ph.wake
    const brake = route ? Math.max(route.braking, smooth(0.96, 0.975, uc) * (1 - smooth(0.99, 1.0, uc))) : 0
    const turning = route ? route.turning : p > 0.69 && p < 0.8 ? 1 : 0
    const blink = Math.sin(t * 9.5) > 0 ? 1 : 0
    const tailLvl = Math.max(drive * 0.85, 0.6 * n, brake)
    for (const m of lamps.current.head) {
      if (m.name.startsWith('BE6_DRL')) m.emissiveIntensity = (HEAD_K[m.name] ?? 1) * (0.8 + 0.2 * Math.max(drive, n))
      else m.emissiveIntensity = (HEAD_K[m.name] ?? 1) * (drive * (0.55 + 0.45 * n) + 0.08 * n)
    }
    for (const m of lamps.current.tail) m.emissiveIntensity = (TAIL_K[m.name] ?? 1) * tailLvl
    for (const m of lamps.current.brake) m.emissiveIntensity = 2.4 * brake
    for (const m of lamps.current.ind) m.emissiveIntensity = 1.8 * turning * blink
    for (const m of lamps.current.roof) m.emissiveIntensity = 1.1 * n

    // soft glow around the lit parts
    const gk = 0.3 + 0.7 * n
    for (const { h, kind } of halos.current) {
      const lvl =
        kind === 'tail' ? tailLvl : kind === 'brake' ? brake : kind === 'drl' ? 0.8 + 0.2 * Math.max(drive, n) : kind === 'beam' ? drive * (0.55 + 0.45 * n) : turning * blink
      h.set(lvl * gk)
    }

    // real light from the headlamps and tail lamps, plus the beam on the road
    const beam = n * drive
    if (spL.current) spL.current.intensity = 160 * beam
    if (spR.current) spR.current.intensity = 160 * beam
    beamMat.opacity = 0.55 * beam
    tailBeamMat.opacity = (0.3 * tailLvl + 0.7 * brake) * (0.15 + 0.85 * n)
    if (tailLight.current) tailLight.current.intensity = (0.5 * tailLvl + 2.2 * brake) * (0.3 + 0.7 * n) * 1.4

    // the car's own reflection map is a bright studio: dim it at night so the paint reads dark
    if (Math.abs(n - lastNight.current) > 0.004) {
      lastNight.current = n
      const k = 1 - 0.62 * n
      for (const e of envMats.current) e.m.envMapIntensity = e.base * k
    }

    if (ringMat.current) ringMat.current.emissiveIntensity = 0.15 + ph.f * 0.5 + ph.g * (1.4 + 0.5 * Math.sin(t * 5))
    if (glowMat.current) glowMat.current.opacity = 0.32 * ph.g * (0.85 + 0.15 * Math.sin(t * 3))
    if (portLight.current) portLight.current.intensity = ph.g * 0.9
  })

  return (
    <group ref={root}>
      <group ref={body}>
        <primitive object={model} />

        {/* headlamp lights, tail light and the beams on the road */}
        <spotLight ref={spL} position={[2.0, 0.72, 0.62]} angle={0.5} penumbra={0.75} intensity={0} distance={26} decay={2} color="#fff1d6" />
        <spotLight ref={spR} position={[2.0, 0.72, -0.62]} angle={0.5} penumbra={0.75} intensity={0} distance={26} decay={2} color="#fff1d6" />
        <object3D ref={tgL} position={[15, -0.1, 1.1]} />
        <object3D ref={tgR} position={[15, -0.1, -1.1]} />
        <pointLight ref={tailLight} position={[-3.1, 0.45, 0]} color="#ff2b1c" intensity={0} distance={5} decay={2} />
        {[0.62, -0.62].map((z) => (
          <group key={z}>
            <mesh geometry={beamFGeo} material={beamMat} position={[2.0, 0.03, z]} scale={[9, 1, 2.2]} renderOrder={4} />
            <mesh geometry={beamRGeo} material={tailBeamMat} position={[-2.1, 0.03, z]} scale={[3.2, 1, 1.5]} renderOrder={4} />
          </group>
        ))}

        {/* charge port: status ring and light */}
        <group position={PORT.pos} quaternion={PORT.quat}>
          <mesh position={[0, 0, -0.004]}>
            <torusGeometry args={[0.062, 0.0032, 8, 40]} />
            <meshStandardMaterial ref={ringMat} color="#0a0c0e" emissive={GREEN} emissiveIntensity={0.15} />
          </mesh>
          <pointLight ref={portLight} position={[0, 0.1, 0.35]} color={GREEN} intensity={0} distance={3.2} decay={2} />
        </group>
      </group>

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
