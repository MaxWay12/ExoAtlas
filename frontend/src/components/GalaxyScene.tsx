import { SkyStars } from './SpaceSky'
import { SOLAR_ID, SOLAR_NAME } from '../galaxy/solarSystem'
import { useCallback, useEffect, useImperativeHandle, useLayoutEffect, useMemo, useRef, useState, type MutableRefObject } from 'react'
import { Canvas, useFrame, useThree, type ThreeEvent } from '@react-three/fiber'
import { AdditiveBlending, CanvasTexture, Color, MathUtils, Points, type Group, type OrthographicCamera } from 'three'
import type { SystemPoint } from '../api/types'
import { dustLayout, layoutSystems, R_OUT } from '../galaxy/layout'

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

const MIN_SCALE = 0.65
const MAX_SCALE = 3
const MAP_HALF_WIDTH = R_OUT + 0.5
const MAP_HALF_HEIGHT = R_OUT * Math.cos(TILT) + 0.5
const DRAG_THRESHOLD = 5

const pickSystem: Points['raycast'] = function (this: Points, raycaster, hits) {
  const candidates: typeof hits = []
  Points.prototype.raycast.call(this, raycaster, candidates)
  const nearest = candidates.reduce<(typeof hits)[number] | undefined>((best, hit) =>
    !best || hit.distanceToRay! < best.distanceToRay! ? hit : best, undefined)
  if (nearest) hits.push(nearest)
}

type ZoomMap = (factor: number, x?: number, y?: number) => void

function clampCenter(view: OrthographicCamera, width: number, height: number) {
  const limitX = Math.max(0, MAP_HALF_WIDTH - width * 0.4 / view.zoom)
  const limitY = Math.max(0, MAP_HALF_HEIGHT - height * 0.4 / view.zoom)
  view.position.x = MathUtils.clamp(view.position.x, -limitX, limitX)
  view.position.y = MathUtils.clamp(view.position.y, -limitY, limitY)
  view.updateMatrixWorld()
}

function MapControls({ zoomMap, onScale, onPan }: {
  zoomMap: MutableRefObject<ZoomMap | null>
  onScale: (scale: number) => void
  onPan: (panning: boolean) => void
}) {
  const { camera, gl, size, get, raycaster } = useThree()
  const view = camera as OrthographicCamera
  const scale = useRef(1)

  // The orthographic frustum uses CSS pixels. Fit the entire tilted disk at scale 1.
  const fit = 0.88 * Math.min(
    Math.max(1, size.width) / (2 * MAP_HALF_WIDTH),
    Math.max(1, size.height) / (2 * MAP_HALF_HEIGHT),
  )

  useLayoutEffect(() => {
    raycaster.params.Points = { threshold: 5 / fit }
    view.zoom = fit * scale.current
    view.updateProjectionMatrix()
    clampCenter(view, size.width, size.height)
  }, [view, raycaster, fit, size.width, size.height])

  const zoom: ZoomMap = (factor, x = 0, y = 0) => {
    const next = MathUtils.clamp(scale.current * factor, MIN_SCALE, MAX_SCALE)
    if (next === scale.current) return

    const nextZoom = fit * next
    // Keep the same world point under the cursor unless the pan limit is reached.
    const offset = 1 / view.zoom - 1 / nextZoom
    view.position.x += x * offset
    view.position.y += y * offset
    view.zoom = nextZoom
    view.updateProjectionMatrix()
    clampCenter(view, size.width, size.height)
    scale.current = next
    onScale(next)
  }

  useImperativeHandle(zoomMap, () => zoom)

  useEffect(() => {
    const el = gl.domElement
    let drag: { id: number; x: number; y: number; moved: boolean } | undefined
    let suppressClick = false

    const wheel = (event: WheelEvent) => {
      event.preventDefault()
      const rect = el.getBoundingClientRect()
      const unit = event.deltaMode === 1 ? 16 : event.deltaMode === 2 ? rect.height : 1
      zoomMap.current?.(
        Math.exp(-MathUtils.clamp(event.deltaY * unit, -600, 600) * 0.002),
        event.clientX - rect.left - rect.width / 2,
        rect.top + rect.height / 2 - event.clientY,
      )
    }
    const down = (event: PointerEvent) => {
      if (!event.isPrimary || event.button !== 0) return
      suppressClick = false
      drag = { id: event.pointerId, x: event.clientX, y: event.clientY, moved: false }
    }
    const move = (event: PointerEvent) => {
      if (drag?.id !== event.pointerId) return
      const dx = event.clientX - drag.x
      const dy = event.clientY - drag.y
      if (!drag.moved) {
        if (Math.hypot(dx, dy) < DRAG_THRESHOLD) return
        drag.moved = true
        suppressClick = true
        el.setPointerCapture(event.pointerId)
        el.classList.add('is-panning')
        onPan(true)
      }
      drag.x = event.clientX
      drag.y = event.clientY
      view.position.x -= dx / view.zoom
      view.position.y += dy / view.zoom
      const { width, height } = get().size
      clampCenter(view, width, height)
    }
    const end = (event: PointerEvent) => {
      if (drag?.id !== event.pointerId) return
      const moved = drag.moved
      drag = undefined
      if (el.hasPointerCapture(event.pointerId)) el.releasePointerCapture(event.pointerId)
      el.classList.remove('is-panning')
      if (moved) onPan(false)
    }
    const leave = (event: PointerEvent) => {
      if (!drag?.moved) end(event)
    }
    const click = (event: MouseEvent) => {
      if (suppressClick) event.stopPropagation()
    }

    el.addEventListener('wheel', wheel, { passive: false })
    el.addEventListener('pointerdown', down)
    el.addEventListener('pointermove', move)
    el.addEventListener('pointerup', end)
    el.addEventListener('pointercancel', end)
    el.addEventListener('lostpointercapture', end)
    el.addEventListener('pointerleave', leave)
    el.addEventListener('click', click, true)
    return () => {
      el.removeEventListener('wheel', wheel)
      el.removeEventListener('pointerdown', down)
      el.removeEventListener('pointermove', move)
      el.removeEventListener('pointerup', end)
      el.removeEventListener('pointercancel', end)
      el.removeEventListener('lostpointercapture', end)
      el.removeEventListener('pointerleave', leave)
      el.removeEventListener('click', click, true)
    }
  }, [get, gl, view, zoomMap, onPan])

  return null
}

function Galaxy({ points, selectedId, onSelect, onHover, scale, panning, isPanning }: SceneProps & {
  scale: number
  panning: boolean
  isPanning: MutableRefObject<boolean>
}) {
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

  useEffect(() => {
    if (panning) {
      hovering.current = false
      setHoverIndex(null)
    }
  }, [panning])

  useFrame((_, delta) => { if (spin.current && !hovering.current && !isPanning.current && scale <= 1) spin.current.rotation.z += delta * SPIN })

  const highlight = (panning ? null : hoverIndex) ?? (selectedIndex >= 0 ? selectedIndex : null)

  return (
    <group rotation={[TILT, 0, 0]}>
      <group ref={spin}>
        {/* Декоративная пыль: не данные */}
        <points raycast={() => null}>
          <bufferGeometry>
            <bufferAttribute attach="attributes-position" count={dust.positions.length / 3} array={dust.positions} itemSize={3} />
            <bufferAttribute attach="attributes-color" count={dust.colors.length / 3} array={dust.colors} itemSize={3} />
          </bufferGeometry>
          <pointsMaterial size={5 * scale} map={sprite} vertexColors transparent opacity={0.1} depthWrite={false} blending={AdditiveBlending} />
        </points>
        <sprite scale={[5, 5, 1]} raycast={() => null}>
          <spriteMaterial map={sprite} color="#ffcf85" transparent opacity={0.55} depthWrite={false} blending={AdditiveBlending} />
        </sprite>
        <mesh
          onClick={(event) => { event.stopPropagation(); onSelect(SOLAR_ID) }}
          onPointerMove={(event) => {
            if (isPanning.current) return
            event.stopPropagation()
            onHover(SOLAR_ID, event.nativeEvent.offsetX, event.nativeEvent.offsetY)
          }}
          onPointerOut={() => onHover(null, 0, 0)}
        >
          <sphereGeometry args={[0.26, 20, 16]} />
          <meshBasicMaterial color="#fff0a4" />
        </mesh>

        {/* Системы из каталога */}
        <points
          raycast={pickSystem}
          onClick={(e: ThreeEvent<MouseEvent>) => { if (e.index !== undefined && points[e.index]) onSelect(points[e.index].id) }}
          onPointerMove={(e: ThreeEvent<PointerEvent>) => {
            if (isPanning.current || e.index === undefined) return
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
          <pointsMaterial size={3.8 * scale} map={sprite} vertexColors toneMapped={false} transparent depthWrite={false} blending={AdditiveBlending} alphaTest={0.01} />
        </points>

        {highlight !== null && (
          <points key={highlight} raycast={() => null}>
            <bufferGeometry>
              <bufferAttribute attach="attributes-position" count={1} array={positions.slice(highlight * 3, highlight * 3 + 3)} itemSize={3} />
            </bufferGeometry>
            <pointsMaterial size={7 * scale} map={sprite} color="#ffffff" transparent depthWrite={false} blending={AdditiveBlending} />
          </points>
        )}
      </group>
    </group>
  )
}

export function GalaxyScene(props: SceneProps) {
  const [scale, setScale] = useState(1)
  const zoomMap = useRef<ZoomMap | null>(null)
  const isPanning = useRef(false)
  const [panning, setPanning] = useState(false)
  const onHover = useRef(props.onHover)
  useLayoutEffect(() => { onHover.current = props.onHover }, [props.onHover])
  const onPan = useCallback((active: boolean) => {
    isPanning.current = active
    setPanning(active)
    if (active) onHover.current(null, 0, 0)
  }, [])
  return (
    <>
      <Canvas
        className="galaxy-map-view"
        orthographic
        camera={{ position: [0, 0, 26], near: 0.1, far: 100 }}
        dpr={[1, 1.5]}
      >
        <MapControls zoomMap={zoomMap} onScale={setScale} onPan={onPan} />
        <SkyStars fixed subtle />
        <Galaxy {...props} scale={scale} panning={panning} isPanning={isPanning} />
      </Canvas>
      <div className="galaxy-zoom" aria-label="Масштаб карты" role="group">
        <button type="button" onClick={() => props.onSelect(SOLAR_ID)}>{SOLAR_NAME}</button>
        <button type="button" aria-label="Уменьшить масштаб" disabled={scale <= MIN_SCALE} onClick={() => zoomMap.current?.(1 / 1.3)}>−</button>
        <button type="button" aria-label="Увеличить масштаб" disabled={scale >= MAX_SCALE} onClick={() => zoomMap.current?.(1.3)}>+</button>
      </div>
    </>
  )
}
