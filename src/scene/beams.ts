import * as THREE from 'three'

// The light that headlamps and tail lamps throw on the road: each lamp gets its own soft pool, a flat additive wedge lying
// just above the tarmac, brightest at the car and fading out ahead of it. Two lamps give two pools that overlap in the
// middle, so the light reads as two soft sources and not one thin stripe. Shared by the traffic and the hero car.
export function beamTexture() {
  const W = 128
  const H = 64
  const c = document.createElement('canvas')
  c.width = W
  c.height = H
  const g = c.getContext('2d')!
  const img = g.createImageData(W, H)
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const u = x / (W - 1)
      const v = (y / (H - 1)) * 2 - 1
      const w = 0.5 + 0.5 * u // the pool opens up with distance
      const edge = Math.exp(-1.7 * (v / w) * (v / w)) // soft sides, no hard edge
      const k = edge * Math.pow(1 - u, 1.5) * Math.min(1, u / 0.12 + 0.2)
      const a = Math.max(0, Math.min(255, Math.round(k * 255)))
      const i = (y * W + x) * 4
      img.data[i] = img.data[i + 1] = img.data[i + 2] = a
      img.data[i + 3] = 255
    }
  }
  g.putImageData(img, 0, 0)
  const t = new THREE.CanvasTexture(c)
  t.colorSpace = THREE.SRGBColorSpace
  return t
}

// a unit plane lying on the ground, running from the origin along +x (dir = 1) or -x (dir = -1)
export function beamGeometry(dir: number) {
  const g = new THREE.PlaneGeometry(1, 1)
  g.rotateX(-Math.PI / 2)
  g.translate(0.5 * dir, 0, 0)
  if (dir < 0) {
    // keep the texture's bright edge at the car
    const uv = g.attributes.uv as THREE.BufferAttribute
    for (let i = 0; i < uv.count; i++) uv.setX(i, 1 - uv.getX(i))
  }
  return g
}

export function beamMaterial(map: THREE.Texture, color: string, opacity: number) {
  return new THREE.MeshBasicMaterial({
    map,
    color,
    transparent: true,
    opacity,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    polygonOffset: true,
    polygonOffsetFactor: -2,
    polygonOffsetUnits: -2,
    toneMapped: false,
  })
}
