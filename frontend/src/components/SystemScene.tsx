import { SkyStars } from './SpaceSky'
import { useEffect, useRef, type MutableRefObject } from 'react'
import { Canvas, useFrame, useThree } from '@react-three/fiber'
import { AdditiveBlending, Color, DoubleSide, MathUtils, type Group } from 'three'
import type { PlanetLook } from '../galaxy/look'
import { PlanetLabel } from './PlanetLabel'
import { PlanetSurface } from './PlanetSurface'

const TILT = -0.95

function PlanetBody({ look, phase, selected, onSelect }: { look: PlanetLook; phase: MutableRefObject<number>; selected: boolean; onSelect: (id: string) => void }) {
  const ref = useRef<Group>(null)
  useFrame((_, delta) => {
    const g = ref.current
    if (!g) return
    const a = look.start + phase.current * look.speed * 6
    g.position.set(Math.cos(a) * look.orbit, Math.sin(a) * look.orbit, 0)
    g.scale.setScalar(MathUtils.damp(g.scale.x, selected ? 1.5 : 1, 6, delta))
  })
  return (
    <group ref={ref}>
      <mesh
        onClick={(e) => { e.stopPropagation(); onSelect(look.planet.id) }}
        onPointerOver={() => (document.body.style.cursor = 'pointer')}
        onPointerOut={() => (document.body.style.cursor = '')}
      >
        <sphereGeometry args={[look.size, 32, 32]} />
        <PlanetSurface id={look.planet.id} color={look.color} banded={(look.planet.radius_earth ?? 0) >= 4} />
      </mesh>
      <PlanetLabel body={ref} name={look.planet.name} radius={look.size} />
    </group>
  )
}

interface Props {
  looks: PlanetLook[]
  star: string
  selectedId: string | null
  onSelect: (id: string) => void
}

function Rig({ looks, star, selectedId, onSelect }: Props) {
  const phase = useRef(0)
  useFrame((_, delta) => { if (selectedId === null) phase.current += delta }) // выбрана планета — всё замирает
  return (
    <group rotation={[TILT, 0, 0]}>
      <pointLight intensity={90} color={star} />
      <mesh>
        <sphereGeometry args={[0.55, 64, 48]} />
        <meshBasicMaterial color={star} />
      </mesh>
      <sprite scale={[2.7, 2.7, 1]} raycast={() => null}>
        <shaderMaterial
          transparent
          depthWrite={false}
          blending={AdditiveBlending}
          uniforms={{ glowColor: { value: new Color(star) } }}
          vertexShader={`
            varying vec2 vUv;
            void main() {
              vUv = uv;
              vec4 center = modelViewMatrix * vec4(0.0, 0.0, 0.0, 1.0);
              vec2 scale = vec2(length(modelMatrix[0].xyz), length(modelMatrix[1].xyz));
              center.xy += position.xy * scale;
              gl_Position = projectionMatrix * center;
            }
          `}
          fragmentShader={`
            uniform vec3 glowColor;
            varying vec2 vUv;
            void main() {
              float radius = length(vUv - 0.5) * 2.0;
              float glow = 1.0 - smoothstep(0.2, 1.0, radius);
              gl_FragColor = vec4(glowColor, 0.28 * glow * glow);
              #include <colorspace_fragment>
            }
          `}
        />
      </sprite>
      {looks.map((look) => (
        <mesh key={'orbit-' + look.planet.id}>
          <ringGeometry args={[look.orbit - 0.012, look.orbit + 0.012, 128]} />
          <meshBasicMaterial color={look.orbitKnown ? '#ffd23f' : '#6b7099'} transparent opacity={look.orbitKnown ? 0.7 : 0.4} side={DoubleSide} />
        </mesh>
      ))}
      {looks.map((look) => (
        <PlanetBody key={look.planet.id} look={look} phase={phase} selected={look.planet.id === selectedId} onSelect={onSelect} />
      ))}
    </group>
  )
}

export function SystemScene(props: Props) {
  const extent = props.looks.reduce((max, { orbit, size }) => Math.max(max, orbit + size * 1.5), 0.55)
  return (
    <Canvas camera={{ position: [0, 0, 13], fov: 50 }} dpr={[1, 1.5]}>
      <SkyStars subtle />
      <ambientLight intensity={0.6} />
      <FitSystem extent={extent} />
      <Rig {...props} />
    </Canvas>
  )
}

function FitSystem({ extent }: { extent: number }) {
  const { camera, size } = useThree()
  const aspect = Math.min(1, size.width / Math.max(1, size.height))
  useEffect(() => {
    camera.position.z = Math.max(13, extent / (Math.max(0.1, aspect) * Math.tan(MathUtils.degToRad(25))) + 2)
  }, [camera, aspect, extent])
  return null
}
