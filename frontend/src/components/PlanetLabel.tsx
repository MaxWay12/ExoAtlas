import { useLayoutEffect, useRef, type RefObject } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import { Vector3, type Group } from 'three'

export function PlanetLabel({ body, name, radius }: {
  body: RefObject<Group>
  name: string
  radius: number
}) {
  const { gl } = useThree()
  const label = useRef<HTMLSpanElement | null>(null)
  const top = useRef(new Vector3())

  useLayoutEffect(() => {
    const element = document.createElement('span')
    element.className = 'planet-scene-label'
    element.textContent = name
    element.hidden = true
    gl.domElement.parentElement?.append(element)
    label.current = element
    return () => {
      label.current = null
      element.remove()
    }
  }, [gl, name])

  useFrame(({ camera, size }) => {
    if (!body.current || !label.current) return
    const point = body.current.getWorldPosition(top.current)
    point.y += radius * body.current.scale.x
    point.project(camera)
    const element = label.current
    element.hidden = Math.abs(point.x) > 1 || Math.abs(point.y) > 1 || Math.abs(point.z) > 1
    element.style.left = `${(point.x + 1) * size.width / 2}px`
    element.style.top = `${(1 - point.y) * size.height / 2}px`
  })

  return null
}
