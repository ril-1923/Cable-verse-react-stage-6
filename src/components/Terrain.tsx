import { useMemo } from 'react'
import * as THREE from 'three'
import { useFrame } from '@react-three/fiber'
import { terrainHeight } from '../lib/terrain'
import { env } from '../lib/env'

const GREEN = new THREE.Color('#5b7a43')
const ROCK = new THREE.Color('#8a8074')
const SNOW = new THREE.Color('#eef3f6')

function colorFor(h: number, out: THREE.Color) {
  if (h < 10) return out.copy(GREEN)
  if (h < 26) return out.lerpColors(GREEN, ROCK, (h - 10) / 16)
  if (h < 40) return out.copy(ROCK)
  if (h < 48) return out.lerpColors(ROCK, SNOW, (h - 40) / 8)
  return out.copy(SNOW)
}

export function Terrain() {
  const geometry = useMemo(() => {
    const g = new THREE.PlaneGeometry(150, 90, 220, 130)
    g.rotateX(-Math.PI / 2)
    const pos = g.attributes.position
    const colors = new Float32Array(pos.count * 3)
    const c = new THREE.Color()
    for (let i = 0; i < pos.count; i++) {
      const h = terrainHeight(pos.getX(i), pos.getZ(i))
      pos.setY(i, h)
      colorFor(h, c).toArray(colors, i * 3)
    }
    g.setAttribute('color', new THREE.BufferAttribute(colors, 3))
    g.computeVertexNormals()
    return g
  }, [])

  // Snow settles on surfaces that face upward; rain darkens everything a little.
  const uniforms = useMemo(() => ({ uSnow: { value: 0 }, uWet: { value: 0 }, uGrass: { value: new THREE.Color('#4f8a3a') } }), [])
  const material = useMemo(() => {
    const m = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.95 })
    m.onBeforeCompile = (shader) => {
      shader.uniforms.uSnow = uniforms.uSnow
      shader.uniforms.uWet = uniforms.uWet
      shader.uniforms.uGrass = uniforms.uGrass
      shader.vertexShader = shader.vertexShader
        .replace('#include <common>', '#include <common>\nvarying vec3 vWN;')
        .replace('#include <begin_vertex>', '#include <begin_vertex>\nvWN = normalize(normal);')
      shader.fragmentShader = shader.fragmentShader
        .replace('#include <common>', '#include <common>\nvarying vec3 vWN;\nuniform float uSnow;\nuniform float uWet;\nuniform vec3 uGrass;')
        .replace(
          '#include <color_fragment>',
          `#include <color_fragment>
          float gw = smoothstep(0.02, 0.16, vColor.g - 0.5 * (vColor.r + vColor.b));
          diffuseColor.rgb = mix(diffuseColor.rgb, uGrass, gw);
          float sn = uSnow * smoothstep(0.55, 0.8, vWN.y);
          diffuseColor.rgb = mix(diffuseColor.rgb * (1.0 - 0.3 * uWet), vec3(0.93, 0.95, 0.98), sn);`,
        )
    }
    return m
  }, [uniforms])

  useFrame(() => {
    uniforms.uSnow.value = env.snowCover
    uniforms.uWet.value = env.wet
    uniforms.uGrass.value.setRGB(env.grass[0], env.grass[1], env.grass[2])
  })

  return <mesh geometry={geometry} material={material} />
}
