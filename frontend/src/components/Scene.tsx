import { SkyStars } from './SpaceSky'
import { useEffect, useRef, type MutableRefObject } from 'react'
import { Canvas, useFrame, useThree } from '@react-three/fiber'
import { DoubleSide, MathUtils, PerspectiveCamera, type Group } from 'three'
import type { Planet } from '../api/types'
import { PlanetLabel } from './PlanetLabel'
import { PlanetSurface } from './PlanetSurface'

const A = 5.5 // радиус орбиты (орбита круглая, наклон даёт вид сбоку)
const B = 5.5
const TILT = -1.3 // наклон орбиты, рад: минус — камера смотрит сверху, плюс — снизу (π/2 по модулю — ровно сбоку)
const ROLL = -0.18 // небольшой крен, чтобы орбита не была строго горизонтальной
const SPEED = 0.15 // рад/сек
const FRONT = TILT < 0 ? -Math.PI / 2 : Math.PI / 2 // угол на орбите, ближайший к камере
const SELECTED_SCALE = 1.5

type Ref<T> = MutableRefObject<T>

function PlanetMesh({ planet, phase, selected, onSelect }: { planet: Planet; phase: Ref<number>; selected: boolean; onSelect: (id: string) => void }) {
  const ref = useRef<Group>(null)
  const start = (planet.angle * Math.PI) / 180
  // Позиции обновляем в цикле рендера, а не через React state — так плавно.
  useFrame((_, delta) => {
    const g = ref.current
    if (!g) return
    const t = start + phase.current
    g.position.set(Math.cos(t) * A, Math.sin(t) * B, 0)
    g.scale.setScalar(MathUtils.damp(g.scale.x, selected ? SELECTED_SCALE : 1, 6, delta))
  })
  return (
    <group ref={ref}>
      <mesh
        onClick={(e) => { e.stopPropagation(); onSelect(planet.id) }}
        onPointerOver={() => (document.body.style.cursor = 'pointer')}
        onPointerOut={() => (document.body.style.cursor = '')}
      >
        <sphereGeometry args={[planet.size, 32, 32]} />
        <PlanetSurface id={planet.id} color={planet.color} banded={planet.size >= 0.5} />
      </mesh>
      <PlanetLabel body={ref} name={planet.name} radius={planet.size} />
    </group>
  )
}

interface OrbitProps {
  planets: Planet[]
  selectedId: string | null
  onSelect: (id: string) => void
  onArrive: (id: string) => void // выбранная планета докрутилась вперёд
}

function Orbit({ planets, selectedId, onSelect, onArrive }: OrbitProps) {
  const phase = useRef(0) // общий сдвиг всех планет по орбите
  const target = useRef<number | null>(null)
  const arrived = useRef(false)

  // При выборе планеты считаем, на сколько её докрутить вперёд до ближней к камере точки
  useEffect(() => {
    arrived.current = false
    const p = planets.find((x) => x.id === selectedId)
    if (!p) { target.current = null; return }
    const start = (p.angle * Math.PI) / 180
    const need = MathUtils.euclideanModulo(FRONT - start - phase.current, Math.PI * 2)
    target.current = phase.current + need
  }, [selectedId, planets])

  useFrame((_, delta) => {
    if (selectedId === null) {
      phase.current += delta * SPEED // обычное вращение
      return
    }
    // Планета выбрана: остальное движение стоит, крутим только до нужной точки
    if (target.current === null) return
    phase.current = MathUtils.damp(phase.current, target.current, 5, delta)
    if (Math.abs(target.current - phase.current) < 0.003) {
      phase.current = target.current
      if (!arrived.current) { arrived.current = true; onArrive(selectedId) }
    }
  })

  return (
    <group rotation={[TILT, 0, ROLL]}>
      <mesh scale={[A, B, 1]}>
        <ringGeometry args={[0.992, 1, 160]} />
        <meshBasicMaterial color="#ffd23f" side={DoubleSide} />
      </mesh>
      {planets.map((p) => (
        <PlanetMesh key={p.id} planet={p} phase={phase} selected={p.id === selectedId} onSelect={onSelect} />
      ))}
    </group>
  )
}

export function Scene(props: OrbitProps) {
  return (
    <Canvas camera={{ position: [0, 0, 12], fov: 50 }} dpr={[1, 2]}>
      <ambientLight intensity={0.7} />
      <FitOrbit />
      <directionalLight position={[5, 6, 8]} intensity={2} />
      <SkyStars />
      <Orbit {...props} />
    </Canvas>
  )
}

function FitOrbit() {
  const { camera, size } = useThree()
  useEffect(() => {
    if (!(camera instanceof PerspectiveCamera) || !size.width || !size.height) return
    const aspect = size.width / size.height
    const halfAngle = MathUtils.degToRad(camera.fov / 2)
    const horizontalExtent = A + 1
    const chartWidth = Math.min(280, Math.max(215, (size.width - 48) * 0.21))
    const orbitAspect = window.matchMedia('(min-width: 1120px)').matches
      ? (size.width - 2 * (chartWidth + 36)) / size.height
      : aspect
    camera.position.z = Math.max(12, horizontalExtent / (orbitAspect * Math.tan(halfAngle)) + 2)
    camera.updateMatrixWorld()
  }, [camera, size.width, size.height])
  return null
}
