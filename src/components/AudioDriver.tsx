import { useEffect } from 'react'
import { useFrame } from '@react-three/fiber'
import { audio } from '../lib/audio'
import { env } from '../lib/env'
import { clamp } from '../lib/math'
import { useRideStore } from '../store/useRideStore'

/** Starts and stops the soundscape and feeds it the scene state each frame. */
export function AudioDriver() {
  const sound = useRideStore((s) => s.sound)
  const volume = useRideStore((s) => s.volume)

  useEffect(() => {
    if (sound) audio.start(useRideStore.getState().volume)
    else audio.stop()
  }, [sound])

  useEffect(() => {
    audio.setVolume(volume)
  }, [volume])

  useFrame((state, delta) => {
    if (!audio.active) return
    audio.update(Math.min(delta, 0.1), {
      rope: env.rope,
      night: env.night,
      height: clamp(state.camera.position.y / 60),
      riding: useRideStore.getState().riding,
      rain: env.rain,
      snow: env.snowfall,
    })
  })

  return null
}
