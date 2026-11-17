import { Suspense, useLayoutEffect, useRef } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import * as THREE from 'three'
import { hero } from './scene/cityLayout'
import { INTRO_SECONDS, story, type Quality } from './story'
import { applyCamera, applyIntro } from './camera'
import { Car } from './scene/Car'
import { Charger } from './scene/Charger'
import { Road } from './scene/Road'
import { Traffic } from './scene/Traffic'
import { People } from './scene/People'

// Dev only: ?cam=x,y,z,tx,ty,tz,fov pins the camera so a part can be inspected from any angle.
const dbg = import.meta.env.DEV ? new URLSearchParams(location.search).get('cam') : null
// Dev only: ?intro=0.35 freezes the opening shot at 35% so any frame of it can be inspected.
const introDbg = import.meta.env.DEV ? new URLSearchParams(location.search).get('intro') : null

// Procedural studio light: no network HDRI. A few glowing cards (rect and ring, colour x intensity) are rendered once into a
// reflection map, which lights the whole street. A big floor card bounces light into the lower panels.
type Card = { form: 'rect' | 'ring'; intensity: number; position: [number, number, number]; rotation?: [number, number, number]; scale: number | [number, number, number]; color: string }
const CARDS: Card[] = [
  { form: 'rect', intensity: 2.4, position: [0, 6, 0], rotation: [Math.PI / 2, 0, 0], scale: [16, 7, 1], color: '#ffffff' },
  { form: 'rect', intensity: 1.5, position: [-7, 2.5, 2], rotation: [0, Math.PI / 2, 0], scale: [9, 3, 1], color: '#eaf4ff' },
  { form: 'rect', intensity: 1.8, position: [7, 2.5, 4], rotation: [0, -Math.PI / 2, 0], scale: [9, 3, 1], color: '#ffffff' },
  { form: 'rect', intensity: 1.1, position: [0, 3, 8], rotation: [0, Math.PI, 0], scale: [14, 2.2, 1], color: '#f4f9ff' },
  { form: 'rect', intensity: 0.9, position: [0, -3, 0], rotation: [-Math.PI / 2, 0, 0], scale: [30, 30, 1], color: '#cfd8e3' },
  { form: 'ring', intensity: 1, position: [0, 2, -6], scale: 6, color: '#baf5d6' },
]

function StudioLight({ size }: { size: number }) {
  const gl = useThree((st) => st.gl)
  const scene = useThree((st) => st.scene)
  useLayoutEffect(() => {
    const studio = new THREE.Scene()
    const geos: THREE.BufferGeometry[] = []
    const mats: THREE.Material[] = []
    for (const c of CARDS) {
      const geo = c.form === 'ring' ? new THREE.RingGeometry(0.5, 1, 64) : new THREE.PlaneGeometry(1, 1)
      const mat = new THREE.MeshBasicMaterial({ color: new THREE.Color(c.color).multiplyScalar(c.intensity), toneMapped: false })
      const m = new THREE.Mesh(geo, mat)
      m.position.set(...c.position)
      if (c.rotation) m.rotation.set(...c.rotation)
      if (typeof c.scale === 'number') m.scale.setScalar(c.scale)
      else m.scale.set(...c.scale)
      studio.add(m)
      geos.push(geo)
      mats.push(mat)
    }
    const pm = new THREE.PMREMGenerator(gl)
    const target = pm.fromScene(studio, 0, 0.1, 1000, { size })
    pm.dispose()
    scene.environment = target.texture
    story.dirty = 4
    return () => {
      if (scene.environment === target.texture) scene.environment = null
      target.dispose()
      geos.forEach((g) => g.dispose())
      mats.forEach((m) => m.dispose())
    }
  }, [gl, scene, size])
  return null
}

const DAY_BG = new THREE.Color('#F3F8FE')
const NIGHT_BG = new THREE.Color('#060a13')
const DAY_AMB = new THREE.Color('#ffffff')
const NIGHT_AMB = new THREE.Color('#5b73a8')
const DAY_SUN = new THREE.Color('#fffaf2')
const NIGHT_SUN = new THREE.Color('#8fa8ff')
const lerp = (a: number, b: number, t: number) => a + (b - a) * t
// the dreamy haze of the opening shot: the sky and fog take a soft tint that clears as the camera comes down
const DAY_HAZE = new THREE.Color('#e4d8ff')
const NIGHT_HAZE = new THREE.Color('#2a2670')
const _haze = new THREE.Color()

const smoothstep = (a: number, b: number, x: number) => {
  const k = Math.min(1, Math.max(0, (x - a) / (b - a)))
  return k * k * (3 - 2 * k)
}
// the strength of the dream veil (see .dream in styles.css), written only when it has visibly changed
let lastDream = -1
function setDream(v: number) {
  if (Math.abs(v - lastDream) < 0.004 && v > 0 && lastDream > 0) return
  lastDream = v
  document.documentElement.style.setProperty('--dream', v.toFixed(3))
}

export function World({ quality }: { quality: Quality }) {
  const high = quality === 'high'
  if (dbg) story.introDone = true
  if (import.meta.env.DEV) (window as unknown as { __story: unknown }).__story = story // dev only: scrub the opening shot from the console
  if (introDbg) {
    story.introT = Math.max(1e-4, parseFloat(introDbg) * INTRO_SECONDS)
    story.introSpeed = 0
  }

  // Our own clock in seconds. The render loop is driven by the scroll ticker, so R3F's clock is not seconds.
  const time = useRef(0)
  const introLast = useRef(performance.now())
  const nightLast = useRef(performance.now())
  const ambient = useRef<THREE.AmbientLight>(null)
  const sun = useRef<THREE.DirectionalLight>(null)

  useFrame((state, delta) => {
    time.current += Math.min(delta, 0.1)
    const cam = state.camera as THREE.PerspectiveCamera

    // ease between day and night (wall-clock, so it takes the same time however often we render)
    const nowT = performance.now()
    const dtN = Math.min((nowT - nightLast.current) / 1000, 0.1)
    nightLast.current = nowT
    const nightTarget = story.theme === 'dark' ? 1 : 0
    if (story.night !== nightTarget) {
      story.night += (nightTarget - story.night) * (1 - Math.exp(-dtN * 3.2))
      if (Math.abs(nightTarget - story.night) < 0.003) story.night = nightTarget
      story.dirty = Math.max(story.dirty, 2)
    }
    {
      const n = story.night
      const bg = state.scene.background as THREE.Color | null
      if (bg && bg.isColor) bg.lerpColors(DAY_BG, NIGHT_BG, n)
      const fg = state.scene.fog as THREE.Fog | null
      if (fg) fg.color.lerpColors(DAY_BG, NIGHT_BG, n)
      if (ambient.current) {
        ambient.current.intensity = lerp(0.45, 0.3, n)
        ambient.current.color.lerpColors(DAY_AMB, NIGHT_AMB, n)
      }
      if (sun.current) {
        sun.current.intensity = lerp(2.1, 0.32, n)
        sun.current.color.lerpColors(DAY_SUN, NIGHT_SUN, n)
      }
      state.scene.environmentIntensity = lerp(1.15, 0.2, n)
    }
    if (dbg) {
      const v = dbg.split(',').map(Number)
      cam.position.set(v[0], v[1], v[2])
      cam.lookAt(v[3], v[4], v[5])
      cam.fov = v[6] || 30
      cam.updateProjectionMatrix()
    } else {
      applyCamera(cam, story.smooth, state.size.width / state.size.height, time.current, state.size.width)
      if (!story.introDone) {
        // the opening shot starts once the loading screen is gone and the car is in the scene
        const started = story.introT > 0 || (story.loaderDone && (story.carReady || performance.now() > 9000))
        // wall-clock time, not the per-render delta: the render loop is driven by the scroll ticker and can burst
        const now = performance.now()
        if (started) story.introT += Math.min((now - introLast.current) / 1000, 0.1) * story.introSpeed
        introLast.current = now
        const t = Math.min(1, story.introT / INTRO_SECONDS)
        // 1 at the very start, fading to 0 by about three quarters of the way
        const dream = 1 - smoothstep(0, 0.78, t)
        setDream(dream)
        if (dream > 0.001) {
          _haze.lerpColors(DAY_HAZE, NIGHT_HAZE, story.night)
          const bg = state.scene.background as THREE.Color | null
          if (bg && bg.isColor) bg.lerp(_haze, 0.42 * dream)
          const fg = state.scene.fog as THREE.Fog | null
          if (fg) fg.color.lerp(_haze, 0.42 * dream)
        }
        const heroFov = cam.fov
        applyIntro(cam, t, heroFov)
        // the street fog would swallow the city from up there: push it out, then bring it back as we come down
        const fog = state.scene.fog as THREE.Fog | null
        if (fog) {
          const k = Math.min(1, Math.max(0, ((story.introT / INTRO_SECONDS) * 15 - 2.0) / 4.5)) // fog is back to normal by 6.5 s, as the orbit starts around the car
          const e = k * k * (3 - 2 * k)
          fog.near = 16 + (170 - 16) * (1 - e)
          fog.far = 90 + (700 - 90) * (1 - e)
        }
        if (t > 0.84) document.documentElement.classList.remove('intro') // the headline fades in as the orbit ends and the camera settles
        if (t >= 1) {
          story.introDone = true
          setDream(0)
          document.documentElement.classList.remove('intro')
          const fg = state.scene.fog as THREE.Fog | null
          if (fg) {
            fg.near = 16
            fg.far = 90
          }
          story.onIntroDone?.()
        }
        story.dirty = Math.max(story.dirty, 2)
      }
    }
    if (import.meta.env.DEV) (window as unknown as { __info: unknown }).__info = { calls: state.gl.info.render.calls, tris: state.gl.info.render.triangles, x: cam.position.x, y: cam.position.y, z: cam.position.z, carX: hero.x, carZ: hero.z, introT: story.introT, speed: story.introSpeed }
  })

  return (
    <>
      <ambientLight ref={ambient} intensity={0.45} />
      <directionalLight ref={sun} position={[6, 9, 7]} intensity={2.1} color="#fffaf2" />

      <StudioLight size={high ? 256 : 128} />

      <Road high={high} />
      <Suspense fallback={null}>
        <Car high={high} />
      </Suspense>
      <Charger high={high} />
      <Suspense fallback={null}>
        <Traffic high={high} />
      </Suspense>
      <Suspense fallback={null}>
        <People />
      </Suspense>
    </>
  )
}
