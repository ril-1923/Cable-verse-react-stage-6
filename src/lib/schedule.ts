import { LOOP, S_BOT, S_TOP } from './cableway'
import { smoothstep } from './math'

/**
 * One cabin's repeating cycle, in nominal seconds:
 * dwell at summit -> travel down -> dwell at valley -> travel up.
 * Every cabin runs the same cycle, offset by PERIOD / count, so cabins can
 * never collide. The global speed multiplier just scales how fast time flows.
 */
export const V0 = 6 // cruise speed, m/s
export const ACC = 0.8 // acceleration and braking, m/s^2
export const DWELL = 12 // seconds stopped at each station

const L_SEG = S_BOT - S_TOP
const T_ACC = V0 / ACC
const D_ACC = 0.5 * V0 * T_ACC
export const T_SEG = 2 * T_ACC + (L_SEG - 2 * D_ACC) / V0
export const T_BOT = DWELL + T_SEG // cycle time when the valley dwell begins
export const PERIOD = 2 * T_BOT

export interface CabinState {
  s: number // distance along the loop
  v: number
  a: number
  station: -1 | 0 | 1 // -1 = in transit
  dwellT: number // seconds since stopping, when at a station
}

function segment(t: number) {
  if (t <= 0) return { d: 0, v: 0, a: 0 }
  if (t >= T_SEG) return { d: L_SEG, v: 0, a: 0 }
  if (t < T_ACC) return { d: 0.5 * ACC * t * t, v: ACC * t, a: ACC }
  if (t < T_SEG - T_ACC) return { d: D_ACC + V0 * (t - T_ACC), v: V0, a: 0 }
  const r = T_SEG - t
  return { d: L_SEG - 0.5 * ACC * r * r, v: ACC * r, a: -ACC }
}

export function cabinState(tau: number): CabinState {
  if (tau < DWELL) return { s: S_TOP, v: 0, a: 0, station: 0, dwellT: tau }
  if (tau < T_BOT) {
    const m = segment(tau - DWELL)
    return { s: S_TOP + m.d, v: m.v, a: m.a, station: -1, dwellT: 0 }
  }
  if (tau < T_BOT + DWELL) return { s: S_BOT, v: 0, a: 0, station: 1, dwellT: tau - T_BOT }
  const m = segment(tau - T_BOT - DWELL)
  return { s: (S_BOT + m.d) % LOOP, v: m.v, a: m.a, station: -1, dwellT: 0 }
}

/** 0 = closed, 1 = fully open. */
export function doorOpen(state: CabinState): number {
  if (state.station < 0) return 0
  const t = state.dwellT
  return Math.max(0, smoothstep(0, 1.2, t) - smoothstep(DWELL - 1.8, DWELL - 0.6, t))
}
