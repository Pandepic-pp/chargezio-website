import { useLayoutEffect, useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { useGLTF } from './gltf'
import { story } from '../story'
import { merge } from './math'
import { buildFleet, modelUrl } from './fleet'
import { LANE1, ROUTES, hero, roadY } from './cityLayout'
import { seeded } from './props'
import { beamGeometry, beamMaterial, beamTexture } from './beams'

// Background traffic: simple stylised cars (so they match the outlined look of the street) driving the lanes of the
// city, round the roundabouts and through the junctions. Plus a few parked cars along the kerb.

// The cars are low-poly models optimised for the web (public/models/city/*.glb, built in Blender: oriented to
// face +X, scaled, decimated, textures shrunk). Several cars share each model through instancing.
const MODELS = [
  { name: 'generic', length: 4.4 },
  { name: 'peugeot', length: 3.95 },
  { name: 'club', length: 3.3 },
  { name: 'horai', length: 4.3 },
]
const WHEELS = ['FL', 'FR', 'RL', 'RR'] as const
// which model each car uses (cycled, so every model appears and the common ones repeat)
const ORDER = [0, 2, 0, 1, 3, 0, 2, 0, 1, 3, 0, 2, 0, 3, 1, 0]
const URLS = MODELS.map((m) => modelUrl(m.name))
URLS.forEach((u) => useGLTF.preload(u))

type Car = { route: number; s: number; v: number; vNow: number; waitsForHero: boolean; model: number; slot: number; prio: number; stuck: number; dist: number }

// Head and tail lamps: the models already have their own lamp shapes, so at night each lamp only gets a soft round glow
// (a camera-facing point sprite with a radial fade) placed from the model's bounds: nose and tail, at headlight height.
type Lamp = { p: THREE.Vector3; color: THREE.Color }
function lampAnchors(box: THREE.Box3): Lamp[] {
  const w = box.max.z - box.min.z
  const y = box.min.y + (box.max.y - box.min.y) * 0.4
  const z = w * 0.28
  const out: Lamp[] = []
  for (const side of [-1, 1]) {
    out.push({ p: new THREE.Vector3(box.max.x - 0.22, y, side * z), color: new THREE.Color('#ffefc8') })
    out.push({ p: new THREE.Vector3(box.min.x + 0.2, y + 0.04, side * z), color: new THREE.Color('#ff2a1c') })
  }
  return out
}
function glowTexture() {
  const c = document.createElement('canvas')
  c.width = c.height = 64
  const g = c.getContext('2d')!
  const r = g.createRadialGradient(32, 32, 0, 32, 32, 32)
  r.addColorStop(0, 'rgba(255,255,255,1)')
  r.addColorStop(0.25, 'rgba(255,255,255,0.55)')
  r.addColorStop(1, 'rgba(255,255,255,0)')
  g.fillStyle = r
  g.fillRect(0, 0, 64, 64)
  const t = new THREE.CanvasTexture(c)
  t.colorSpace = THREE.SRGBColorSpace
  return t
}

export function Traffic({ high }: { high: boolean }) {
  const gltfs = useGLTF(URLS)
  const rand = useMemo(() => seeded(77), [])

  // moving cars
  const cars = useMemo<Car[]>(() => {
    const out: Car[] = []
    let n = 0
    ROUTES.forEach((r, ri) => {
      const count = high ? r.count : Math.max(1, Math.ceil(r.count / 2))
      // routes that pass the hero car's lane wait (off in the distance) until its opening drive is over
      const waits = r.name === 'main-east' || r.name === 'A-north' || r.name.startsWith('ave-')
      // right of way at junctions and roundabouts: the main road first, then the avenue, then the cross roads
      const prio = r.name.startsWith('main') ? 0 : r.name.startsWith('ave') ? 1 : 2
      const spacing = r.length / count
      for (let k = 0; k < count; k++) {
        out.push({
          route: ri,
          s: waits ? -k * 70 - 30 : k * spacing + rand() * spacing * 0.35,
          v: r.speed * (0.92 + rand() * 0.16),
          vNow: 0,
          waitsForHero: waits,
          model: ORDER[n++ % ORDER.length],
          slot: 0,
          prio,
          stuck: 0,
          dist: 0,
        })
      }
    })
    return out
  }, [rand, high])

  // parked cars along the near kerb (the parking lane next to the station)
  const parked = useMemo(() => {
    const xs = [-13.5, -19.8, -31, 15.5, 22, 34.5, 47] // none near the cross roads: the hero car turns through that corner
    return xs.filter((_, i) => high || i % 2 === 0).map((x, i) => ({ x, z: 0.15, model: ORDER[(i * 3 + 5) % ORDER.length], slot: 0 }))
  }, [high])

  // slots inside each model's instanced meshes
  const counts = useMemo(() => {
    const c = MODELS.map(() => 0)
    for (const car of cars) car.slot = c[car.model]++
    for (const car of parked) car.slot = c[car.model]++
    return c
  }, [cars, parked])

  // per model: the body, and four wheels that can spin (and the front pair steer) about their own centres
  const models = useMemo(
    () =>
      gltfs.map((g, i) => {
        const n = Math.max(1, counts[i])
        const body = buildFleet(g.scene.getObjectByName(MODELS[i].name)!, n, true)
        const wheels = WHEELS.map((k) => {
          const node = g.scene.getObjectByName('wheel_' + k)!
          const box = new THREE.Box3()
          node.traverse((o) => {
            const m = o as THREE.Mesh
            if (m.isMesh) {
              m.geometry.computeBoundingBox()
              box.union(m.geometry.boundingBox!)
            }
          })
          const size = box.getSize(new THREE.Vector3())
          return { fleet: buildFleet(node, n), center: node.position.clone(), radius: Math.max(size.x, size.y) / 2, front: k[0] === 'F' }
        })
        const bounds = new THREE.Box3().setFromObject(g.scene.getObjectByName(MODELS[i].name)!)
        const wid = bounds.max.z - bounds.min.z
        const S = (l: number, w: number) => new THREE.Matrix4().makeScale(l, 1, w)
        return {
          body,
          wheels,
          lamps: lampAnchors(bounds),
          // two soft pools at the front (one per headlamp) and two short ones behind (taillamps)
          beamF: [-1, 1].map((side) => new THREE.Matrix4().makeTranslation(bounds.max.x - 0.15, 0.03, side * wid * 0.28).multiply(S(8, wid * 0.9))),
          beamR: [-1, 1].map((side) => new THREE.Matrix4().makeTranslation(bounds.min.x + 0.15, 0.03, side * wid * 0.28).multiply(S(2.6, wid * 0.7))),
        }
      }),
    [gltfs, counts],
  )
  if (import.meta.env.DEV) (window as unknown as { __trafficModels: unknown }).__trafficModels = models
  const fleets = useMemo(() => models.flatMap((m) => [m.body, ...m.wheels.map((w) => w.fleet)]), [models])
  useLayoutEffect(() => () => fleets.forEach((f) => f.dispose()), [fleets])

  // one glow point per lamp of every car (four each), moved with the cars every frame
  const total = cars.length + parked.length
  const glowTex = useMemo(() => glowTexture(), [])
  const glowGeo = useMemo(() => {
    const g = new THREE.BufferGeometry()
    g.setAttribute('position', new THREE.BufferAttribute(new Float32Array(total * 4 * 3), 3))
    g.setAttribute('color', new THREE.BufferAttribute(new Float32Array(total * 4 * 3), 3))
    return g
  }, [total])
  const glowMat = useRef<THREE.PointsMaterial>(null)
  const beamTex = useMemo(beamTexture, [])
  const beamFGeo = useMemo(() => beamGeometry(1), [])
  const beamRGeo = useMemo(() => beamGeometry(-1), [])
  const beamFRef = useRef<THREE.InstancedMesh>(null)
  const beamRRef = useRef<THREE.InstancedMesh>(null)
  const beamFMat = useMemo(() => beamMaterial(beamTex, '#ffeccb', 0.05), [beamTex])
  const beamRMat = useMemo(() => beamMaterial(beamTex, '#ff3a22', 0.03), [beamTex])
  const bm = useMemo(() => new THREE.Matrix4(), [])
  const lp = useMemo(() => new THREE.Vector3(), [])

  const obj = useMemo(() => new THREE.Object3D(), [])
  const tan = useMemo(() => new THREE.Vector3(), [])
  const pos = useMemo(() => new THREE.Vector3(), [])
  const tan2 = useMemo(() => new THREE.Vector3(), [])
  const hide = useMemo(() => new THREE.Matrix4().makeScale(0, 0, 0), [])
  const last = useRef(performance.now())

  const wm = useMemo(() => new THREE.Matrix4(), [])
  const wt = useMemo(() => new THREE.Matrix4(), [])
  const wr = useMemo(() => new THREE.Matrix4(), [])
  const place = (car: { model: number; slot: number; dist?: number }, idx: number, m: THREE.Matrix4, steer = 0, hidden = false) => {
    const mod = models[car.model]
    mod.body.set(car.slot, m)
    for (const w of mod.wheels) {
      if (hidden) {
        w.fleet.set(car.slot, m)
        continue
      }
      // car * move to the wheel centre * steer (front wheels) * roll about the axle (the model's z axis)
      wm.copy(m).multiply(wt.makeTranslation(w.center.x, w.center.y, w.center.z))
      if (w.front) wm.multiply(wr.makeRotationY(steer))
      wm.multiply(wr.makeRotationZ(-(car.dist ?? 0) / w.radius))
      w.fleet.set(car.slot, wm)
    }
    // light on the road: same pose (a hidden car's matrix is all zeros, so its beams vanish too)
    for (let k = 0; k < 2; k++) {
      beamFRef.current?.setMatrixAt(idx * 2 + k, bm.multiplyMatrices(m, mod.beamF[k]))
      beamRRef.current?.setMatrixAt(idx * 2 + k, bm.multiplyMatrices(m, mod.beamR[k]))
    }
    // lamp glows: same pose (a hidden car parks its glows far below the street)
    const pos = glowGeo.attributes.position as THREE.BufferAttribute
    const col = glowGeo.attributes.color as THREE.BufferAttribute
    mod.lamps.forEach((l, k) => {
      if (hidden) lp.set(0, -500, 0)
      else lp.copy(l.p).applyMatrix4(m)
      pos.setXYZ(idx * 4 + k, lp.x, lp.y, lp.z)
      col.setXYZ(idx * 4 + k, l.color.r, l.color.g, l.color.b)
    })
  }

  useLayoutEffect(() => {
    parked.forEach((c, j) => {
      obj.position.set(c.x, 0, c.z)
      obj.rotation.set(0, 0, 0)
      obj.scale.set(1, 1, 1)
      obj.updateMatrix()
      place(c, cars.length + j, obj.matrix)
    })
    fleets.forEach((f) => f.commit())
    glowGeo.attributes.position.needsUpdate = glowGeo.attributes.color.needsUpdate = true
    if (beamFRef.current) beamFRef.current.instanceMatrix.needsUpdate = true
    if (beamRRef.current) beamRRef.current.instanceMatrix.needsUpdate = true
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [models])

  // scratch arrays for the cars' positions and headings, so the cars can look at each other
  const N = cars.length
  const px = useMemo(() => new Float32Array(N), [N])
  const pz = useMemo(() => new Float32Array(N), [N])
  const hx = useMemo(() => new Float32Array(N), [N])
  const hz = useMemo(() => new Float32Array(N), [N])
  const live = useMemo(() => new Uint8Array(N), [N])

  const isWaiting = (c: Car, running: boolean) => {
    if (!c.waitsForHero) return false
    // the cars on the hero car's own lanes wait until its opening drive is over; avenue cars until it has passed the roundabout
    if (ROUTES[c.route].name.startsWith('ave-')) return !(running || hero.z < 55)
    return !running
  }

  useFrame(() => {
    const now = performance.now()
    const dt = Math.min((now - last.current) / 1000, 0.05)
    last.current = now
    const running = story.introDone

    // 1. where is everybody
    cars.forEach((c, i) => {
      const r = ROUTES[c.route]
      live[i] = !isWaiting(c, running) && c.s >= 0 ? 1 : 0
      const u = Math.max(0, Math.min(1, c.s / r.length))
      r.curve.getPointAt(u, pos)
      r.curve.getTangentAt(u, tan)
      px[i] = pos.x
      pz[i] = pos.z
      hx[i] = tan.x
      hz[i] = tan.z
    })

    // 2. decide speeds: follow the car in front, give way at junctions and in roundabouts
    cars.forEach((c, i) => {
      if (isWaiting(c, running)) return
      let target = c.v
      if (c.s >= 0) {
        const considerCrossing = c.stuck < 6
        for (let j = -1; j < N; j++) {
          // j = -1 is the hero car (always has the right of way)
          let ox: number, oz: number, ohx: number, ohz: number, oprio: number, ov: number
          if (j === -1) {
            ox = hero.x
            oz = hero.z
            ohx = Math.cos(hero.yaw)
            ohz = -Math.sin(hero.yaw)
            oprio = -1
            ov = 1
          } else {
            if (j === i || !live[j]) continue
            ox = px[j]
            oz = pz[j]
            ohx = hx[j]
            ohz = hz[j]
            oprio = cars[j].prio
            ov = cars[j].vNow
          }
          const dx = ox - px[i]
          const dz = oz - pz[i]
          if (dx * dx + dz * dz > 26 * 26) continue
          const ahead = dx * hx[i] + dz * hz[i]
          if (ahead < 0.3) continue
          const lateral = Math.abs(dx * hz[i] - dz * hx[i])
          if (lateral > 2.5) continue
          const dot = hx[i] * ohx + hz[i] * ohz
          if (dot > 0.55) {
            // same way: keep a gap (cars are ~4.5 m long)
            target = Math.min(target, Math.max(0, (ahead - 4.6 - 2.2) / 1.1))
          } else if (ahead < 17 && considerCrossing) {
            // crossing (or head-on) paths: the car with the lower priority waits; anything that is standing in the way is waited for
            const iYield = oprio < c.prio || (oprio === c.prio && j < i) || ov < 0.4
            if (iYield || j === -1) target = Math.min(target, Math.max(0, (ahead - 6) / 1.0))
          }
        }
      }
      c.vNow += (target - c.vNow) * Math.min(1, dt * 3.5)
      c.stuck = c.vNow < 0.25 && c.s >= 0 ? c.stuck + dt : 0
      c.s += c.vNow * dt
      c.dist += c.vNow * dt
      if (c.s >= ROUTES[c.route].length) c.s -= ROUTES[c.route].length
    })

    // 3. place the cars
    cars.forEach((c, i) => {
      const r = ROUTES[c.route]
      if (isWaiting(c, running) || c.s < 0) {
        place(c, i, hide, 0, true)
        return
      }
      const u = Math.max(0, Math.min(1, c.s / r.length))
      r.curve.getPointAt(u, pos)
      r.curve.getTangentAt(u, tan)
      const yaw = Math.atan2(-tan.z, tan.x)
      // steering from how fast the road turns over the next 2.5 m
      r.curve.getTangentAt(Math.min(1, u + 2.5 / r.length), tan2)
      let dyaw = Math.atan2(-tan2.z, tan2.x) - yaw
      if (dyaw > Math.PI) dyaw -= 2 * Math.PI
      if (dyaw < -Math.PI) dyaw += 2 * Math.PI
      const steer = Math.max(-0.5, Math.min(0.5, Math.atan((2.6 * dyaw) / 2.5)))
      obj.position.set(pos.x, roadY(pos.x, pos.z), pos.z)
      obj.rotation.set(0, yaw, 0)
      obj.scale.set(1, 1, 1)
      obj.updateMatrix()
      place(c, i, obj.matrix, steer)
    })
    fleets.forEach((f) => f.commit())
    glowGeo.attributes.position.needsUpdate = glowGeo.attributes.color.needsUpdate = true
    // the glows are barely there by day and bloom at night
    if (glowMat.current) glowMat.current.opacity = 0.12 + 0.88 * story.night
    if (beamFRef.current) beamFRef.current.instanceMatrix.needsUpdate = true
    if (beamRRef.current) beamRRef.current.instanceMatrix.needsUpdate = true
    // headlight pools are only a hint by day and strong at night
    beamFMat.opacity = 0.05 + 0.5 * story.night
    beamRMat.opacity = 0.03 + 0.4 * story.night
  })

  return (
    <group>
      {fleets.map((f, i) => (
        <primitive key={i} object={f.group} />
      ))}
      <instancedMesh ref={beamFRef} args={[beamFGeo, beamFMat, total * 2]} frustumCulled={false} renderOrder={1} />
      <instancedMesh ref={beamRRef} args={[beamRGeo, beamRMat, total * 2]} frustumCulled={false} renderOrder={1} />
      <points geometry={glowGeo} frustumCulled={false} renderOrder={2}>
        <pointsMaterial
          ref={glowMat}
          map={glowTex}
          vertexColors
          size={0.7}
          sizeAttenuation
          transparent
          opacity={0.12}
          depthWrite={false}
          blending={THREE.AdditiveBlending}
          toneMapped={false}
        />
      </points>
    </group>
  )
}
