import { useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import { Environment, Lightformer } from '@react-three/drei'
import * as THREE from 'three'
import { story, type Quality } from './story'
import { applyCamera } from './camera'
import { Car } from './scene/Car'
import { Charger } from './scene/Charger'
import { Road } from './scene/Road'

// Dev only: ?cam=x,y,z,tx,ty,tz,fov pins the camera so a part can be inspected from any angle.
const dbg = import.meta.env.DEV ? new URLSearchParams(location.search).get('cam') : null

export function World({ quality }: { quality: Quality }) {
  const high = quality === 'high'

  // Our own clock in seconds. The render loop is driven by the scroll ticker, so R3F's clock is not seconds.
  const time = useRef(0)

  useFrame((state, delta) => {
    time.current += Math.min(delta, 0.1)
    const cam = state.camera as THREE.PerspectiveCamera
    if (dbg) {
      const v = dbg.split(',').map(Number)
      cam.position.set(v[0], v[1], v[2])
      cam.lookAt(v[3], v[4], v[5])
      cam.fov = v[6] || 30
      cam.updateProjectionMatrix()
    } else {
      applyCamera(cam, story.smooth, state.size.width / state.size.height, time.current, state.size.width)
    }
    if (import.meta.env.DEV) (window as unknown as { __info: unknown }).__info = { calls: state.gl.info.render.calls, tris: state.gl.info.render.triangles, x: cam.position.x, y: cam.position.y }
  })

  return (
    <>
      <ambientLight intensity={0.45} />
      <directionalLight position={[6, 9, 7]} intensity={2.1} color="#fffaf2" />

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
      <Car high={high} />
      <Charger high={high} />
    </>
  )
}
