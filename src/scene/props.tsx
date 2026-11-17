import { useLayoutEffect, useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js'
import { story } from '../story'
import { merge } from './math'
import { useInk } from './ink'
import { makeRadial } from './textures'

// Street furniture for the new parts of the city: lamp posts that glow at night, and trees. Instanced.

export function seeded(seed: number) {
  let s = seed >>> 0
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0
    return s / 4294967296
  }
}

export type Item = { x: number; z: number; y?: number; rot?: number; s?: number }

function useItems(items: Item[]) {
  const ref = useRef<THREE.InstancedMesh>(null)
  useLayoutEffect(() => {
    const m = ref.current!
    const o = new THREE.Object3D()
    items.forEach((it, i) => {
      o.position.set(it.x, it.y ?? 0, it.z)
      o.rotation.set(0, it.rot ?? 0, 0)
      o.scale.setScalar(it.s ?? 1)
      o.updateMatrix()
      m.setMatrixAt(i, o.matrix)
    })
    m.instanceMatrix.needsUpdate = true
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [items])
  return ref
}

// rot: the lamp arm reaches along local +x; rotation.y = -PI/2 points it along world +z
export function Lamps({ items }: { items: Item[] }) {
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
  const lampGeo = useMemo(() => {
    const g = new THREE.PlaneGeometry(0.58, 0.2)
    g.rotateX(Math.PI / 2)
    g.translate(1.25, 6.225, 0)
    return g
  }, [])
  const poolGeo = useMemo(() => {
    const g = new THREE.PlaneGeometry(11, 11)
    g.rotateX(-Math.PI / 2)
    g.translate(0, 0.02, 0)
    return g
  }, [])
  const poolTex = useMemo(() => makeRadial('rgba(255,214,150,0.95)', 'rgba(255,214,150,0)'), [])
  const post = useItems(items)
  const head = useItems(items)
  // light pools sit where the lamp head hangs (1.25 m along the arm), not under the pole
  const poolItems = useMemo(
    () =>
      items.map((it) => {
        const rot = it.rot ?? 0
        return { ...it, x: it.x + Math.cos(rot) * 1.25 * 1, z: it.z - Math.sin(rot) * 1.25 }
      }),
    [items],
  )
  const pool = useItems(poolItems)
  useInk(post, { width: 1.8 })
  const headMat = useRef<THREE.MeshBasicMaterial>(null)
  const poolMat = useRef<THREE.MeshBasicMaterial>(null)
  const cool = useMemo(() => new THREE.Color('#8a919a'), [])
  const warm = useMemo(() => new THREE.Color('#fff0c8'), [])
  useFrame(() => {
    const n = story.night
    if (headMat.current) headMat.current.color.lerpColors(cool, warm, n)
    if (poolMat.current) poolMat.current.opacity = 0.55 * n
  })
  return (
    <>
      <instancedMesh ref={post} args={[geo, undefined, items.length]} frustumCulled={false}>
        <meshStandardMaterial color="#59616c" roughness={0.55} metalness={0.5} />
      </instancedMesh>
      <instancedMesh ref={head} args={[lampGeo, undefined, items.length]} frustumCulled={false}>
        <meshBasicMaterial ref={headMat} color="#8a919a" toneMapped={false} />
      </instancedMesh>
      <instancedMesh ref={pool} args={[poolGeo, undefined, items.length]} frustumCulled={false} renderOrder={3}>
        <meshBasicMaterial ref={poolMat} map={poolTex} transparent opacity={0} depthWrite={false} blending={THREE.AdditiveBlending} toneMapped={false} />
      </instancedMesh>
    </>
  )
}

export function makeTreeGeometry() {
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
}

export function TreeSet({ items }: { items: Item[] }) {
  const geo = useMemo(makeTreeGeometry, [])
  const ref = useItems(items)
  useInk(ref, { width: 1.8 })
  return (
    <instancedMesh ref={ref} args={[geo, undefined, items.length]} frustumCulled={false}>
      <meshStandardMaterial vertexColors roughness={0.9} />
    </instancedMesh>
  )
}
