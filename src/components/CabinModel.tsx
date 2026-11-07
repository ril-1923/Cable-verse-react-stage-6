import { useMemo } from 'react'
import type { RefObject } from 'react'
import * as THREE from 'three'
import { useFrame } from '@react-three/fiber'
import { CABIN_H, CABIN_L, CABIN_W, FLOOR_TOP, HANG, ROOF_T } from '../lib/cableway'
import { chromeMat, floorMat, glassMat, lampMat, metalMat } from '../lib/materials'
import { env } from '../lib/env'
import { skinById } from '../lib/skins'
import { useGameStore } from '../store/useGameStore'

interface Props {
  slot: number
  doorRef: RefObject<THREE.Group | null>
  lightRef: RefObject<THREE.PointLight | null>
}

const LOW = 0.8 // solid lower wall band
const DOOR_W = 1.2

/** Origin is the rope grip point; the cabin hangs below it. The door is on the local -z side. */
export function CabinModel({ slot, doorRef, lightRef }: Props) {
  const skinId = useGameStore((s) => s.skin)
  const skin = skinById(skinId)

  const mats = useMemo(() => {
    const bodyColor = skin.bodies[slot % 4]
    // There is no environment to reflect, so full metal would render black: cap it and add a
    // faint glow of the paint colour to keep shiny skins looking shiny.
    const metalness = Math.min(skin.metal, 0.25)
    const shine = skin.metal > 0.5 ? 0.18 : 0
    return {
      body: new THREE.MeshStandardMaterial({
        color: bodyColor, roughness: skin.rough, metalness, emissive: bodyColor, emissiveIntensity: shine,
      }),
      roof: new THREE.MeshStandardMaterial({
        color: skin.roof ?? bodyColor, roughness: skin.rough, metalness, emissive: skin.roof ?? bodyColor, emissiveIntensity: shine,
      }),
      stripe: new THREE.MeshStandardMaterial({
        color: skin.stripe ?? '#ffffff', emissive: skin.stripe ?? '#000000', emissiveIntensity: 0, roughness: 0.4,
      }),
      seat: new THREE.MeshStandardMaterial({ color: skin.seat, roughness: 0.9 }),
    }
  }, [skin, slot])

  // glowing trim switches on after dark
  useFrame(() => {
    mats.stripe.emissiveIntensity = env.night * skin.glow
  })

  const L = CABIN_L
  const W = CABIN_W
  const H = CABIN_H
  const fy = FLOOR_TOP
  const glassH = H - LOW
  const yLow = fy + LOW / 2
  const yGlass = fy + LOW + glassH / 2
  const yStripe = fy + LOW + 0.03
  const secW = L / 2 - DOOR_W / 2
  const secX = (L / 2 + DOOR_W / 2) / 2
  const { body, roof, stripe, seat } = mats

  const post: [number, number][] = [[-1, -1], [1, -1], [1, 1], [-1, 1]]

  return (
    <>
      {/* hanger arm and grip */}
      <mesh position={[0, -HANG / 2, 0]} material={metalMat}>
        <cylinderGeometry args={[0.05, 0.05, HANG, 8]} />
      </mesh>
      <mesh position={[0, -0.15, 0]} material={metalMat}>
        <boxGeometry args={[0.6, 0.3, 0.4]} />
      </mesh>

      {/* roof and floor */}
      <mesh position={[0, -HANG - ROOF_T / 2, 0]} material={roof}>
        <boxGeometry args={[L + 0.3, ROOF_T, W + 0.3]} />
      </mesh>
      <mesh position={[0, fy - 0.1, 0]} material={body}>
        <boxGeometry args={[L + 0.3, 0.2, W + 0.3]} />
      </mesh>
      <mesh position={[0, fy + 0.005, 0]} material={floorMat}>
        <boxGeometry args={[L - 0.1, 0.01, W - 0.1]} />
      </mesh>

      {/* corner posts */}
      {post.map(([sx, sz]) => (
        <mesh key={`${sx}${sz}`} position={[sx * L / 2, fy + H / 2, sz * W / 2]} material={body}>
          <boxGeometry args={[0.1, H, 0.1]} />
        </mesh>
      ))}

      {/* end walls and back wall: solid band + glass */}
      {[-1, 1].map((sx) => (
        <group key={`end${sx}`} position={[sx * L / 2, 0, 0]}>
          <mesh position={[0, yLow, 0]} material={body}><boxGeometry args={[0.06, LOW, W]} /></mesh>
          <mesh position={[0, yGlass, 0]} material={glassMat}><boxGeometry args={[0.04, glassH, W]} /></mesh>
        </group>
      ))}
      <group position={[0, 0, W / 2]}>
        <mesh position={[0, yLow, 0]} material={body}><boxGeometry args={[L, LOW, 0.06]} /></mesh>
        <mesh position={[0, yGlass, 0]} material={glassMat}><boxGeometry args={[L, glassH, 0.04]} /></mesh>
      </group>

      {/* door side: two fixed sections around the opening */}
      {[-1, 1].map((sx) => (
        <group key={`door${sx}`} position={[sx * secX, 0, -W / 2]}>
          <mesh position={[0, yLow, 0]} material={body}><boxGeometry args={[secW, LOW, 0.06]} /></mesh>
          <mesh position={[0, yGlass, 0]} material={glassMat}><boxGeometry args={[secW, glassH, 0.04]} /></mesh>
        </group>
      ))}

      {/* sliding door, runs on the outside of the right-hand section */}
      <group ref={doorRef} position={[0, 0, -W / 2 - 0.05]}>
        <mesh position={[0, yLow, 0]} material={body}><boxGeometry args={[DOOR_W, LOW, 0.05]} /></mesh>
        <mesh position={[0, yGlass, 0]} material={glassMat}><boxGeometry args={[DOOR_W, glassH, 0.05]} /></mesh>
      </group>

      {/* skin trim: a band around the top of the solid wall (and a roof edge), glowing on some skins */}
      {skin.stripe && (
        <>
          {[-1, 1].map((sx) => (
            <mesh key={`se${sx}`} position={[sx * (L / 2 + 0.03), yStripe, 0]} material={stripe}>
              <boxGeometry args={[0.07, 0.07, W + 0.12]} />
            </mesh>
          ))}
          <mesh position={[0, yStripe, W / 2 + 0.03]} material={stripe}>
            <boxGeometry args={[L + 0.12, 0.07, 0.07]} />
          </mesh>
          {[-1, 1].map((sx) => (
            <mesh key={`sd${sx}`} position={[sx * secX, yStripe, -W / 2 - 0.03]} material={stripe}>
              <boxGeometry args={[secW, 0.07, 0.07]} />
            </mesh>
          ))}
          <mesh position={[0, -HANG - ROOF_T - 0.02, 0]} material={stripe}>
            <boxGeometry args={[L + 0.34, 0.05, W + 0.34]} />
          </mesh>
        </>
      )}

      {/* benches on the end walls */}
      {[-1, 1].map((sx) => (
        <group key={`bench${sx}`}>
          <mesh position={[sx * 1.45, fy + 0.45, 0]} material={seat}>
            <boxGeometry args={[0.45, 0.1, 1.9]} />
          </mesh>
          <mesh position={[sx * 1.64, fy + 0.75, 0]} material={seat}>
            <boxGeometry args={[0.08, 0.55, 1.9]} />
          </mesh>
          <mesh position={[sx * 1.45, fy + 0.2, 0]} material={metalMat}>
            <boxGeometry args={[0.4, 0.4, 1.8]} />
          </mesh>
        </group>
      ))}

      {/* grab pole and roof lamp */}
      <mesh position={[0.8, fy + H / 2, -0.8]} material={chromeMat}>
        <cylinderGeometry args={[0.025, 0.025, H, 8]} />
      </mesh>
      <mesh position={[0, fy + H - 0.03, 0]} material={lampMat}>
        <boxGeometry args={[0.9, 0.04, 0.5]} />
      </mesh>
      <pointLight
        ref={lightRef}
        position={[0, fy + H - 0.4, 0]}
        color="#ffe6b8"
        intensity={0}
        distance={7}
        decay={2}
      />
    </>
  )
}
