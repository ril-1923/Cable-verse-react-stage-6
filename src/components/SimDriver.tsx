import { useFrame } from '@react-three/fiber'
import { env } from '../lib/env'
import { effSpeed, gameTick, pushGame } from '../lib/game'
import { pushStats, sim, stepDemand } from '../lib/tickets'
import { useRideStore } from '../store/useRideStore'

let statsTimer = 0

/** One place that advances the shared clock, visitor demand and the tycoon rules. */
export function SimDriver() {
  useFrame((_, delta) => {
    const dt = Math.min(delta, 0.1)
    const speed = effSpeed()
    env.phase += dt * speed

    if (!useRideStore.getState().paused) {
      stepDemand(dt) // visitors arrive with the clock, however fast the cabins run
      gameTick(dt, sim.queue.reduce((a, b) => a + b, 0), speed)
    }
    statsTimer += dt
    if (statsTimer > 0.25) {
      statsTimer = 0
      pushStats()
      pushGame()
    }
  })
  return null
}
