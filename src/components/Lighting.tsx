import { useMemo, useRef } from 'react'
import * as THREE from 'three'
import { useFrame } from '@react-three/fiber'
import { Sky, Stars } from '@react-three/drei'
import { SunsetGlow } from './SunsetGlow'
import { useRideStore } from '../store/useRideStore'
import { env } from '../lib/env'
import { glassMat, lampMat } from '../lib/materials'
import { smoothstep } from '../lib/math'
import { advanceHours } from '../lib/game'

const DAY_SECONDS = 150 // real seconds for a full 24h cycle when auto time is on

const col = (c: string) => new THREE.Color(c)
const WHITE = col('#ffffff')
const WARM = col('#ff9a55')
const MOON = col('#a9bbe6')
const SKY_DAY = col('#dbe9f6')
const SKY_NIGHT = col('#26365e')
const SKY_DUSK = col('#ffb48a')
const SKY_GREY = col('#9aa5b1')
const GROUND_DAY = col('#5b5a52')
const GROUND_NIGHT = col('#0c0e12')
const GLASS_DAY = col('#d6ecf8')
const GLASS_NIGHT = col('#05080e')
const FOG_DAY = col('#cfe0ee')
const FOG_NIGHT = col('#070b14')
const FOG_DUSK = col('#d79a78')
const FOG_GREY_DAY = col('#aab4be')
const FOG_GREY_NIGHT = col('#0d1117')

const sunAngle = (hour: number) => ((hour - 6) / 12) * Math.PI

export function Lighting() {
  const sun = useRef<THREE.DirectionalLight>(null)
  const moon = useRef<THREE.DirectionalLight>(null)
  const hemi = useRef<THREE.HemisphereLight>(null)
  const fog = useRef<THREE.Fog>(null)
  const dome = useRef<THREE.MeshBasicMaterial>(null)
  const cloud = useRef<THREE.MeshBasicMaterial>(null)
  const stars = useRef<THREE.Group>(null)
  const tmp = useMemo(() => new THREE.Color(), [])

  // Quantised so the sky only re-renders a few times per second.
  const hourQ = useRideStore((s) => Math.round(s.hour * 10) / 10)
  const sunPos = useMemo<[number, number, number]>(() => {
    const a = sunAngle(hourQ)
    // Keep the sky's sun just above the horizon through twilight so it keeps its glow;
    // the night dome fades the sky out instead.
    return [-Math.cos(a) * 100, Math.max((Math.sin(a) + env.dayOffset) * 100, 3), -35]
  }, [hourQ])
  const elevQ = Math.sin(sunAngle(hourQ)) + env.dayOffset
  const showStars = elevQ < -0.05
  const dayQ = smoothstep(-0.25, 0.35, elevQ)

  useFrame((_, delta) => {
    const st = useRideStore.getState()
    let hour = st.hour
    if (st.autoTime && !st.paused) {
      const dh = (Math.min(delta, 0.1) * 24) / DAY_SECONDS
      hour = (hour + dh) % 24
      st.setHour(hour)
      advanceHours(dh)
    }
    const a = sunAngle(hour)
    const elev = Math.sin(a) + env.dayOffset
    const day = smoothstep(-0.25, 0.35, elev)
    const night = 1 - day
    const dusk = Math.max(0, 1 - Math.abs(elev) / 0.35)
    const oc = env.overcast
    env.night = night
    env.dusk = dusk
    env.sun = [-Math.cos(a) * 100, elev * 100, -35]
    env.daylight = day

    if (sun.current) {
      sun.current.position.set(...env.sun)
      sun.current.intensity = 2.0 * day * (1 - 0.7 * oc)
      sun.current.color.copy(WHITE).lerp(WARM, dusk * 0.8)
    }
    if (moon.current) {
      moon.current.position.set(Math.cos(a) * 100, -elev * 100, 35)
      moon.current.intensity = 0.4 * night * (1 - 0.6 * oc)
      moon.current.color.copy(MOON)
    }
    if (hemi.current) {
      hemi.current.intensity = (0.2 + 0.5 * day) * (1 - 0.2 * oc) + env.flash * 1.6
      hemi.current.color.copy(SKY_NIGHT).lerp(SKY_DAY, day).lerp(SKY_DUSK, dusk * 0.4 * (1 - oc)).lerp(SKY_GREY, oc * 0.6 * day)
      hemi.current.groundColor.copy(GROUND_NIGHT).lerp(GROUND_DAY, day)
    }
    if (fog.current) {
      const c = fog.current.color
      c.copy(FOG_NIGHT).lerp(FOG_DAY, day).lerp(FOG_DUSK, dusk * 0.5 * (1 - oc))
      c.lerp(tmp.copy(FOG_GREY_NIGHT).lerp(FOG_GREY_DAY, day), oc * 0.85)
      c.offsetHSL(0, 0, env.flash * 0.15)
      fog.current.near = 90 - 70 * oc
      fog.current.far = 320 - 200 * oc
      if (cloud.current) {
        cloud.current.color.copy(c)
        cloud.current.opacity = oc * 0.93
      }
    }
    if (dome.current) dome.current.opacity = Math.min(1, night * 1.06)
    if (stars.current) stars.current.visible = oc < 0.5
    glassMat.color.copy(GLASS_NIGHT).lerp(GLASS_DAY, day)
    lampMat.emissiveIntensity = 0.1 + 2.6 * night + 0.5 * oc * day
  })

  return (
    <>
      <fog ref={fog} attach="fog" args={['#cfe0ee', 90, 320]} />
      {/* The sky shader never gets truly dark, so a dome fades in over it at night. */}
      <mesh renderOrder={-1}>
        <sphereGeometry args={[450, 24, 16]} />
        <meshBasicMaterial ref={dome} color="#04070f" side={THREE.BackSide} transparent opacity={0} depthWrite={false} fog={false} />
      </mesh>
      {/* Cloud deck: same colour as the fog, fades in with rain and snow. */}
      <mesh renderOrder={-0.5}>
        <sphereGeometry args={[445, 24, 16]} />
        <meshBasicMaterial ref={cloud} color="#aab4be" side={THREE.BackSide} transparent opacity={0} depthWrite={false} fog={false} />
      </mesh>
      <SunsetGlow />
      <Sky
        sunPosition={sunPos}
        turbidity={6}
        rayleigh={0.02 + 1.2 * dayQ}
        mieCoefficient={0.0005 + 0.004 * dayQ}
      />
      {showStars && (
        <group ref={stars}>
          <Stars radius={400} depth={60} count={3500} factor={7} fade speed={0} />
        </group>
      )}
      <hemisphereLight ref={hemi} args={['#dbe9f6', '#5b5a52', 0.7]} />
      <directionalLight ref={sun} position={[-20, 80, -35]} intensity={1.8} />
      <directionalLight ref={moon} position={[20, -80, 35]} intensity={0} />
    </>
  )
}
