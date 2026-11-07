import { useMemo } from 'react'
import { useFrame } from '@react-three/fiber'
import { STATIONS } from '../lib/cableway'
import { terrainHeight } from '../lib/terrain'
import { createPerson, dressPerson } from '../lib/person'
import { hash } from '../lib/math'
import { sim } from '../lib/tickets'

const SHOWN = 12 // most people drawn per queue

/** Visitors waiting outside each station gate. One figure per queued person, up to SHOWN. */
export function QueueCrowd({ line, zOff }: { line: 0 | 1; zOff: number }) {
  const crowds = useMemo(
    () =>
      STATIONS.map((st) =>
        Array.from({ length: SHOWN }, (_, q) => {
          const p = createPerson()
          const row = Math.floor(q / 2)
          const x = st.entX + st.inw * (1.8 + 0.85 * row)
          const z = q % 2 ? 0.6 : -0.6
          p.position.set(x, terrainHeight(x, z + zOff), z)
          p.rotation.y = -st.inw * (Math.PI / 2)
          dressPerson(p, hash(q + 1, st.index + 11 + line * 5))
          return p
        }),
      ),
    [],
  )

  useFrame(() => {
    crowds.forEach((people, s) => {
      people.forEach((p, q) => {
        p.visible = q < sim.queue[line * 2 + s]
      })
    })
  })

  return (
    <>
      {crowds.flat().map((p, i) => (
        <primitive key={i} object={p} />
      ))}
    </>
  )
}
