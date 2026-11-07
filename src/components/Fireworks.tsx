import { useMemo, useRef } from 'react'
import * as THREE from 'three'
import { useFrame } from '@react-three/fiber'
import { audio } from '../lib/audio'
import { game } from '../lib/game'
import { useRideStore } from '../store/useRideStore'

const BURSTS = 8
const PARTICLES = 110
const LIFE = 2.4

const vertex = /* glsl */ `
attribute vec3 aDir;
uniform vec3 uCenter;
uniform float uAge;
varying float vA;
void main() {
  vec3 p = uCenter + aDir * (uAge * 30.0 * (1.0 - 0.35 * uAge / ${LIFE.toFixed(1)}));
  p.y -= 6.0 * uAge * uAge;
  vec4 mv = viewMatrix * vec4(p, 1.0);
  float fade = clamp(1.0 - uAge / ${LIFE.toFixed(1)}, 0.0, 1.0);
  gl_PointSize = clamp(900.0 * fade / -mv.z + 1.5, 1.5, 14.0);
  vA = fade * (0.6 + 0.4 * sin(uAge * 40.0 + dot(aDir, vec3(12.9, 78.2, 37.7))));
  gl_Position = projectionMatrix * mv;
}`
const fragment = /* glsl */ `
uniform vec3 uColor;
varying float vA;
void main() {
  float d = length(gl_PointCoord - 0.5);
  if (d > 0.5) discard;
  gl_FragColor = vec4(uColor * smoothstep(0.5, 0.0, d) * 1.6, vA);
}`

/** A night-time fireworks show: bursts of glowing sparks that arc and fade. */
export function Fireworks() {
  const geo = useMemo(() => {
    const dirs = new Float32Array(PARTICLES * 3)
    const v = new THREE.Vector3()
    for (let i = 0; i < PARTICLES; i++) {
      do v.set(Math.random() * 2 - 1, Math.random() * 2 - 1, Math.random() * 2 - 1)
      while (v.lengthSq() > 1 || v.lengthSq() < 0.1)
      v.normalize().multiplyScalar(0.55 + Math.random() * 0.45)
      dirs.set([v.x, v.y, v.z], i * 3)
    }
    const g = new THREE.BufferGeometry()
    g.setAttribute('position', new THREE.BufferAttribute(new Float32Array(PARTICLES * 3), 3))
    g.setAttribute('aDir', new THREE.BufferAttribute(dirs, 3))
    return g
  }, [])

  const bursts = useMemo(
    () => Array.from({ length: BURSTS }, () => ({
      age: LIFE,
      mat: new THREE.ShaderMaterial({
        uniforms: {
          uCenter: { value: new THREE.Vector3() },
          uAge: { value: LIFE },
          uColor: { value: new THREE.Color() },
        },
        vertexShader: vertex,
        fragmentShader: fragment,
        transparent: true,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
      }),
    })),
    [],
  )
  const refs = useRef<(THREE.Object3D | null)[]>([])
  const next = useRef(0)

  useFrame((_, delta) => {
    if (useRideStore.getState().paused) return
    const dt = Math.min(delta, 0.1)
    if (game.fireworksLeft > 0) {
      next.current -= dt
      if (next.current <= 0) {
        next.current = 0.5 + Math.random() * 0.9
        const b = bursts.find((x) => x.age >= LIFE)
        if (b) {
          b.age = 0
          b.mat.uniforms.uCenter.value.set((Math.random() - 0.5) * 90, 42 + Math.random() * 34, -20 - Math.random() * 50)
          b.mat.uniforms.uColor.value.setHSL(Math.random(), 0.9, 0.6)
          audio.pop(0.25 + Math.random() * 0.3)
        }
      }
    }
    bursts.forEach((b, i) => {
      if (b.age < LIFE) b.age += dt
      b.mat.uniforms.uAge.value = b.age
      const p = refs.current[i]
      if (p) p.visible = b.age < LIFE
    })
  })

  return (
    <>
      {bursts.map((b, i) => (
        <points
          key={i}
          ref={(el) => { refs.current[i] = el }}
          geometry={geo}
          material={b.mat}
          frustumCulled={false}
          renderOrder={2}
          visible={false}
        />
      ))}
    </>
  )
}
