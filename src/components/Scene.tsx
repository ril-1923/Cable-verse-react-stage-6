import { useEffect, useRef } from 'react'
import { Canvas, useThree } from '@react-three/fiber'
import { OrbitControls } from '@react-three/drei'
import { Terrain } from './Terrain'
import { Cableway } from './Cableway'
import { CableCars } from './CableCars'
import { SimDriver } from './SimDriver'
import { Lighting } from './Lighting'
import { QueueCrowd } from './QueueCrowd'
import { AudioDriver } from './AudioDriver'
import { Weather } from './Weather'
import { SeasonDriver } from './SeasonDriver'
import { Trees } from './Trees'
import { Fireworks } from './Fireworks'
import { MapDriver } from './MapDriver'
import { LINE2_Z, terrainHeight } from '../lib/terrain'
import { useGameStore } from '../store/useGameStore'
import { useRideStore } from '../store/useRideStore'

type Controls = React.ComponentRef<typeof OrbitControls>

function CameraRig() {
  const riding = useRideStore((s) => s.riding)
  const camera = useThree((s) => s.camera)
  const focus = useRideStore((s) => s.focus)
  const controls = useRef<Controls>(null)

  useEffect(() => {
    if (riding) return
    camera.position.set(-10, 40, 75)
    controls.current?.target.set(0, 14, 0)
    controls.current?.update()
  }, [riding, camera])

  // Minimap click: fly the overview camera to look at that spot.
  useEffect(() => {
    if (!focus || useRideStore.getState().riding) return
    const y = terrainHeight(focus.x, focus.z) + 4
    camera.position.set(focus.x, y + 18, focus.z + 34)
    controls.current?.target.set(focus.x, y, focus.z)
    controls.current?.update()
  }, [focus, camera])

  // While riding, the orbit pivot is the passenger's head, so dragging looks around.
  return (
    <OrbitControls
      ref={controls}
      makeDefault
      enableZoom={!riding}
      enablePan={!riding}
      rotateSpeed={riding ? -0.5 : 1}
      maxPolarAngle={riding ? Math.PI : Math.PI / 2.05}
    />
  )
}

function Line({ line, zOff }: { line: 0 | 1; zOff: number }) {
  return (
    <group position={[0, 0, zOff]}>
      <Cableway zOff={zOff} />
      <CableCars line={line} zOff={zOff} />
      <QueueCrowd line={line} zOff={zOff} />
    </group>
  )
}

function Lines() {
  const second = useGameStore((s) => (s.upgrades.line2 ?? 0) > 0)
  return (
    <>
      <Line line={0} zOff={0} />
      {second && <Line line={1} zOff={LINE2_Z} />}
    </>
  )
}

export function Scene() {
  return (
    <Canvas dpr={[1, 2]} camera={{ position: [-10, 40, 75], fov: 55, near: 0.1, far: 1500 }}>
      <SeasonDriver />
      <Lighting />
      <Terrain />
      <Trees />
      <Fireworks />
      <SimDriver />
      <Lines />
      <AudioDriver />
      <Weather />
      <MapDriver />
      <CameraRig />
    </Canvas>
  )
}
