import { useMemo } from 'react'
import * as THREE from 'three'
import { useFrame } from '@react-three/fiber'
import { env } from '../lib/env'

const vertex = /* glsl */ `
varying vec3 vDir;
void main() {
  vDir = position;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}`

// Additive horizon glow: orange at the horizon fading to rose higher up,
// strongest in the direction of the sun, with a soft halo around it.
const fragment = /* glsl */ `
uniform vec3 uSun;
uniform float uStrength;
varying vec3 vDir;
void main() {
  vec3 d = normalize(vDir);
  vec3 s = normalize(uSun);
  float up = max(d.y, 0.0);
  float below = max(-d.y, 0.0);
  float band = exp(-up * 6.0) * exp(-below * 10.0);
  vec2 sh = normalize(s.xz + vec2(1e-4));
  vec2 dh = normalize(d.xz + vec2(1e-4));
  float toward = 0.2 + 0.8 * pow(max(dot(sh, dh), 0.0), 2.5);
  float halo = pow(max(dot(d, s), 0.0), 18.0);
  vec3 warm = vec3(1.0, 0.45, 0.12);
  vec3 rose = vec3(0.75, 0.25, 0.45);
  vec3 col = mix(warm, rose, clamp(up * 2.5, 0.0, 1.0));
  float g = band * toward + halo * 0.7;
  gl_FragColor = vec4(col * g * uStrength, 1.0);
}`

export function SunsetGlow() {
  const material = useMemo(
    () =>
      new THREE.ShaderMaterial({
        uniforms: { uSun: { value: new THREE.Vector3(0, 1, 0) }, uStrength: { value: 0 } },
        vertexShader: vertex,
        fragmentShader: fragment,
        side: THREE.BackSide,
        transparent: true,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
      }),
    [],
  )

  useFrame(() => {
    material.uniforms.uSun.value.set(...env.sun)
    material.uniforms.uStrength.value = 0.95 * env.dusk * (1 - env.overcast)
  })

  return (
    <mesh renderOrder={0} frustumCulled={false} material={material}>
      <sphereGeometry args={[440, 32, 20]} />
    </mesh>
  )
}
