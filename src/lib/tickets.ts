import { MAX_PAX } from './config'
import { env } from './env'
import { hash } from './math'
import { useTicketStore } from '../store/useTicketStore'
import { demandFactor, game, hooks, lineCount, queueMax, sale, turnedAway } from './game'

/**
 * Visitors arrive at each station and queue. When a cabin is about to board, the group is
 * whoever is waiting, capped by the cabin capacity setting. Each rider buys a ticket.
 */
const BASE_RATE = 24 // visitors per minute per station at price 0 in full daylight

export const sim = {
  queue: [4, 3, 0, 0] as number[], // per station: line 1 summit, valley, line 2 summit, valley
  sold: 0,
  revenue: 0,
  turnedAway: 0,
  legs: 0,
  loadSum: 0,
}

/** dt is real seconds. Cheaper tickets, daylight and good weather bring more visitors. */
export function stepDemand(dt: number) {
  const { price } = useTicketStore.getState()
  const appeal = Math.max(0, 1 - price / 25)
  const perSecond = (BASE_RATE / 60) * appeal * demandFactor(env.daylight)
  for (let s = 0; s < lineCount() * 2; s++) {
    if (Math.random() < perSecond * dt) {
      if (sim.queue[s] < queueMax()) sim.queue[s]++
      else {
        sim.turnedAway++
        turnedAway()
      }
    }
  }
}

const legs = new Map<string, number>()

/** Group size for one cabin leg. Decided once, when the group first appears, then remembered. */
export function legCount(cabin: number, leg: number, boardSt: 0 | 1, boardT: number): number {
  const station = Math.floor(cabin / 4) * 2 + boardSt // cabins 0-3 run line 1, cabins 4-7 line 2
  const key = `${cabin}:${leg}`
  let n = legs.get(key)
  if (n === undefined) {
    if (boardT < 0.5) {
      const { price, capacity } = useTicketStore.getState()
      const cap = Math.min(MAX_PAX, capacity)
      n = Math.min(cap, sim.queue[station])
      sim.queue[station] -= n
      sim.sold += n
      const fare = price + (env.night > 0.5 ? game.nightPremium : 0)
      sim.revenue += n * fare
      sim.legs++
      sim.loadSum += n / cap
      sale(n, n * fare)
    } else {
      // already under way when the app started: not charged
      n = 1 + (hash(leg, cabin + 7) % MAX_PAX)
    }
    legs.set(key, n)
    if (legs.size > 300) {
      for (const k of legs.keys()) {
        if (Number(k.split(':')[1]) < leg - 12) legs.delete(k)
      }
    }
  }
  return n
}

hooks.addVisitors = (station, n) => {
  sim.queue[station] = Math.min(queueMax(), (sim.queue[station] ?? 0) + n)
}

export function pushStats() {
  useTicketStore.setState({
    stats: {
      queue: [...sim.queue],
      sold: sim.sold,
      revenue: sim.revenue,
      turnedAway: sim.turnedAway,
      load: sim.legs ? sim.loadSum / sim.legs : 0,
    },
  })
}

export function resetStats() {
  sim.sold = 0
  sim.revenue = 0
  sim.turnedAway = 0
  sim.legs = 0
  sim.loadSum = 0
  pushStats()
}
