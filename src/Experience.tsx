import { useEffect, useState } from 'react'
import { Canvas, useThree } from '@react-three/fiber'
import * as THREE from 'three'
import { story, type Quality } from './story'
import { World } from './World'

// Rendering is driven by the scroll ticker (one clock for Lenis, GSAP and the 3D scene),
// so R3F's own loop is switched off and we call advance() ourselves.
function Driver() {
  const advance = useThree((s) => s.advance)
  useEffect(() => {
    story.advance = (t) => advance(t)
    return () => {
      story.advance = null
    }
  }, [advance])
  return null
}

export default function Experience({ quality, onReady }: { quality: Quality; onReady: () => void }) {
  const max = quality === 'high' ? 2 : 1.5
  const [dpr, setDpr] = useState(() => Math.min(window.devicePixelRatio || 1, max))

  // The ticker calls this when frames stay slow. We lower resolution one step at a time.
  useEffect(() => {
    story.onSlow = () => setDpr((d) => Math.max(1, +(d - 0.5).toFixed(1)))
    return () => {
      story.onSlow = null
    }
  }, [])

  return (
    <Canvas
      className="gl"
      frameloop="never"
      dpr={dpr}
      camera={{ fov: 34, near: 0.25, far: 260, position: [3.2, 1.7, 8.4] }}
      gl={{ antialias: true, powerPreference: 'high-performance' }}
      onCreated={({ gl }) => {
        gl.toneMapping = THREE.NeutralToneMapping
        gl.toneMappingExposure = 1
        onReady()
      }}
      aria-hidden="true"
    >
      <color attach="background" args={['#F3F8FE']} />
      <fog attach="fog" args={['#F3F8FE', 16, 90]} />
      <Driver />
      <World quality={quality} />
    </Canvas>
  )
}
