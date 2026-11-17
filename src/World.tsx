import { Suspense, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import { Environment, Lightformer } from '@react-three/drei'
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

const DAY_BG = new THREE.Color('#F3F8FE')
const NIGHT_BG = new THREE.Color('#060a13')
const DAY_AMB = new THREE.Color('#ffffff')
const NIGHT_AMB = new THREE.Color('#5b73a8')
const DAY_SUN = new THREE.Color('#fffaf2')
const NIGHT_SUN = new THREE.Color('#8fa8ff')
const lerp = (a: number, b: number, t: number) => a + (b - a) * t

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

      {/* Procedural studio light: no network HDRI. A big floor card bounces light into the lower panels. */}
      <Environment resolution={high ? 256 : 128} frames={1} environmentIntensity={1.15}>
        <Lightformer form="rect" intensity={2.4} position={[0, 6, 0]} rotation-x={Math.PI / 2} scale={[16, 7, 1]} color="#ffffff" />
        <Lightformer form="rect" intensity={1.5} position={[-7, 2.5, 2]} rotation-y={Math.PI / 2} scale={[9, 3, 1]} color="#eaf4ff" />
        <Lightformer form="rect" intensity={1.8} position={[7, 2.5, 4]} rotation-y={-Math.PI / 2} scale={[9, 3, 1]} color="#ffffff" />
        <Lightformer form="rect" intensity={1.1} position={[0, 3, 8]} rotation-y={Math.PI} scale={[14, 2.2, 1]} color="#f4f9ff" />
        <Lightformer form="rect" intensity={0.9} position={[0, -3, 0]} rotation-x={-Math.PI / 2} scale={[30, 30, 1]} color="#cfd8e3" />
        <Lightformer form="ring" intensity={1} position={[0, 2, -6]} scale={6} color="#baf5d6" />
      </Environment>

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
