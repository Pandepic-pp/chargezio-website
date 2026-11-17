import * as THREE from 'three'
import { useGLTF } from '@react-three/drei'
import { attachInk } from './ink'

// Instancing for glTF models: every mesh of the model becomes an InstancedMesh with the same instance matrices, so a
// whole model (many materials) is drawn for N instances with one draw call per material.

const BASE = import.meta.env.BASE_URL
useGLTF.setDecoderPath(BASE + 'draco/')

export const modelUrl = (name: string) => BASE + 'models/city/' + name + '.glb'

export type Fleet = {
  group: THREE.Group
  setPhase: (i: number, v: number) => void
  set: (i: number, m: THREE.Matrix4) => void
  commit: () => void
  dispose: () => void
}

const tmp = new THREE.Matrix4()

// `root`: the part of the loaded scene to instance (the whole scene, or one named node of it)
export function buildFleet(root: THREE.Object3D, count: number, ink = false, walk = false): Fleet {
  root.updateWorldMatrix(true, true)
  const inv = new THREE.Matrix4().copy(root.matrixWorld).invert()
  const group = new THREE.Group()
  const parts: { im: THREE.InstancedMesh; local: THREE.Matrix4 }[] = []
  let biggest: { im: THREE.InstancedMesh; tris: number } | null = null
  root.traverse((o) => {
    const m = o as THREE.Mesh
    if (!m.isMesh) return
    let geometry = m.geometry
    let material = m.material as THREE.Material
    if (walk) {
      // per-instance walking phase, and a vertex shader that poses the (T-posed) model walking
      geometry = geometry.clone()
      geometry.setAttribute('aPhase', new THREE.InstancedBufferAttribute(new Float32Array(count), 1))
      material = material.clone()
      patchWalking(material as THREE.MeshStandardMaterial)
    }
    const im = new THREE.InstancedMesh(geometry, material, count)
    im.frustumCulled = false
    im.instanceMatrix.setUsage(THREE.DynamicDrawUsage)
    const local = new THREE.Matrix4().multiplyMatrices(inv, m.matrixWorld)
    parts.push({ im, local })
    group.add(im)
    const mat = material
    const tris = (m.geometry.index ? m.geometry.index.count : m.geometry.attributes.position.count) / 3
    if (!mat.transparent && (!biggest || tris > biggest.tris)) biggest = { im, tris }
  })
  const cleanups: (() => void)[] = []
  if (ink && biggest) cleanups.push(attachInk((biggest as { im: THREE.InstancedMesh }).im, { width: 1.5 }))
  return {
    group,
    setPhase(i, v) {
      for (const p of parts) {
        const a = p.im.geometry.getAttribute('aPhase') as THREE.InstancedBufferAttribute | undefined
        if (a) a.setX(i, v)
      }
    },
    set(i, m) {
      for (const p of parts) {
        tmp.multiplyMatrices(m, p.local)
        p.im.setMatrixAt(i, tmp)
      }
    },
    commit() {
      for (const p of parts) {
        p.im.instanceMatrix.needsUpdate = true
        const a = p.im.geometry.getAttribute('aPhase') as THREE.InstancedBufferAttribute | undefined
        if (a) a.needsUpdate = true
      }
    },
    dispose() {
      cleanups.forEach((c) => c())
    },
  }
}


// The citizens are modelled in a T/A-pose. This poses them in the vertex shader: arms are brought down to the sides and swing,
// legs swing from the hip, all driven by the per-instance phase. Model space: x forward, y up, z across the shoulders,
// about 1.72 m tall (shoulder joints near y = 1.40, z = +-0.19; hips near y = 0.92).
function patchWalking(mat: THREE.MeshStandardMaterial) {
  mat.customProgramCacheKey = () => 'walking-citizen'
  mat.onBeforeCompile = (shader) => {
    shader.vertexShader = shader.vertexShader
      .replace(
        '#include <common>',
        `#include <common>
attribute float aPhase;
vec2 rot2(vec2 q, float a) { float c = cos(a); float s = sin(a); return vec2(q.x * c - q.y * s, q.x * s + q.y * c); }
vec3 walkPose(vec3 p, float ph) {
  float side = smoothstep(-0.04, 0.04, p.z) * 2.0 - 1.0; // +1 one side, -1 the other
  float legPhase = ph + (side > 0.0 ? 0.0 : 3.14159);
  // arms: rest pose from the T/A-pose (hand turned edge-on, relaxed elbow, hanging at the side), then swing against the legs
  float aw = smoothstep(0.17, 0.33, abs(p.z)) * smoothstep(1.0, 1.15, p.y);
  if (aw > 0.0) {
    float sgn = p.z > 0.0 ? 1.0 : -1.0;
    float al = abs(p.z) - 0.19; // distance along the arm from the shoulder
    // hand: turn it so it hangs edge-on instead of showing its flat side
    float hw = smoothstep(0.27, 0.40, al);
    vec2 xy0 = rot2(vec2(p.x, p.y - 1.40), sgn * 0.9 * hw);
    p.x = xy0.x;
    p.y = 1.40 + xy0.y;
    // elbow: the forearm bends forward, more as the arm swings forward
    float fb = smoothstep(0.12, 0.30, al);
    float beta = fb * 0.2;
    vec2 xa = rot2(vec2(p.x, al - 0.22), -beta);
    p.x = xa.x;
    p.z = sgn * (0.19 + xa.y + 0.22);
    // hang from the shoulder
    vec2 yz = vec2(p.y - 1.40, p.z - sgn * 0.19);
    yz = rot2(yz, sgn * 0.95 * aw);
    p.y = 1.40 + yz.x;
    p.z = sgn * 0.19 + yz.y;
    // swing
    vec2 xy = vec2(p.x, p.y - 1.40);
    xy = rot2(xy, -sin(legPhase) * 0.22 * aw);
    p.x = xy.x;
    p.y = 1.40 + xy.y;
  }
  // legs: swing from the hip
  float lw = (1.0 - smoothstep(0.62, 0.95, p.y)) * (1.0 - aw);
  if (lw > 0.0) {
    vec2 xy = vec2(p.x, p.y - 0.95);
    xy = rot2(xy, sin(legPhase) * 0.38 * lw);
    p.x = xy.x;
    p.y = 0.95 + xy.y;
  }
  return p;
}`,
      )
      .replace('#include <begin_vertex>', '#include <begin_vertex>\ntransformed = walkPose(transformed, aPhase);')
  }
}
