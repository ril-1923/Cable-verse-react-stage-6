import { useFrame } from '@react-three/fiber'
import { env } from '../lib/env'

const dir = { x: 0, z: -1 }

/** Publishes the camera position and heading for the minimap. */
export function MapDriver() {
  useFrame((state) => {
    const c = state.camera
    env.cam.x = c.position.x
    env.cam.z = c.position.z
    const e = c.matrixWorld.elements // third column is the camera's backward axis
    dir.x = -e[8]
    dir.z = -e[10]
    const len = Math.hypot(dir.x, dir.z) || 1
    env.cam.dx = dir.x / len
    env.cam.dz = dir.z / len
  })
  return null
}
