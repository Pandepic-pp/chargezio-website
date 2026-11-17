import { useLoader } from '@react-three/fiber'
import { GLTFLoader, type GLTF } from 'three/examples/jsm/loaders/GLTFLoader.js'
import { DRACOLoader } from 'three/examples/jsm/loaders/DRACOLoader.js'

// Loading models with the Draco decoder that ships with the site (public/draco: the WebAssembly one only). This does the one
// job we used @react-three/drei's useGLTF for, without pulling that library in.
const BASE = import.meta.env.BASE_URL

let draco: DRACOLoader | null = null
const extend = (loader: GLTFLoader) => {
  if (!draco) {
    draco = new DRACOLoader()
    draco.setDecoderPath({ js: BASE + 'draco/draco_wasm_wrapper.js', wasm: BASE + 'draco/draco_decoder.wasm' })
    draco.setDecoderConfig({ type: 'wasm' })
  }
  loader.setDRACOLoader(draco)
}

export function useGLTF(path: string): GLTF
export function useGLTF(path: string[]): GLTF[]
export function useGLTF(path: string | string[]): GLTF | GLTF[] {
  return useLoader(GLTFLoader, path as string, extend) as GLTF | GLTF[]
}
useGLTF.preload = (path: string | string[]) => useLoader.preload(GLTFLoader, path as string, extend)
