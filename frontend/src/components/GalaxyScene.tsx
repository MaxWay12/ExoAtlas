import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Canvas, useFrame, useThree, type ThreeEvent } from '@react-three/fiber'
import { AdditiveBlending, CanvasTexture, Color, MathUtils, type Group } from 'three'
import type { SystemPoint } from '../api/types'
import { dustLayout, layoutSystems } from '../galaxy/layout'

const TILT = -0.95 // наклон диска к камере
const SPIN = 0.02 // рад/сек, медленное вращение

function makeSprite() {
  const canvas = document.createElement('canvas')
  canvas.width = canvas.height = 64
  const ctx = canvas.getContext('2d')!
  const g = ctx.createRadialGradient(32, 32, 0, 32, 32, 32)
  g.addColorStop(0, 'rgba(255,255,255,1)')
  g.addColorStop(0.35, 'rgba(255,255,255,.55)')
  g.addColorStop(1, 'rgba(255,255,255,0)')
  ctx.fillStyle = g
  ctx.fillRect(0, 0, 64, 64)
  return new CanvasTexture(canvas)
}

const COOL = new Color('#8fb4ff')
const WARM = new Color('#ffd88a')

interface SceneProps {
  points: SystemPoint[]
  selectedId: string | null
  onSelect: (id: string) => void
  onHover: (id: string | null, x: number, y: number) => void
}

function Zoom({ scale, onZoom }: { scale: number; onZoom: (delta: number) => void }) {
  const { camera, gl, size } = useThree()
  const fit = Math.min(1, size.width / Math.max(1, size.height))
  useEffect(() => {
    const el = gl.domElement
    const onWheel = (e: WheelEvent) => {
      e.preventDefault()
      onZoom(e.deltaY * -0.001)
    }
    el.addEventListener('wheel', onWheel, { passive: false })
    return () => el.removeEventListener('wheel', onWheel)
  }, [gl, onZoom])
  useFrame((_, delta) => { camera.position.z = MathUtils.damp(camera.position.z, 26 / (Math.max(fit, 0.25) * scale), 6, delta) })
  return null
}

function Galaxy({ points, selectedId, onSelect, onHover }: SceneProps) {
  const spin = useRef<Group>(null)
  const hovering = useRef(false)
  const sprite = useMemo(makeSprite, [])
  // positions[i] и points[i] — одна и та же система; индекс из клика берётся только отсюда
  const positions = useMemo(() => layoutSystems(points), [points])
  const colors = useMemo(() => {
    const arr = new Float32Array(points.length * 3)
    const c = new Color()
    points.forEach((p, i) => {
      c.copy(COOL).lerp(WARM, Math.min(1, (p.planet_count - 1) / 5))
      arr.set([c.r, c.g, c.b], i * 3)
    })
    return arr
  }, [points])
  const dust = useMemo(() => dustLayout(7000), [])
  const selectedIndex = useMemo(() => points.findIndex((p) => p.id === selectedId), [points, selectedId])
  const [hoverIndex, setHoverIndex] = useState<number | null>(null)

  useFrame((_, delta) => { if (spin.current && !hovering.current) spin.current.rotation.z += delta * SPIN })

  const highlight = hoverIndex ?? (selectedIndex >= 0 ? selectedIndex : null)

  return (
    <group rotation={[TILT, 0, 0]}>
      <group ref={spin}>
        {/* Декоративная пыль: не данные */}
        <points raycast={() => null}>
          <bufferGeometry>
            <bufferAttribute attach="attributes-position" count={dust.positions.length / 3} array={dust.positions} itemSize={3} />
            <bufferAttribute attach="attributes-color" count={dust.colors.length / 3} array={dust.colors} itemSize={3} />
          </bufferGeometry>
          <pointsMaterial size={0.55} map={sprite} vertexColors transparent opacity={0.1} depthWrite={false} blending={AdditiveBlending} />
        </points>
        <sprite scale={[5, 5, 1]} raycast={() => null}>
          <spriteMaterial map={sprite} color="#ffcf85" transparent opacity={0.55} depthWrite={false} blending={AdditiveBlending} />
        </sprite>

        {/* Системы из каталога */}
        <points
          onClick={(e: ThreeEvent<MouseEvent>) => { if (e.index !== undefined && points[e.index]) onSelect(points[e.index].id) }}
          onPointerMove={(e: ThreeEvent<PointerEvent>) => {
            if (e.index === undefined) return
            hovering.current = true
            setHoverIndex(e.index)
            onHover(points[e.index]?.id ?? null, e.nativeEvent.offsetX, e.nativeEvent.offsetY)
          }}
          onPointerOut={() => { hovering.current = false; setHoverIndex(null); onHover(null, 0, 0) }}
        >
          <bufferGeometry>
            <bufferAttribute attach="attributes-position" count={points.length} array={positions} itemSize={3} />
            <bufferAttribute attach="attributes-color" count={points.length} array={colors} itemSize={3} />
          </bufferGeometry>
          <pointsMaterial size={0.17} map={sprite} vertexColors transparent depthWrite={false} blending={AdditiveBlending} alphaTest={0.01} />
        </points>

        {highlight !== null && (
          <points key={highlight} raycast={() => null}>
            <bufferGeometry>
              <bufferAttribute attach="attributes-position" count={1} array={positions.slice(highlight * 3, highlight * 3 + 3)} itemSize={3} />
            </bufferGeometry>
            <pointsMaterial size={0.55} map={sprite} color="#ffffff" transparent depthWrite={false} blending={AdditiveBlending} />
          </points>
        )}
      </group>
    </group>
  )
}

export function GalaxyScene(props: SceneProps) {
  const [scale, setScale] = useState(1)
  const zoom = useCallback((delta: number) => setScale((value) => MathUtils.clamp(value + delta, 0.65, 3)), [])
  return (
    <>
      <Canvas
        camera={{ position: [0, 0, 26], fov: 50 }}
        dpr={[1, 1.5]}
        raycaster={{ params: { Points: { threshold: 0.13 } } } as never}
      >
        <Zoom scale={scale} onZoom={zoom} />
        <Galaxy {...props} />
      </Canvas>
      <div className="galaxy-zoom" aria-label="Масштаб карты" role="group">
        <button type="button" aria-label="Уменьшить масштаб" disabled={scale <= 0.65} onClick={() => zoom(-0.3)}>−</button>
        <button type="button" aria-label="Увеличить масштаб" disabled={scale >= 3} onClick={() => zoom(0.3)}>+</button>
      </div>
    </>
  )
}
