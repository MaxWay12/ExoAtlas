import { useEffect, useMemo } from 'react'
import { DataTexture, LinearFilter, LinearMipmapLinearFilter, RepeatWrapping } from 'three'
import { hash01 } from '../galaxy/layout'

const WIDTH = 256
const HEIGHT = 128
const OCTAVES = [3, 7, 15, 33, 71]

function makeSurface(id: string, banded: boolean) {
  const seed = hash01(id) * 100
  const pixels = new Uint8Array(WIDTH * HEIGHT * 4)

  for (let row = 0; row < HEIGHT; row++) {
    const latitude = Math.PI * ((row + 0.5) / HEIGHT - 0.5)
    const y = Math.sin(latitude)
    const ring = Math.cos(latitude)

    for (let col = 0; col < WIDTH; col++) {
      const longitude = 2 * Math.PI * (col + 0.5) / WIDTH
      const x = ring * Math.cos(longitude)
      const z = ring * Math.sin(longitude)

      // Sampling the sphere in 3D avoids a seam where the UV edges meet.
      let terrain = 0
      let weight = 1
      for (const frequency of OCTAVES) {
        const a = Math.sin(frequency * (x + 0.37 * z) + seed)
        const b = Math.sin(frequency * (y - 0.31 * x) + seed * 0.71)
        const c = Math.sin(frequency * (z + 0.41 * y) - seed * 0.53)
        terrain += (a * b + b * c + c * a) * weight / 3
        weight *= 0.55
      }

      const bands = Math.sin(26 * y + 2.8 * terrain + seed)
      const shade = banded ? 0.69 + 0.17 * bands + 0.14 * terrain
        : 0.71 + 0.16 * Math.tanh(4 * terrain) + 0.15 * terrain
      const offset = (row * WIDTH + col) * 4
      const value = Math.round(Math.min(1, Math.max(0, shade)) * 255)
      pixels[offset] = pixels[offset + 1] = pixels[offset + 2] = value
      pixels[offset + 3] = 255
    }
  }

  const texture = new DataTexture(pixels, WIDTH, HEIGHT)
  texture.wrapS = RepeatWrapping
  texture.magFilter = LinearFilter
  texture.minFilter = LinearMipmapLinearFilter
  texture.generateMipmaps = true
  texture.needsUpdate = true
  return texture
}

export function PlanetSurface({ id, color, banded }: { id: string; color: string; banded: boolean }) {
  const map = useMemo(() => makeSurface(id, banded), [id, banded])
  useEffect(() => () => map.dispose(), [map])
  return <meshStandardMaterial color={color} map={map} roughness={0.95} />
}
