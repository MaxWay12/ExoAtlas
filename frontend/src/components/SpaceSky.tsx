import { useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import type { BufferAttribute, Points } from 'three'

export function SpaceSky() {
  return <div className="space-sky" aria-hidden="true"><div className="shooting-stars"><span /><span /></div></div>
}

export function SkyStars({ fixed = false, subtle = false }: { fixed?: boolean; subtle?: boolean }) {
  const count = 600
  const field = useRef<Points>(null)
  const colors = useRef<BufferAttribute>(null)
  const motion = useMemo(() => window.matchMedia('(prefers-reduced-motion: reduce)'), [])
  const stars = useMemo(() => {
    const positions = new Float32Array(count * 3)
    const brightness = new Float32Array(count * 3).fill(0.72)
    const phases = new Float32Array(count)
    const speeds = new Float32Array(count)
    for (let i = 0; i < count; i++) {
      positions[i * 3] = (Math.random() - 0.5) * 40
      positions[i * 3 + 1] = (Math.random() - 0.5) * 24
      positions[i * 3 + 2] = -5 - Math.random() * 10
      phases[i] = Math.random() * Math.PI * 2
      speeds[i] = 0.8 + Math.random() * 2
    }
    return { positions, brightness, phases, speeds }
  }, [count])

  useFrame(({ camera, clock, size }) => {
    if (fixed && field.current) {
      field.current.position.set(camera.position.x, camera.position.y, -16)
      field.current.scale.set(size.width / (40 * camera.zoom), size.height / (24 * camera.zoom), 1)
    }
    const attribute = colors.current
    if (!attribute || motion.matches) return
    const time = clock.elapsedTime
    for (let i = 0; i < count; i++) {
      const light = 0.58 + 0.39 * Math.sin(stars.phases[i] + time * stars.speeds[i])
      attribute.setXYZ(i, light * 0.85, light * 0.93, light)
    }
    attribute.needsUpdate = true
  })

  return (
    <points ref={field} frustumCulled={!fixed} raycast={() => null}>
      <bufferGeometry>
        <bufferAttribute attach="attributes-position" count={count} array={stars.positions} itemSize={3} />
        <bufferAttribute ref={colors} attach="attributes-color" count={count} array={stars.brightness} itemSize={3} />
      </bufferGeometry>
      <pointsMaterial
        size={(fixed ? 1.4 : 0.08) * (subtle ? 0.65 : 1)}
        color={subtle ? '#8c9dbd' : '#ffffff'}
        vertexColors
      />
    </points>
  )
}
