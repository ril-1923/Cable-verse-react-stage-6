import { smoothstep } from './math'

export const X_MIN = -40
export const STATION_X = [-36, 36] as const
export const LINE2_Z = 16 // the optional second line runs parallel to the first
const lineDist = (z: number) => Math.min(Math.abs(z), Math.abs(z - LINE2_Z))

/** Natural slope height along the centre line, before stations are levelled. */
export const slopeHeight = (x: number) => (x - X_MIN) * 0.32

/** Mountain height at (x, z). The cable corridor (|z| < ~4) is kept smooth. */
export function terrainHeight(x: number, z: number): number {
  const slope = slopeHeight(x)
  const dz = lineDist(z)
  const bowl = dz * dz * 0.012
  const rough = smoothstep(3.5, 12, dz)
  const noise =
    (Math.sin(x * 0.21 + z * 0.13) * 2.2 +
      Math.sin(x * 0.07 - z * 0.31) * 3.1 +
      Math.sin(x * 0.45 + z * 0.4) * 0.7) *
    rough
  let h = slope + bowl + noise + 3.5 * rough

  // Level the ground under each station.
  for (const lz of [0, LINE2_Z]) {
    for (const sx of STATION_X) {
      const platform = slopeHeight(sx)
      const w = 1 - smoothstep(13, 26, Math.hypot(x - sx, (z - lz) * 0.45))
      h = h * (1 - w) + platform * w
    }
  }
  return h
}
