import { useLayoutEffect, type RefObject } from 'react'
import * as THREE from 'three'

// Ink outlines: an inverted hull drawn behind a mesh, pushed out by a distance that keeps the line about
// the same width on screen at any range. It gives the street and the charger the same drawn-edge look as the car.
//
//   box = true   the mesh is a unit box scaled per instance (buildings): every axis grows by the line width
//   box = false  the hull grows along the vertex normal (rounded or smooth parts)

const VERT = /* glsl */ `
#include <fog_pars_vertex>
uniform float uPx;      // world metres per pixel at distance 1
uniform float uWidth;   // line width in pixels
uniform float uMin;
uniform float uMax;
uniform float uBox;
void main() {
  mat4 m = modelMatrix;
  #ifdef USE_INSTANCING
    m = m * instanceMatrix;
  #endif
  vec3 sc = vec3(length(m[0].xyz), length(m[1].xyz), length(m[2].xyz));
  vec4 wp0 = m * vec4(position, 1.0);
  float dist = length((viewMatrix * wp0).xyz);
  float w = clamp(dist * uPx * uWidth, uMin, uMax);
  vec3 p = position;
  if (uBox > 0.5) {
    p += sign(position) * w / sc;
  } else {
    p += normalize(normal) * w / ((sc.x + sc.y + sc.z) / 3.0);
  }
  vec4 mvPosition = viewMatrix * m * vec4(p, 1.0);
  gl_Position = projectionMatrix * mvPosition;
  #include <fog_vertex>
}
`

const FRAG = /* glsl */ `
#include <fog_pars_fragment>
uniform vec3 uColor;
void main() {
  gl_FragColor = vec4(uColor, 1.0);
  #include <fog_fragment>
}
`

export const INK = '#1f232a'

export function makeInkMaterial(opts: { box?: boolean; width?: number; min?: number; max?: number; color?: string } = {}) {
  const mat = new THREE.ShaderMaterial({
    vertexShader: VERT,
    fragmentShader: FRAG,
    side: THREE.BackSide,
    fog: true,
    uniforms: THREE.UniformsUtils.merge([
      THREE.UniformsLib.fog,
      {
        uPx: { value: 0.001 },
        uWidth: { value: opts.width ?? 2 },
        uMin: { value: opts.min ?? 0.006 },
        uMax: { value: opts.max ?? 0.6 },
        uBox: { value: opts.box ? 1 : 0 },
        uColor: { value: new THREE.Color(opts.color ?? INK) },
      },
    ]),
  })
  const size = new THREE.Vector2()
  mat.onBeforeRender = (renderer, _scene, camera) => {
    renderer.getDrawingBufferSize(size)
    const cam = camera as THREE.PerspectiveCamera
    // world size of one drawing-buffer pixel at distance 1
    mat.uniforms.uPx.value = (2 * Math.tan((cam.fov * Math.PI) / 360)) / Math.max(1, size.y)
  }
  return mat
}

// Adds the outline as a child of `src` (instanced meshes share the instance matrices). Returns a cleanup function.
export function attachInk(src: THREE.Mesh, opts: Parameters<typeof makeInkMaterial>[0] = {}) {
  const mat = makeInkMaterial(opts)
  let ink: THREE.Mesh
  const im = src as THREE.InstancedMesh
  if (im.isInstancedMesh) {
    const k = new THREE.InstancedMesh(im.geometry, mat, im.count)
    k.instanceMatrix = im.instanceMatrix
    ink = k
  } else {
    ink = new THREE.Mesh(src.geometry, mat)
  }
  ink.frustumCulled = false
  ink.renderOrder = src.renderOrder - 1
  src.add(ink)
  return () => {
    src.remove(ink)
    mat.dispose()
  }
}

export function useInk(ref: RefObject<THREE.Mesh | null>, opts: Parameters<typeof makeInkMaterial>[0] = {}) {
  useLayoutEffect(() => {
    if (!ref.current) return
    return attachInk(ref.current, opts)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])
}

// ------------------------------------------------------------------ lamp halo
// A soft additive glow around a lit part (tail lamp strips, emblem, DRL): two inflated copies of the mesh with
// additive blending. `level` (0..1) is set every frame by the car.
const HALO_FRAG = /* glsl */ `
#include <fog_pars_fragment>
uniform vec3 uColor;
uniform float uOpacity;
void main() {
  gl_FragColor = vec4(uColor, uOpacity);
}
`

export function makeHalo(src: THREE.Mesh, color: string, widths: [number, number] = [5, 13]) {
  const mats: THREE.ShaderMaterial[] = []
  const meshes: THREE.Mesh[] = []
  const size = new THREE.Vector2()
  widths.forEach((w, i) => {
    const mat = new THREE.ShaderMaterial({
      vertexShader: VERT,
      fragmentShader: HALO_FRAG,
      side: THREE.BackSide,
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      uniforms: THREE.UniformsUtils.merge([
        THREE.UniformsLib.fog,
        {
          uPx: { value: 0.001 },
          uWidth: { value: w },
          uMin: { value: 0.002 },
          uMax: { value: 0.12 },
          uBox: { value: 0 },
          uColor: { value: new THREE.Color(color) },
          uOpacity: { value: 0 },
        },
      ]),
    })
    // the shared vertex shader includes fog_vertex; the halo ignores fog so it stays visible in the distance
    mat.onBeforeRender = (renderer, _scene, camera) => {
      renderer.getDrawingBufferSize(size)
      mat.uniforms.uPx.value = (2 * Math.tan(((camera as THREE.PerspectiveCamera).fov * Math.PI) / 360)) / Math.max(1, size.y)
    }
    const m = new THREE.Mesh(src.geometry, mat)
    m.frustumCulled = false
    m.renderOrder = 6 + i
    src.add(m)
    mats.push(mat)
    meshes.push(m)
  })
  return {
    set(level: number) {
      mats[0].uniforms.uOpacity.value = 0.95 * level
      mats[1].uniforms.uOpacity.value = 0.38 * level
      for (const m of meshes) m.visible = level > 0.01
    },
    dispose() {
      for (const m of meshes) src.remove(m)
      for (const m of mats) m.dispose()
    },
  }
}
