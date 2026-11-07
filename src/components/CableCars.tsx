import { createRef, useMemo, useRef } from 'react'
import * as THREE from 'three'
import { useFrame, useThree } from '@react-three/fiber'
import { CABIN_COUNT, FLOOR_TOP, cableY, pathAt } from '../lib/cableway'
import { PERIOD, V0, cabinState, doorOpen } from '../lib/schedule'
import { MAX_PAX, newPose, passengerPose } from '../lib/passengers'
import { createPerson, dressPerson, posePerson } from '../lib/person'
import { hash, wrapAngle } from '../lib/math'
import { audio } from '../lib/audio'
import { effSpeed, isActiveSlot } from '../lib/game'
import { env } from '../lib/env'
import { useRideStore } from '../store/useRideStore'
import { CabinModel } from './CabinModel'

const EYE = new THREE.Vector3(0.2, FLOOR_TOP + 1.55, 0) // seated-height view from cabin 0
const UP = new THREE.Vector3(0, 1, 0)

interface LookControls { target: THREE.Vector3; update: () => void }
interface Props { line: 0 | 1; zOff: number }

/** One line's cabins and passengers. Cabin slots come into service as you buy more cabins. */
export function CableCars({ line, zOff }: Props) {
  const camera = useThree((s) => s.camera)
  const controls = useThree((s) => s.controls) as unknown as LookControls | null

  const pitch = useRef<number[]>(Array(CABIN_COUNT).fill(0))
  const appear = useRef<number[]>(Array(CABIN_COUNT).fill(0))
  const ride = useRef({ active: false, prev: new THREE.Vector3(), yaw: 0 })
  const lastStation = useRef<(number | undefined)[]>(Array(CABIN_COUNT).fill(undefined))

  const cabins = useMemo(
    () => Array.from({ length: CABIN_COUNT }, () => ({
      group: createRef<THREE.Group>(),
      door: createRef<THREE.Group>(),
      light: createRef<THREE.PointLight>(),
    })),
    [],
  )
  const persons = useMemo(
    () => Array.from({ length: CABIN_COUNT * 2 * MAX_PAX }, () => createPerson()),
    [],
  )
  const tmp = useMemo(() => ({ v: new THREE.Vector3(), eye: new THREE.Vector3(), pose: newPose() }), [])

  useFrame((state, delta) => {
    const dt = Math.min(delta, 0.1)
    const speed = effSpeed()
    const { riding } = useRideStore.getState()
    const time = state.clock.elapsedTime
    const base = env.phase + (line * PERIOD) / 8
    let moving = 0
    let active = 0

    // --- cabins ---
    cabins.forEach((c, i) => {
      const g = c.group.current
      const entry = env.cabins[line * 4 + i]
      if (!g) return
      if (!isActiveSlot(i)) {
        appear.current[i] = 0
        g.visible = false
        lastStation.current[i] = undefined
        entry.st = -2
        return
      }
      appear.current[i] = Math.min(1, appear.current[i] + dt * 0.8)
      const grow = 1 - Math.pow(1 - appear.current[i], 3)
      g.visible = true
      g.scale.setScalar(Math.max(grow, 0.001))

      const T = base + (i * PERIOD) / CABIN_COUNT
      const cs = cabinState(T % PERIOD)
      moving += cs.v / V0
      active++
      const before = lastStation.current[i]
      if (before !== undefined && speed > 0) {
        if (cs.station >= 0 && before < 0) audio.chime('arrive')
        else if (cs.station < 0 && before >= 0) audio.chime('depart')
      }
      lastStation.current[i] = cs.station
      entry.st = cs.station

      const p = pathAt(cs.s)
      g.rotation.order = 'YXZ'
      g.position.set(p.x, cableY(p.x), p.z)
      entry.x = p.x
      entry.z = p.z + zOff
      g.rotation.y = Math.atan2(-p.dz, p.dx)

      // Pendulum: lags behind when speeding up, swings forward when braking.
      const targetPitch = -cs.a * speed * 0.05
      pitch.current[i] += (targetPitch - pitch.current[i]) * Math.min(1, dt * 2.5)
      g.rotation.z = pitch.current[i]
      g.rotation.x = Math.sin(time * 1.1 + i * 2) * 0.025 * Math.min(1, cs.v / V0)
      g.updateMatrixWorld()

      if (c.door.current) c.door.current.position.x = doorOpen(cs) * 1.15
      if (c.light.current) c.light.current.intensity = env.night * 4
    })
    env.ropeLine[line] = active ? (moving / active) * Math.min(speed, 1.5) : 0
    env.rope = Math.max(env.ropeLine[0], env.ropeLine[1])

    // --- passengers ---
    const { v, pose } = tmp
    for (let i = 0; i < CABIN_COUNT; i++) {
      const g = cabins[i].group.current
      const ready = g && isActiveSlot(i) && appear.current[i] >= 1
      const T = base + (i * PERIOD) / CABIN_COUNT
      for (let slot = 0; slot < 2; slot++) {
        for (let j = 0; j < MAX_PAX; j++) {
          const person = persons[(i * 2 + slot) * MAX_PAX + j]
          if (!ready) {
            person.visible = false
            continue
          }
          const cabinId = line * 4 + i
          passengerPose(cabinId, slot as 0 | 1, j, T, pose)
          if (!pose.visible) {
            person.visible = false
            continue
          }
          if (person.userData.leg !== pose.leg) {
            person.userData.leg = pose.leg
            person.userData.yaw = undefined
            dressPerson(person, hash(pose.leg * 8 + j, cabinId + 1))
          }
          v.set(pose.x, pose.y + 0.1 * pose.seat, pose.z)
          let yaw = pose.yaw
          if (pose.inCabin) {
            g.localToWorld(v)
            v.z -= zOff // this line's group is shifted, so go back to its local frame
            yaw += g.rotation.y
          }
          person.position.copy(v)
          const prev: number = person.userData.yaw ?? yaw
          person.userData.yaw = prev + wrapAngle(yaw - prev) * Math.min(1, dt * 10)
          person.rotation.y = person.userData.yaw
          person.scale.setScalar(Math.max(pose.scale, 0.001))
          posePerson(person, pose.seat, pose.swing, pose.stride)
          person.visible = true
        }
      }
    }

    // --- ride camera: sits in cabin 0 of line 1, drag to look around ---
    const g0 = cabins[0].group.current
    const r = ride.current
    if (line === 0 && riding && g0 && controls) {
      const eye = g0.localToWorld(tmp.eye.copy(EYE))
      const yaw = g0.rotation.y
      if (!r.active) {
        // start by looking out of the side window (local +z), clear of the end benches
        camera.position.set(eye.x - Math.sin(yaw) * 0.25, eye.y, eye.z - Math.cos(yaw) * 0.25)
        controls.target.copy(eye)
        r.active = true
      } else {
        camera.position.x += eye.x - r.prev.x
        camera.position.y += eye.y - r.prev.y
        camera.position.z += eye.z - r.prev.z
        controls.target.copy(eye)
        // keep the view turning with the cabin around the station turnarounds
        const off = tmp.v.copy(camera.position).sub(eye)
        off.applyAxisAngle(UP, wrapAngle(yaw - r.yaw))
        camera.position.copy(eye).add(off)
      }
      r.prev.copy(eye)
      r.yaw = yaw
      controls.update()
    } else if (line === 0) {
      r.active = false
    }
  })

  return (
    <>
      {cabins.map((c, i) => (
        <group key={i} ref={c.group} visible={false}>
          <CabinModel slot={i} doorRef={c.door} lightRef={c.light} />
        </group>
      ))}
      {persons.map((p, i) => (
        <primitive key={i} object={p} />
      ))}
    </>
  )
}
