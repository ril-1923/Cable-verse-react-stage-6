import { game, pushGame, resetGame } from './game'
import { pushStats, sim } from './tickets'
import { useRideStore } from '../store/useRideStore'
import type { Weather } from '../store/useRideStore'
import { useTicketStore } from '../store/useTicketStore'

/** Everything is stored as one JSON blob in localStorage. */
const KEY = 'cableverse-save-v1'

const num = (v: unknown, fallback: number) => (typeof v === 'number' && Number.isFinite(v) ? v : fallback)

export function writeSave() {
  try {
    const ride = useRideStore.getState()
    const tickets = useTicketStore.getState()
    localStorage.setItem(
      KEY,
      JSON.stringify({
        v: 2,
        ride: {
          speed: ride.speed, hour: ride.hour, autoTime: ride.autoTime, volume: ride.volume,
          weather: ride.weather, autoWeather: ride.autoWeather,
        },
        tickets: { price: tickets.price, capacity: tickets.capacity },
        sim: { ...sim, queue: [...sim.queue] },
        game: { ...game, event: null, haltLeft: 0, fireworksLeft: 0 },
      }),
    )
  } catch {
    // storage unavailable or full: playing still works, it just won't be saved
  }
}

export function loadSave(): boolean {
  try {
    const raw = localStorage.getItem(KEY)
    if (!raw) return false
    const d = JSON.parse(raw)
    if (d?.v !== 1 && d?.v !== 2) return false

    const r = d.ride ?? {}
    const weather: Weather = r.weather === 'rain' || r.weather === 'snow' ? r.weather : 'clear'
    useRideStore.setState({
      speed: num(r.speed, 1),
      hour: num(r.hour, 9),
      autoTime: r.autoTime !== false,
      volume: num(r.volume, 0.6),
      weather,
      autoWeather: r.autoWeather !== false,
    })
    const t = d.tickets ?? {}
    useTicketStore.setState({ price: num(t.price, 8), capacity: num(t.capacity, 5) })

    const s = d.sim ?? {}
    const q = Array.isArray(s.queue) ? s.queue : [4, 3]
    sim.queue = [num(q[0], 4), num(q[1], 3), num(q[2], 0), num(q[3], 0)]
    sim.sold = num(s.sold, 0)
    sim.revenue = num(s.revenue, 0)
    sim.turnedAway = num(s.turnedAway, 0)
    sim.legs = num(s.legs, 0)
    sim.loadSum = num(s.loadSum, 0)

    const g = d.game ?? {}
    game.cash = num(g.cash, 500)
    game.day = num(g.day, 1)
    game.dayHours = num(g.dayHours, 0)
    game.todayRevenue = num(g.todayRevenue, 0)
    game.todaySold = num(g.todaySold, 0)
    game.energy = num(g.energy, 0)
    game.totalEarned = num(g.totalEarned, 0)
    game.totalPax = num(g.totalPax, 0)
    game.happiness = num(g.happiness, 0.5)
    game.goalsDone = num(g.goalsDone, 0)
    game.highScore = num(g.highScore, 0)
    game.over = g.over === true
    game.bestProfit = num(g.bestProfit, 0)
    game.stormProfits = num(g.stormProfits, 0)
    game.nightPax = num(g.nightPax, 0)
    game.eventsDone = num(g.eventsDone, 0)
    game.badHours = num(g.badHours, 0)
    game.boost = num(g.boost, 1)
    game.boostLabel = typeof g.boostLabel === 'string' ? g.boostLabel : ''
    game.vip = g.vip === true
    game.nightPremium = num(g.nightPremium, 0)
    game.skinsOwned =
      Array.isArray(g.skinsOwned) && g.skinsOwned.includes('classic')
        ? g.skinsOwned.filter((x: unknown) => typeof x === 'string')
        : ['classic']
    game.skin = typeof g.skin === 'string' && game.skinsOwned.includes(g.skin) ? g.skin : 'classic'
    game.eventTimer = num(g.eventTimer, 20)
    game.upgrades = typeof g.upgrades === 'object' && g.upgrades ? { ...g.upgrades } : {}
    pushStats()
    pushGame()
    return true
  } catch {
    return false
  }
}

/** Start a brand new game (keeps the high score) and overwrite the save. */
export function newGame() {
  sim.queue = [4, 3, 0, 0]
  sim.sold = 0
  sim.revenue = 0
  sim.turnedAway = 0
  sim.legs = 0
  sim.loadSum = 0
  useRideStore.setState({ weather: 'clear', hour: 9 })
  useTicketStore.setState({ price: 8, capacity: 5 })
  resetGame()
  pushStats()
  writeSave()
}

/** Forget everything, including the high score. */
export function wipeSave() {
  try {
    localStorage.removeItem(KEY)
  } catch {
    // ignore
  }
  game.highScore = 0
  newGame()
  try {
    localStorage.removeItem(KEY)
  } catch {
    // ignore
  }
}
