import { useLayoutEffect, useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { useGLTF } from '@react-three/drei'
import { story } from '../story'
import { merge } from './math'
import { buildFleet, modelUrl } from './fleet'
import { LANE1, ROUTES, hero, roadY } from './cityLayout'
import { seeded } from './props'

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

function useLampGeometry() {
  return useMemo(() => {
    const lampGeos: THREE.BufferGeometry[] = []
    const paint = (g: THREE.BufferGeometry, hex: string) => {
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
    for (const z of [-0.62, 0.62]) {
      const f = new THREE.BoxGeometry(0.1, 0.12, 0.34)
      f.translate(2.06, 0.74, z)
      lampGeos.push(paint(f.toNonIndexed(), '#fff6dc'))
      const r = new THREE.BoxGeometry(0.1, 0.12, 0.38)
      r.translate(-2.06, 0.76, z)
      lampGeos.push(paint(r.toNonIndexed(), '#ff2a1c'))
    }
    return merge(lampGeos)
  }, [])
}

export function Traffic({ high }: { high: boolean }) {
  const gltfs = useGLTF(URLS)
  const lampGeo = useLampGeometry()
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
        return { body, wheels }
      }),
    [gltfs, counts],
  )
  if (import.meta.env.DEV) (window as unknown as { __trafficModels: unknown }).__trafficModels = models
  const fleets = useMemo(() => models.flatMap((m) => [m.body, ...m.wheels.map((w) => w.fleet)]), [models])
  useLayoutEffect(() => () => fleets.forEach((f) => f.dispose()), [fleets])

  const total = cars.length + parked.length
  const lampRef = useRef<THREE.InstancedMesh>(null)
  const lampMat = useRef<THREE.MeshBasicMaterial>(null)

  const obj = useMemo(() => new THREE.Object3D(), [])
  const tan = useMemo(() => new THREE.Vector3(), [])
  const pos = useMemo(() => new THREE.Vector3(), [])
  const tan2 = useMemo(() => new THREE.Vector3(), [])
  const hide = useMemo(() => new THREE.Matrix4().makeScale(0, 0, 0), [])
  const dimLamp = useMemo(() => new THREE.Color('#9a9a9a'), [])
  const brightLamp = useMemo(() => new THREE.Color('#ffffff'), [])
  const lampScale = useMemo(() => new THREE.Matrix4(), [])
  const lampMatrix = useMemo(() => new THREE.Matrix4(), [])
  const last = useRef(performance.now())

  const wm = useMemo(() => new THREE.Matrix4(), [])
  const wt = useMemo(() => new THREE.Matrix4(), [])
  const wr = useMemo(() => new THREE.Matrix4(), [])
  const place = (car: { model: number; slot: number; dist?: number }, idx: number, m: THREE.Matrix4, scaleX: number, steer = 0, hidden = false) => {
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
    // lamps: same pose, stretched to the model's length
    lampScale.makeScale(scaleX, 1, 1)
    lampMatrix.multiplyMatrices(m, lampScale)
    lampRef.current!.setMatrixAt(idx, lampMatrix)
  }

  useLayoutEffect(() => {
    parked.forEach((c, j) => {
      obj.position.set(c.x, 0, c.z)
      obj.rotation.set(0, 0, 0)
      obj.scale.set(1, 1, 1)
      obj.updateMatrix()
      place(c, cars.length + j, obj.matrix, MODELS[c.model].length / 4.1)
    })
    fleets.forEach((f) => f.commit())
    lampRef.current!.instanceMatrix.needsUpdate = true
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
      const sx = MODELS[c.model].length / 4.1
      if (isWaiting(c, running) || c.s < 0) {
        place(c, i, hide, sx, 0, true)
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
      place(c, i, obj.matrix, sx, steer)
    })
    fleets.forEach((f) => f.commit())
    lampRef.current!.instanceMatrix.needsUpdate = true
    // lamps are brighter at night
    if (lampMat.current) lampMat.current.color.lerpColors(dimLamp, brightLamp, story.night)
  })

  return (
    <group>
      {fleets.map((f, i) => (
        <primitive key={i} object={f.group} />
      ))}
      <instancedMesh ref={lampRef} args={[lampGeo, undefined, total]} frustumCulled={false}>
        <meshBasicMaterial ref={lampMat} vertexColors color="#9a9a9a" toneMapped={false} />
      </instancedMesh>
    </group>
  )
}
