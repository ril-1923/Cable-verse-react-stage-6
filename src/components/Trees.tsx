import { useLayoutEffect, useMemo, useRef } from 'react'
import * as THREE from 'three'
import { useFrame } from '@react-three/fiber'
import { LINE2_Z, STATION_X, terrainHeight } from '../lib/terrain'
import { env } from '../lib/env'

interface Tree { x: number; y: number; z: number; s: number; v: number }

function rng(seed: number) {
  let a = seed
  return () => {
    a = (Math.imul(a, 1664525) + 1013904223) | 0
    return ((a >>> 0) % 100000) / 100000
  }
}

const SNOWY = new THREE.Color('#e8eef0')

/** Pines stay green (and pick up snow); broad-leaf trees follow the season's colour. */
export function Trees() {
  const trunks = useRef<THREE.InstancedMesh>(null)
  const cones = useRef<THREE.InstancedMesh>(null)
  const crowns = useRef<THREE.InstancedMesh>(null)

  const { pines, broad } = useMemo(() => {
    const rand = rng(7)
    const pines: Tree[] = []
    const broad: Tree[] = []
    for (let i = 0; i < 6000 && pines.length + broad.length < 380; i++) {
      const x = (rand() - 0.5) * 140
      const z = (rand() - 0.5) * 84
      const corridor = Math.min(Math.abs(z), Math.abs(z - LINE2_Z))
      if (corridor < 10) continue
      let nearStation = false
      for (const sx of STATION_X) for (const lz of [0, LINE2_Z]) {
        if (Math.hypot(x - sx, z - lz) < 20) nearStation = true
      }
      if (nearStation) continue
      const y = terrainHeight(x, z)
      if (y > 32) continue
      const t: Tree = { x, y, z, s: 0.5 + rand() * 0.55, v: 0.8 + rand() * 0.4 }
      // higher ground gets more pines
      if (rand() < 0.25 + y / 40) pines.push(t)
      else broad.push(t)
    }
    return { pines, broad }
  }, [])

  const mats = useMemo(
    () => ({
      trunk: new THREE.MeshStandardMaterial({ color: '#5a3d26', roughness: 1 }),
      pine: new THREE.MeshStandardMaterial({ color: '#245a33', roughness: 0.9 }),
      leaf: new THREE.MeshStandardMaterial({ color: '#3f7d36', roughness: 0.9 }),
    }),
    [],
  )
  const tmp = useMemo(() => new THREE.Color(), [])

  useLayoutEffect(() => {
    const d = new THREE.Object3D()
    const all = [...pines, ...broad]
    all.forEach((t, i) => {
      d.position.set(t.x, t.y + 0.9 * t.s, t.z)
      d.scale.set(t.s * 0.35, t.s * 1.8, t.s * 0.35)
      d.updateMatrix()
      trunks.current?.setMatrixAt(i, d.matrix)
    })
    pines.forEach((t, i) => {
      d.position.set(t.x, t.y + 3.1 * t.s, t.z)
      d.scale.setScalar(t.s)
      d.updateMatrix()
      cones.current?.setMatrixAt(i, d.matrix)
      cones.current?.setColorAt(i, tmp.setScalar(t.v))
    })
    broad.forEach((t, i) => {
      d.position.set(t.x, t.y + 3.0 * t.s, t.z)
      d.scale.setScalar(t.s)
      d.updateMatrix()
      crowns.current?.setMatrixAt(i, d.matrix)
      crowns.current?.setColorAt(i, tmp.setScalar(t.v))
    })
    for (const m of [trunks.current, cones.current, crowns.current]) {
      if (!m) continue
      m.instanceMatrix.needsUpdate = true
      if (m.instanceColor) m.instanceColor.needsUpdate = true
    }
  }, [pines, broad, tmp])

  useFrame(() => {
    mats.pine.color.set('#245a33').lerp(SNOWY, env.snowCover * 0.6)
    mats.leaf.color.setRGB(env.leaf[0], env.leaf[1], env.leaf[2]).lerp(SNOWY, env.snowCover * 0.7)
  })

  return (
    <>
      <instancedMesh ref={trunks} args={[undefined, undefined, pines.length + broad.length]} material={mats.trunk} frustumCulled={false}>
        <cylinderGeometry args={[1, 1.2, 1, 6]} />
      </instancedMesh>
      <instancedMesh ref={cones} args={[undefined, undefined, pines.length]} material={mats.pine} frustumCulled={false}>
        <coneGeometry args={[1.5, 4.2, 7]} />
      </instancedMesh>
      <instancedMesh ref={crowns} args={[undefined, undefined, broad.length]} material={mats.leaf} frustumCulled={false}>
        <icosahedronGeometry args={[1.7, 0]} />
      </instancedMesh>
    </>
  )
}
