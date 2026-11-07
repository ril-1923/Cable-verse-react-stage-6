import { useMemo } from 'react'
import * as THREE from 'three'
import { useFrame } from '@react-three/fiber'
import { env } from '../lib/env'
import { game } from '../lib/game'
import { SEASONS, blend, daylightOffset, seasonPos, winterAmount } from '../lib/seasons'

/** Turns the calendar into scene values: meadow and leaf colours, day length and winter snow. */
export function SeasonDriver() {
  const c = useMemo(() => ({ a: new THREE.Color(), b: new THREE.Color() }), [])

  useFrame(() => {
    const pos = seasonPos(game.day, game.dayHours)
    env.seasonPos = pos
    env.dayOffset = daylightOffset(pos)
    env.winter = winterAmount(pos)
    const { a, b, t } = blend(pos)
    c.a.set(SEASONS[a].grass).lerp(c.b.set(SEASONS[b].grass), t)
    env.grass = [c.a.r, c.a.g, c.a.b]
    c.a.set(SEASONS[a].leaf).lerp(c.b.set(SEASONS[b].leaf), t)
    env.leaf = [c.a.r, c.a.g, c.a.b]
  })
  return null
}
