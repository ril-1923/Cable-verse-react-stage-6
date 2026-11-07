import { STATION_X, slopeHeight, terrainHeight } from './terrain'

export const LINE_Z = 3 // half the distance between the up and down lines
export const HANG = 2.6 // grip point to cabin roof
export const ROOF_T = 0.2
export const CABIN_L = 3.4
export const CABIN_W = 2.4
export const CABIN_H = 2.3 // clear interior height
export const FLOOR_TOP = -(HANG + ROOF_T + CABIN_H) // floor level relative to the rope
export const PLAT = 1.0 // station platform thickness
export const CABIN_COUNT = 4
export const TOWER_X = [-18, 0, 18]

const [X0, X1] = STATION_X
const LEN = X1 - X0
const ARC = Math.PI * LINE_Z
export const LOOP = 2 * LEN + 2 * ARC

/** Stop points along the loop: top arrives on the up line, bottom on the down line. */
export const S_TOP = LEN - 3
export const S_BOT = S_TOP + LOOP / 2

export interface StationInfo {
  index: 0 | 1 // 0 = summit, 1 = valley
  sign: 1 | -1
  x: number
  ground: number
  platY: number
  ropeY: number // rope height so the stopped cabin floor meets the platform
  doorX: number // where the cabin door stops
  inw: 1 | -1 // direction along x leading into the station walkway
  entX: number // far end of the walkway
}

function makeStation(index: 0 | 1): StationInfo {
  const sign: 1 | -1 = index === 0 ? 1 : -1
  const x = sign === 1 ? X1 : X0
  const ground = terrainHeight(x, 0)
  const doorX = x - sign * 3
  return {
    index, sign, x, ground,
    platY: ground + PLAT,
    ropeY: ground + PLAT - FLOOR_TOP,
    doorX,
    inw: sign === 1 ? -1 : 1,
    entX: doorX - sign * 6.7,
  }
}
export const STATIONS: [StationInfo, StationInfo] = [makeStation(0), makeStation(1)]

// Rope height knots: flat aprons at the stations, towers between.
const KX = [X0, X0 + 10, -18, 0, 18, X1 - 10, X1]
const KY = [
  STATIONS[1].ropeY,
  STATIONS[1].ropeY,
  slopeHeight(-18) + 8.5,
  slopeHeight(0) + 10,
  slopeHeight(18) + 13,
  STATIONS[0].ropeY,
  STATIONS[0].ropeY,
]
const KSAG = [0, 0.8, 2.4, 2.4, 0.8, 0]

export function towerTop(x: number): number {
  return KY[KX.indexOf(x)]
}

/** Rope height at x: straight between knots, sagging within each span. */
export function cableY(x: number): number {
  const cx = Math.min(X1, Math.max(X0, x))
  let i = 0
  while (i < KX.length - 2 && cx > KX[i + 1]) i++
  const u = (cx - KX[i]) / (KX[i + 1] - KX[i])
  return KY[i] + (KY[i + 1] - KY[i]) * u - KSAG[i] * 4 * u * (1 - u)
}

export interface PathPoint { x: number; z: number; dx: number; dz: number }

/** Position and heading on the closed loop: up line, top turn, down line, bottom turn. */
export function pathAt(s: number): PathPoint {
  if (s < LEN) return { x: X0 + s, z: LINE_Z, dx: 1, dz: 0 }
  s -= LEN
  if (s < ARC) {
    const p = s / LINE_Z
    return { x: X1 + LINE_Z * Math.sin(p), z: LINE_Z * Math.cos(p), dx: Math.cos(p), dz: -Math.sin(p) }
  }
  s -= ARC
  if (s < LEN) return { x: X1 - s, z: -LINE_Z, dx: -1, dz: 0 }
  s -= LEN
  const p = s / LINE_Z
  return { x: X0 - LINE_Z * Math.sin(p), z: -LINE_Z * Math.cos(p), dx: -Math.cos(p), dz: Math.sin(p) }
}
