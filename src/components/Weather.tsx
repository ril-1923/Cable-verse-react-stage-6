import { useMemo, useRef } from 'react'
import * as THREE from 'three'
import { useFrame } from '@react-three/fiber'
import { audio } from '../lib/audio'
import { env } from '../lib/env'
import { useRideStore } from '../store/useRideStore'

const BOX = new THREE.Vector3(60, 36, 60) // precipitation box that follows the camera
const RAIN_COUNT = 6000
const SNOW_COUNT = 5000

const approach = (cur: number, target: number, rate: number, dt: number) =>
  cur < target ? Math.min(target, cur + rate * dt) : Math.max(target, cur - rate * dt)

const rainVertex = /* glsl */ `
attribute float aEnd;
attribute float aRand;
uniform vec3 uCam;
uniform vec3 uBox;
uniform float uTime;
uniform float uIntensity;
varying float vA;
void main() {
  vec3 p = position;
  p.y -= uTime * 28.0;
  p.x += uTime * 3.0;
  vec3 q = mod(p - uCam + uBox * 0.5, uBox) - uBox * 0.5 + uCam;
  q -= normalize(vec3(3.0, -28.0, 0.0)) * aEnd * 1.4; // tail trails above the head
  vA = step(aRand, uIntensity) * (1.0 - aEnd * 0.75) * 0.55;
  gl_Position = projectionMatrix * viewMatrix * vec4(q, 1.0);
}`
const rainFragment = /* glsl */ `
varying float vA;
void main() { gl_FragColor = vec4(0.75, 0.82, 0.95, vA); }`

const snowVertex = /* glsl */ `
attribute float aRand;
uniform vec3 uCam;
uniform vec3 uBox;
uniform float uTime;
uniform float uIntensity;
varying float vA;
void main() {
  vec3 p = position;
  p.y -= uTime * (1.6 + aRand * 1.4);
  vec3 q = mod(p - uCam + uBox * 0.5, uBox) - uBox * 0.5 + uCam;
  q.x += sin(uTime * 0.7 + aRand * 40.0) * 0.8;
  q.z += cos(uTime * 0.6 + aRand * 25.0) * 0.8;
  vec4 mv = viewMatrix * vec4(q, 1.0);
  gl_PointSize = clamp(140.0 * (0.5 + aRand) / -mv.z, 1.5, 12.0);
  vA = step(aRand, uIntensity);
  gl_Position = projectionMatrix * mv;
}`
const snowFragment = /* glsl */ `
varying float vA;
void main() {
  float d = length(gl_PointCoord - 0.5);
  if (d > 0.5 || vA < 0.5) discard;
  gl_FragColor = vec4(1.0, 1.0, 1.0, smoothstep(0.5, 0.15, d) * 0.9);
}`

function uniforms() {
  return {
    uCam: { value: new THREE.Vector3() },
    uBox: { value: BOX },
    uTime: { value: 0 },
    uIntensity: { value: 0 },
  }
}

export function Weather() {
  const rainObj = useRef<THREE.LineSegments>(null)
  const snowObj = useRef<THREE.Points>(null)

  const rainGeo = useMemo(() => {
    const pos = new Float32Array(RAIN_COUNT * 6)
    const end = new Float32Array(RAIN_COUNT * 2)
    const rnd = new Float32Array(RAIN_COUNT * 2)
    for (let i = 0; i < RAIN_COUNT; i++) {
      const x = Math.random() * BOX.x
      const y = Math.random() * BOX.y
      const z = Math.random() * BOX.z
      const r = Math.random()
      for (let k = 0; k < 2; k++) {
        pos.set([x, y, z], (i * 2 + k) * 3)
        end[i * 2 + k] = k
        rnd[i * 2 + k] = r
      }
    }
    const g = new THREE.BufferGeometry()
    g.setAttribute('position', new THREE.BufferAttribute(pos, 3))
    g.setAttribute('aEnd', new THREE.BufferAttribute(end, 1))
    g.setAttribute('aRand', new THREE.BufferAttribute(rnd, 1))
    return g
  }, [])

  const snowGeo = useMemo(() => {
    const pos = new Float32Array(SNOW_COUNT * 3)
    const rnd = new Float32Array(SNOW_COUNT)
    for (let i = 0; i < SNOW_COUNT; i++) {
      pos.set([Math.random() * BOX.x, Math.random() * BOX.y, Math.random() * BOX.z], i * 3)
      rnd[i] = Math.random()
    }
    const g = new THREE.BufferGeometry()
    g.setAttribute('position', new THREE.BufferAttribute(pos, 3))
    g.setAttribute('aRand', new THREE.BufferAttribute(rnd, 1))
    return g
  }, [])

  const rainMat = useMemo(
    () => new THREE.ShaderMaterial({
      uniforms: uniforms(), vertexShader: rainVertex, fragmentShader: rainFragment,
      transparent: true, depthWrite: false,
    }),
    [],
  )
  const snowMat = useMemo(
    () => new THREE.ShaderMaterial({
      uniforms: uniforms(), vertexShader: snowVertex, fragmentShader: snowFragment,
      transparent: true, depthWrite: false,
    }),
    [],
  )

  useFrame((state, delta) => {
    const dt = Math.min(delta, 0.1)
    const { weather } = useRideStore.getState()

    env.rain = approach(env.rain, weather === 'rain' ? 1 : 0, 0.25, dt)
    env.snowfall = approach(env.snowfall, weather === 'snow' ? 1 : 0, 0.25, dt)
    env.overcast = Math.max(env.rain * 0.9, env.snowfall * 0.75)

    // snow settles while it falls and melts slowly (faster in rain); rain wets the ground
    if (env.snowfall > 0.3) env.snowCover = Math.min(1, env.snowCover + 0.02 * env.snowfall * dt)
    else env.snowCover = Math.max(0, env.snowCover - (env.rain > 0.3 ? 0.03 : 0.004) * dt)
    env.snowCover = Math.max(env.winter * 0.4, env.snowCover) // winter keeps a base of snow
    env.wet = env.rain > 0.3 ? Math.min(1, env.wet + 0.2 * dt) : Math.max(0, env.wet - 0.02 * dt)

    // lightning in heavy rain, with thunder a moment later
    env.flash = Math.max(0, env.flash - dt * 3.5)
    if (env.rain > 0.6 && Math.random() < 0.05 * dt) {
      env.flash = 1
      audio.thunder(0.4 + Math.random() * 1.8)
    }

    const t = state.clock.elapsedTime
    for (const [obj, mat, amount] of [
      [rainObj.current, rainMat, env.rain],
      [snowObj.current, snowMat, env.snowfall],
    ] as const) {
      if (!obj) continue
      obj.visible = amount > 0.01
      mat.uniforms.uCam.value.copy(state.camera.position)
      mat.uniforms.uTime.value = t
      mat.uniforms.uIntensity.value = amount
    }
  })

  return (
    <>
      <lineSegments ref={rainObj} geometry={rainGeo} material={rainMat} frustumCulled={false} visible={false} />
      <points ref={snowObj} geometry={snowGeo} material={snowMat} frustumCulled={false} visible={false} />
    </>
  )
}
