import { FLOOR_TOP, STATIONS } from './cableway'
import { smoothstep } from './math'
import { legCount } from './tickets'
import { DWELL, PERIOD, T_BOT } from './schedule'

/**
 * Passengers are a pure function of time. For each cabin there are two "legs"
 * per cycle (summit -> valley, valley -> summit). Each leg carries a group that
 * walks in from the station entrance, queues, boards while the doors are open,
 * rides, then gets off at the other station and walks away.
 */
export { MAX_PAX } from './config'
const WALK = 1.6 // m/s
const LEAD = 5 // seconds before the cabin arrives that the group appears
const TAIL = 10 // seconds after arrival that the previous group is still walking off
const DOOR_Z = -1.2 // door plane, cabin-local z
const SEATS: [number, number][] = [[1.38, -0.6], [-1.38, -0.6], [1.38, 0.6], [-1.38, 0.6], [1.38, 0]]

interface Pt { x: number; z: number; c: boolean } // c: true = cabin-local coords
interface Route { pts: Pt[]; len: number }
interface Plan { approach: Route; board: Route; exit: Route; queueYaw: number; seatYaw: number }

const W = (x: number, z: number): Pt => ({ x, z, c: false })
const C = (x: number, z: number): Pt => ({ x, z, c: true })

function route(pts: Pt[]): Route {
  let len = 0
  for (let i = 0; i < pts.length - 1; i++) {
    if (pts[i].c === pts[i + 1].c) len += Math.hypot(pts[i + 1].x - pts[i].x, pts[i + 1].z - pts[i].z)
  }
  return { pts, len }
}

const PLANS: Plan[][] = STATIONS.map((st) =>
  SEATS.map(([sx, sz], j) => {
    const side = st.sign
    const zBoard = -0.9 * side // boarders queue on the far half of the walkway
    const zExit = 0.9 * side // leavers use the half next to the cabin
    const doorZ = 1.8 * side // world z of the door plane
    const qx = st.doorX + st.inw * (0.9 + 0.45 * j)
    return {
      approach: route([W(st.entX, zBoard), W(qx, zBoard)]),
      board: route([W(qx, zBoard), W(st.doorX, -0.2 * side), W(st.doorX, doorZ), C(0, DOOR_Z), C(0, -0.4), C(sx, sz)]),
      exit: route([C(sx, sz), C(0, -0.4), C(0, DOOR_Z), W(st.doorX, doorZ), W(st.doorX, zExit), W(st.entX, zExit)]),
      queueYaw: -st.inw * Math.PI / 2,
      seatYaw: sx > 0 ? -Math.PI / 2 : Math.PI / 2,
    }
  }),
)

interface Sample { x: number; z: number; c: boolean; dx: number; dz: number }
const S: Sample = { x: 0, z: 0, c: false, dx: 0, dz: 1 }

function sample(r: Route, d: number, out: Sample) {
  let rem = Math.max(0, d)
  let ldx = 0
  let ldz = 1
  for (let i = 0; i < r.pts.length - 1; i++) {
    const a = r.pts[i]
    const b = r.pts[i + 1]
    if (a.c !== b.c) continue
    const len = Math.hypot(b.x - a.x, b.z - a.z)
    if (len < 1e-6) continue
    ldx = (b.x - a.x) / len
    ldz = (b.z - a.z) / len
    if (rem <= len) {
      const t = rem / len
      out.x = a.x + (b.x - a.x) * t
      out.z = a.z + (b.z - a.z) * t
      out.c = a.c
      out.dx = ldx
      out.dz = ldz
      return
    }
    rem -= len
  }
  const e = r.pts[r.pts.length - 1]
  out.x = e.x
  out.z = e.z
  out.c = e.c
  out.dx = ldx
  out.dz = ldz
}

export interface Pose {
  visible: boolean
  inCabin: boolean // coordinates are cabin-local when true, world otherwise
  x: number
  y: number
  z: number
  yaw: number
  seat: number // 0 standing .. 1 seated
  scale: number
  swing: number // leg swing amplitude (0 when not walking)
  stride: number // distance walked, drives the leg animation
  leg: number
}

export const newPose = (): Pose => ({
  visible: false, inCabin: false, x: 0, y: 0, z: 0, yaw: 0, seat: 0, scale: 1, swing: 0, stride: 0, leg: 0,
})

function place(pose: Pose, station: 0 | 1) {
  pose.inCabin = S.c
  pose.x = S.x
  pose.z = S.z
  pose.y = S.c ? FLOOR_TOP : STATIONS[station].platY
  pose.yaw = Math.atan2(S.dx, S.dz)
}

/** T is the cabin's own clock: global phase plus the cabin's offset. */
export function passengerPose(cabin: number, slot: 0 | 1, j: number, T: number, pose: Pose): void {
  pose.visible = false
  const k = Math.floor(T / PERIOD)
  const tau = T - k * PERIOD

  let kk: number
  let boardT: number // seconds since the cabin arrived at the boarding station
  let exitT: number // seconds since the cabin arrived at the exit station
  if (slot === 0) {
    kk = tau > PERIOD - LEAD ? k + 1 : k
    boardT = T - kk * PERIOD
    exitT = boardT - T_BOT
  } else {
    kk = tau <= DWELL + TAIL ? k - 1 : k
    boardT = T - (kk * PERIOD + T_BOT)
    exitT = T - (kk + 1) * PERIOD
  }
  const leg = 2 * kk + slot
  if (boardT < -LEAD) return

  const boardSt: 0 | 1 = slot === 0 ? 0 : 1
  const exitSt: 0 | 1 = slot === 0 ? 1 : 0
  if (j >= legCount(cabin, leg, boardSt, boardT)) return
  const tb0 = 2.8 + 0.4 * j
  const te0 = 0.9 + 0.35 * j

  pose.leg = leg
  pose.seat = 0
  pose.scale = 1
  pose.swing = 0
  pose.stride = 0

  if (exitT >= te0) {
    const plan = PLANS[exitSt][j]
    const d = WALK * (exitT - te0)
    if (d >= plan.exit.len) return
    sample(plan.exit, d, S)
    place(pose, exitSt)
    pose.seat = 1 - smoothstep(0, 0.7, d)
    pose.swing = pose.seat < 0.5 ? 0.55 : 0
    pose.stride = d
    pose.scale = smoothstep(0, 0.6, plan.exit.len - d)
  } else {
    const plan = PLANS[boardSt][j]
    const dBoard = WALK * (boardT - tb0)
    if (boardT >= tb0) {
      if (dBoard >= plan.board.len) {
        pose.inCabin = true
        pose.x = SEATS[j][0]
        pose.z = SEATS[j][1]
        pose.y = FLOOR_TOP
        pose.yaw = plan.seatYaw
        pose.seat = 1
      } else {
        sample(plan.board, dBoard, S)
        place(pose, boardSt)
        pose.seat = smoothstep(plan.board.len - 0.7, plan.board.len, dBoard)
        pose.swing = pose.seat < 0.5 ? 0.55 : 0
        pose.stride = dBoard
      }
    } else {
      const d = WALK * (boardT + LEAD)
      sample(plan.approach, d, S)
      place(pose, boardSt)
      pose.scale = smoothstep(0, 0.6, d)
      if (d >= plan.approach.len) pose.yaw = plan.queueYaw
      else {
        pose.swing = 0.55
        pose.stride = d
      }
    }
  }
  pose.visible = true
}
